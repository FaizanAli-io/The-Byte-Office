import './globals.css';
import { Inter } from 'next/font/google';
import type { Metadata, Viewport } from 'next';
import { company, siteUrl } from '@/content/site';

if (typeof window === 'undefined') {
  const currentStorage = (globalThis as { localStorage?: Storage }).localStorage;

  if (!currentStorage || typeof currentStorage.getItem !== 'function') {
    const storageMap = new Map<string, string>();

    const storageShim: Storage = {
      getItem: (key: string) => (storageMap.has(key) ? storageMap.get(key)! : null),
      setItem: (key: string, value: string) => {
        storageMap.set(key, value);
      },
      removeItem: (key: string) => {
        storageMap.delete(key);
      },
      clear: () => {
        storageMap.clear();
      },
      key: (index: number) => Array.from(storageMap.keys())[index] ?? null,
      get length() {
        return storageMap.size;
      },
    };

    (globalThis as { localStorage?: Storage }).localStorage = storageShim;
  }
}

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'The Byte Office | Software Development and AI Solutions',
    template: '%s | The Byte Office',
  },
  description:
    'The Byte Office builds custom software, SaaS platforms, AI agents, RAG systems, automation workflows, backend APIs, and full-stack web applications.',
  applicationName: company.name,
  authors: [{ name: company.name }],
  creator: company.name,
  publisher: company.name,
  icons: {
    icon: '/favicon.ico',
  },
  manifest: '/site.webmanifest',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0f172a',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} scroll-smooth`}>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
