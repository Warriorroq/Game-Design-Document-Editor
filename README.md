# Game Design Document Editor

Local-first editor for game design documents.

## Requirements

- [Node.js](https://nodejs.org/) (LTS recommended)
- npm (included with Node.js)

## Setup

```bash
npm install
```

## Pre-commit

Git hooks run formatting, linting, and type-checking before each commit.

**One-time setup** (requires [Python](https://www.python.org/) with `pip`):

```bash
pip install pre-commit
pre-commit install
```

On commit, hooks run in order:

1. **Prettier** — format staged files
2. **ESLint** — lint and auto-fix staged JS/TS
3. **TypeScript** — `tsc -b` (full project)

Run hooks manually without committing:

```bash
pre-commit run --all-files
```

You can also run checks directly:

```bash
npm run format:check   # Prettier (check only)
npm run format         # Prettier (write)
npm run lint           # ESLint
npm run lint:fix       # ESLint with auto-fix
npm run typecheck      # TypeScript
```

## Run

### Web (browser)

Data is stored in browser `localStorage`. No project folder or Git.

```bash
npm run dev        # http://localhost:5173
```

### Desktop (Windows, Electron)

Opens/saves a project folder on disk (`gdd.json`, `sections/`, `assets/`). Git integration is available from the Project menu.

```bash
npm run dev:desktop
```

## Build

```bash
npm run build          # web production build
npm run preview        # preview web build locally
npm run build:win      # Windows installer + portable in release/
```
