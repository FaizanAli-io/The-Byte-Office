#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

const SOURCE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.css',
  '.scss',
  '.sql',
  '.json',
  '.md',
]);

const EXCLUDED_PATHS = [
  /^package-lock\.json$/,
  /^drizzle\//,
  /^public\//,
  /^\.agents\//,
  /(^|\/)next-env\.d\.ts$/,
  /(^|\/)skills-lock\.json$/,
];

const NON_CODE_EXTENSIONS = new Set(['.json', '.md']);

const TEST_PATH = /(^|\/)tests?\//;

function trackedFiles() {
  try {
    const out = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    return [...new Set(out.split('\0').filter(Boolean))];
  } catch {
    console.error('Not a git repository (or git is unavailable), so there is no file list to read.');
    process.exit(1);
  }
}

function isSource(path) {
  if (!SOURCE_EXTENSIONS.has(extname(path))) return false;
  return !EXCLUDED_PATHS.some((pattern) => pattern.test(path));
}

function countCodeLines(text) {
  let inBlock = false;
  let count = 0;

  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;

    let hasCode = false;
    let index = 0;

    while (index < line.length) {
      if (inBlock) {
        const close = line.indexOf('*/', index);
        if (close === -1) break;
        inBlock = false;
        index = close + 2;
        continue;
      }

      const rest = line.slice(index);
      if (rest.startsWith('/*')) {
        inBlock = true;
        index += 2;
        continue;
      }
      if (rest.startsWith('//')) break;

      const quote = rest[0];
      if (quote === '"' || quote === "'" || quote === '`') {
        hasCode = true;
        index += 1;
        while (index < line.length) {
          if (line[index] === '\\') index += 2;
          else if (line[index] === quote) {
            index += 1;
            break;
          } else index += 1;
        }
        continue;
      }

      hasCode = true;
      index += 1;
    }

    if (hasCode) count += 1;
  }

  return count;
}

function countLines(path, raw) {
  const absolute = join(ROOT, path);
  try {
    if (!statSync(absolute).isFile()) return null;
    const text = readFileSync(absolute, 'utf8');
    if (!text) return 0;
    if (!raw) return countCodeLines(text);
    return text.endsWith('\n') ? text.split('\n').length - 1 : text.split('\n').length;
  } catch {
    return null;
  }
}

function group(files, keyOf) {
  const totals = new Map();
  for (const file of files) {
    const key = keyOf(file);
    const current = totals.get(key) ?? { files: 0, lines: 0 };
    totals.set(key, { files: current.files + 1, lines: current.lines + file.lines });
  }
  return [...totals.entries()].sort((a, b) => b[1].lines - a[1].lines);
}

function table(rows, headers) {
  const widths = headers.map((header, index) =>
    Math.max(header.length, ...rows.map((row) => String(row[index]).length))
  );
  const line = (cells) =>
    cells
      .map((cell, index) => (index === 0 ? String(cell).padEnd(widths[index]) : String(cell).padStart(widths[index])))
      .join('  ');
  console.log(line(headers));
  console.log(widths.map((width) => '─'.repeat(width)).join('  '));
  for (const row of rows) console.log(line(row));
}

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const showAll = args.includes('--all');
const countRaw = args.includes('--raw');
const topIndex = args.indexOf('--top');
const topCount = showAll ? Infinity : topIndex === -1 ? 5 : Number(args[topIndex + 1]) || 5;

const files = trackedFiles()
  .filter(isSource)
  .map((path) => ({ path, lines: countLines(path, countRaw), ext: extname(path) }))
  .filter((file) => file.lines !== null)
  .sort((a, b) => b.lines - a.lines);

const source = files.filter((file) => !NON_CODE_EXTENSIONS.has(file.ext));
const code = source.filter((file) => !TEST_PATH.test(file.path));
const tests = source.filter((file) => TEST_PATH.test(file.path));
const other = files.filter((file) => NON_CODE_EXTENSIONS.has(file.ext));
const sum = (list) => list.reduce((total, file) => total + file.lines, 0);

if (asJson) {
  console.log(
    JSON.stringify(
      {
        totals: { code: sum(code), tests: sum(tests), docsAndConfig: sum(other), files: code.length },
        byExtension: Object.fromEntries(group(code, (file) => file.ext)),
        files: (showAll ? code : code.slice(0, topCount)).map(({ path, lines }) => ({ path, lines })),
      },
      null,
      2
    )
  );
  process.exit(0);
}

const label = countRaw ? 'lines (raw)' : 'lines of code';
console.log(`\nCode  ${sum(code).toLocaleString()} ${label} across ${code.length} files\n`);
table(
  group(code, (file) => file.ext).map(([ext, totals]) => [ext, totals.files, totals.lines.toLocaleString()]),
  ['ext', 'files', 'lines']
);

console.log(`\nLargest ${Math.min(topCount, code.length)} files\n`);
table(
  code.slice(0, topCount).map((file, index) => [`${index + 1}. ${file.path}`, file.lines.toLocaleString()]),
  ['file', 'lines']
);

if (tests.length) {
  console.log(`\nTests  ${sum(tests).toLocaleString()} ${label} across ${tests.length} files\n`);
  table(
    tests.map((file) => [file.path, file.lines.toLocaleString()]),
    ['file', 'lines']
  );
}

if (other.length) {
  console.log(`\nDocs and config (excluded from the code total)  ${sum(other).toLocaleString()} lines\n`);
  table(
    group(other, (file) => file.ext).map(([ext, totals]) => [ext, totals.files, totals.lines.toLocaleString()]),
    ['ext', 'files', 'lines']
  );
}

console.log('');
