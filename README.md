This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Qrave AI Project Rules

This repository defines project-specific AI rules for the Qrave project:

- Central skill: `.cursor/skills/qrave-project-rules/SKILL.md`
- Additional context: `.cursor/skills/qrave-project-rules/reference.md`
- Usage examples: `.cursor/skills/qrave-project-rules/examples.md`

These files describe how components are structured (`components/speisekarte/`, `components/templates/`, `components/shared/`), how Supabase migrations under `supabase/migrations/` must be handled, the expected git workflow (no direct pushes to `main`, German commit messages), and Qrave-specific product constraints (e.g. demo slug `qrave-demo`, Light Mode only).

**Supabase Auth:** Nur `import { supabase } from "@/lib/supabase"`, Session mit `await supabase.auth.getSession()`, bei fehlender Session `redirect('/login')` (Server) bzw. `router.replace('/login')` in Client-Komponenten. **Nicht:** `@supabase/auth-helpers-nextjs`, `createServerComponentClient`, eigener `createClient` aus `@/lib/supabase`. Details: Skill „Supabase Auth“.

### KI-Speisekarten-Import (Dashboard)

- Route: `POST /api/parse-menu` (PDF oder JPG/PNG, max. 32 MB).
- Route: `POST /api/import-url` (JSON `{ url, restaurantId? }` — HTML abrufen, Text extrahieren, gleiche Claude-Auswertung wie Datei-Import).
- Umgebungsvariable: `ANTHROPIC_API_KEY` (Claude, Modell `claude-sonnet-4-20250514`).
- PDFs nutzen den Anthropic-Beta-Header `pdfs-2024-09-25` (siehe [Claude PDF-Dokumentation](https://docs.claude.com/en/docs/build-with-claude/pdf-support)).
