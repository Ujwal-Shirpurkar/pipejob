# PipeJob Client

React 19 + TypeScript dashboard for the PipeJob agent (Vite, Tailwind CSS v4, TanStack Query, React Router 7).

## Commands

```bash
npm run dev      # dev server on :5173
npm run build    # type-check + production build
npm run lint     # ESLint (flat config)
```

## Structure

```
src/
  api/client.ts     typed fetch wrapper for every server endpoint
  lib/events.tsx    single SSE connection (/api/events) that updates React Query caches live
  lib/format.ts     labels and formatting helpers
  lib/styles.ts     cx() and shared input classes
  components/       ui primitives, badges, charts (single-series, direct-labelled), Markdown, AddJobDialog
  pages/            Overview, Agent, Review, Pipeline, JobDetail, Stories, Profile, Settings
  types/index.ts    mirrors server/src/types — keep in sync
```

## Backend

Expects the API at `VITE_API_URL` (default `http://localhost:3001`).

## Conventions

- Strict TypeScript with `noUnusedLocals`, `noUnusedParameters` and `erasableSyntaxOnly` (no parameter properties or enums).
- Component files export only components (react-refresh); put helpers in `src/lib/`.
- Model output (agent reports) is rendered with react-markdown, which escapes HTML.
