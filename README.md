# The Byte Office

Portfolio website and private finance workspace for [The Byte Office](https://github.com/FaizanAli-io/The-Byte-Office).

Built with Next.js 15, React, Tailwind CSS, and Neon Postgres.

## Features

- Public marketing site: services, work, about, contact
- Protected finance workspace at `/finance`
  - Portfolio editor for banks and mutual funds
  - Portfolio snapshots with allocation charts
  - Monthly ledger with accounts, transactions, and reconciliation
  - AI finance assistant with tool calling, confirmation cards, and in-chat ledger forms
  - Assistant tool-call logs for debugging

## Getting started

1. Install dependencies:

```bash
npm install
```

2. Copy `example.env` to `.env` and fill in the values:

```dotenv
DATABASE_URL=
DATABASE_URL_UNPOOLED=
FINANCE_SESSION_SECRET=
OPENROUTER_API_KEY=
OPENROUTER_MODEL=
SMTP_USER=
SMTP_PASS=
```

3. Apply database migrations:

```bash
npm run db:migrate
```

4. Start the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Finance assistant

The assistant lives at `/finance/agent` and uses OpenRouter for model access. Reads run immediately; writes create confirmation cards or in-chat ledger forms that must be submitted before data changes.

Setup and troubleshooting details are in [`docs/finance-agent.md`](docs/finance-agent.md).

Notes:

- `OPENROUTER_MODEL` is optional. When unset, the app defaults to `z-ai/glm-5.2:free`.
- Free OpenRouter models share one daily quota per account.
- Never expose `OPENROUTER_API_KEY` through a `NEXT_PUBLIC_` variable.

## Scripts

```bash
npm run dev          # Start development server
npm run build        # Production build
npm run start        # Start production server
npm run db:migrate   # Apply Drizzle migrations
```

## Deploy

Deploy on Vercel or any Node.js host that supports Next.js 15. Set the same environment variables used locally, run migrations against the production database, and protect the finance routes with the configured session secret.
