# Game Design Document Editor

Local-first editor for game design documents: structured sections, rich text, image boards, export.

**Version:** 0.0.600

## What you get

- **Sections** - sidebar, add/remove/reorder, per-section title and description
- **Rich text** - headings, lists, tables, links, formatting toolbar
- **Desk** - paste/drop images per section, shapes, pen, groups
- **Search** - across titles, body text, and anchors
- **Themes & shortcuts** - Settings (styles, language EN/RU, key bindings)
- **Auto-save** - browser `localStorage` in web mode

## Desktop (Windows)

Project folder on disk (not only in browser storage):

```
my-game/
  gdd.json
  sections/
  assets/
```

- **Project** menu - open folder, export/import `.gde` zip archive
- **Git** (in Project menu) - init, commit, push, pull; branch/dirty indicator on the Project button
- **Settings → Git** - commit author, remote URL, sign-in or Personal Access Token

```bash
npm install
npm run dev:desktop    # Vite + Electron
npm run build:win      # installer + portable in release/
```

## Web (browser only)

No project folder or Git. Data stays in `localStorage`.

```bash
npm install
npm run dev            # http://localhost:5173
npm run build
npm run preview
```

## Tips

1. **Project → Project folder** - pick a folder; the app writes `gdd.json` and section files there.
2. Sidebar dots - filled when a section has real content or board images.
3. Split panes - drag the dividers between sections list, editor, and desk.
4. For Git push/pull - use an **HTTPS** remote URL; set auth in **Settings → Git**.
