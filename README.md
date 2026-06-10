# Game Design Document Editor

Local-first editor for game design documents.

## Requirements

- [Node.js](https://nodejs.org/) (LTS recommended)
- npm (included with Node.js)

## Setup

```bash
npm install
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
