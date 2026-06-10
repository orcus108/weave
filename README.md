# notExcalidraw

A free, multi-board whiteboard — no paywalls, no account required.

**[Try it live →](https://notexcalidraw.vercel.app)**

Excalidraw is a fantastic whiteboard tool, but multi-board support is gated behind their paid plan. notExcalidraw fixes that. It keeps everything you love about Excalidraw and adds the features that should have been free to begin with.

---

## Features

- **Unlimited boards** — create, rename, duplicate, close, and switch between boards from the tab bar
- **Board gallery** — visual overview of all boards with thumbnail previews, search, and hidden-board management
- **Checkpoint history** — automatic snapshots every 60 seconds or 50 changes; restore any point via the command palette (`Ctrl+/`)
- **Command palette** — switch boards, manage boards, and restore checkpoints without touching the mouse (`Ctrl+/`)
- **Keyboard shortcuts** — full keyboard control for power users (see below)
- **Fully local** — everything is saved in your browser; no account, no server, no subscription

---

## Keyboard shortcuts

All board shortcuts use the **Option** key (Mac) / **Alt** key (Windows/Linux).

| Shortcut | Action |
|---|---|
| `Option+T` | New board |
| `Option+Tab` | Next board (cycles) |
| `Option+Shift+Tab` | Previous board (cycles) |
| `Option+1` – `Option+9` | Jump to board by position |
| `Option+W` | Close current board (hide from tab bar) |
| `Option+R` | Rename current board |
| `Option+D` | Duplicate current board |
| `Option+K` | Open board gallery |

---

## Running locally

```bash
git clone https://github.com/orcus108/weave.git
cd weave
yarn install
yarn start        # opens http://localhost:3001
```

---

## Contributing

Contributions are welcome. Here's how to get started:

1. **Fork** the repo and clone your fork
2. **Install** dependencies: `yarn install`
3. **Start** the dev server: `yarn start` (runs on `localhost:3001`)
4. Make your changes inside `excalidraw-app/` — this is where all notExcalidraw features live
5. **Type-check** before committing: `yarn tsc --noEmit`
6. **Format** changed files: `yarn prettier --write excalidraw-app/**/*.{ts,tsx,scss}`
7. Open a pull request with a clear description of what you changed and why

### Ground rules

- **Do not modify `packages/excalidraw/`** — the core library is intentionally left unchanged. Locale string edits (`packages/excalidraw/locales/en.json`) for branding are the only exception.
- All new features belong in `excalidraw-app/`.
- Keep PRs focused. One feature or fix per PR.

### Good first issues

- Add a way to reorder boards (drag-and-drop on the tab bar)
- Export all boards as a zip of `.excalidraw` files
- Board colors / labels for visual organization
- Keyboard shortcut cheat-sheet overlay

### Architecture overview

| Path | What it is |
|---|---|
| `excalidraw-app/` | The notExcalidraw web app — all features live here |
| `excalidraw-app/boards/` | Board and checkpoint data types + pure CRUD logic |
| `excalidraw-app/components/BoardTabs.tsx` | Tab bar UI |
| `excalidraw-app/components/BoardGallery.tsx` | Gallery modal |
| `excalidraw-app/data/localStorage.ts` | Board persistence (localStorage + IndexedDB) |
| `excalidraw-app/App.tsx` | Root app — board init, switching, keyboard shortcuts |
| `packages/excalidraw/` | Upstream Excalidraw core library (do not modify) |

---

## Built on Excalidraw

notExcalidraw is a fork of [Excalidraw](https://excalidraw.com), an open-source virtual whiteboard released under the MIT license. The core drawing engine, rendering, and collaboration features are Excalidraw's work. We've built on top of it, not replaced it.

---

## License

MIT — same as the upstream Excalidraw project.
