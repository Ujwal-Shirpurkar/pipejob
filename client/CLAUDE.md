# PipeJob Client

React + TypeScript frontend for the PipeJob job listing platform.

## Tech Stack

- **React 19** with TypeScript
- **Vite** (build tool, with Oxc-based React plugin)
- **React Router DOM 7** for routing
- **ESLint** (flat config format)

## Commands

```bash
npm install        # Install dependencies
npm run dev        # Start dev server with HMR
npm run build      # Type-check + production build
npm run preview    # Preview production build locally
npm run lint       # Run ESLint
```

## Project Structure

```
src/
  components/      # Shared/reusable components
  pages/           # Route-level page components
  services/        # API layer (api.ts)
  store/           # State management
  App.tsx          # Root router
  main.tsx         # React DOM entry point
```

## Backend

Expects a backend running at `http://localhost:3000`. The `/jobs` endpoint should return an array of objects with `id`, `title`, and `company_name` fields.

## TypeScript

Strict mode is enabled. `noUnusedLocals` and `noUnusedParameters` are enforced — the build will fail if these are violated.
