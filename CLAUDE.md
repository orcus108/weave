# CLAUDE.md

## What This Project Is

**Weave** is a fork of Excalidraw — a multi-board whiteboard web app. It adds features that the free Excalidraw plan gates behind a paywall, while preserving the exact Excalidraw look, feel, and font. Attribution: "Built on Excalidraw" is shown in the welcome screen.

The project is named **Weave**. All user-visible "Excalidraw" text has been replaced with "Weave". The core library is left functionally unchanged — all Weave features live in `excalidraw-app/`.

---

## Monorepo Structure

- **`packages/excalidraw/`** — Core React library (`@excalidraw/excalidraw`). **Do not modify logic here.** Locale strings in `packages/excalidraw/locales/en.json` have been edited for branding only.
- **`excalidraw-app/`** — The Weave web app. All new features live here.
- **`packages/`** — Supporting packages: `@excalidraw/common`, `@excalidraw/element`, `@excalidraw/math`, `@excalidraw/utils`
- **`examples/`** — Integration examples (NextJS, browser script)

---

## Development Commands

```bash
yarn start           # Dev server (localhost:3001)
yarn tsc --noEmit    # TypeScript type check (run before every commit)
yarn prettier --write excalidraw-app/**/*.{ts,tsx,scss}  # Format
yarn fix             # Auto-fix formatting and linting
yarn test:update     # Run all tests with snapshot updates
```

**Workflow rule:** after every edit run `yarn tsc --noEmit` then `yarn prettier --write` on changed files. ESLint treats formatting diffs as errors.

---

## Weave Features Added

### 1. Multi-board tabs (`excalidraw-app/boards/`)

- **`boards/types.ts`** — `Board` and `Checkpoint` types
- **`boards/boardManager.ts`** — Pure CRUD functions: `createBoard`, `renameBoard`, `deleteBoard`, `duplicateBoard`, `touchBoard`
- **`boards/checkpointManager.ts`** — IDB snapshots (IndexedDB store `weave-checkpoints-db`): `saveCheckpoint`, `loadCheckpoints`, `restoreCheckpoint`, `formatRelativeTime`

Board data is stored in `localStorage` under namespaced keys:

- `weave:boards` — JSON array of `Board` metadata
- `weave:activeboard` — active board ID string
- `weave:board:{id}:elements` — serialised elements per board
- `weave:board:{id}:appState` — serialised appState per board
- `weave:tabbar:collapsed` — boolean, persists tab bar collapse state

On first load, `migrateLegacyToBoard()` in `data/localStorage.ts` migrates the legacy `"excalidraw"` key to `"weave:board:board-default:*"`.

### 2. Board tab bar UI (`excalidraw-app/components/BoardTabs.tsx` + `BoardTabs.scss`)

Rendered above the canvas inside `App.tsx`. Uses CSS variables defined on `.excalidraw-app` (not `.excalidraw`) so they work outside the core scope.

- Click tab → switch board
- Double-click tab name → inline rename
- Right-click tab → context menu (Rename, Duplicate — **no Delete**)
- `+` button → new board
- `⊞` grid button → opens Board Gallery modal
- `⌃` button → collapse/expand tab bar (persisted to localStorage)
- Collapsed state: 10px accent strip, click anywhere to expand

**Delete is intentionally absent from the tab bar.** The only way to delete a board is via the Board Gallery modal, which always shows a confirmation dialog first.

### 3. Board Gallery modal (`excalidraw-app/components/BoardGallery.tsx` + `BoardGallery.scss`)

Opened by the `⊞` button in the tab bar. Shows all boards as thumbnail cards.

- Thumbnails generated on-demand via `exportToCanvas` (shimmer skeleton while loading)
- Search bar (auto-focused) filters boards by name
- Card actions on hover: ✎ rename (inline), ⎘ duplicate, × delete
- **Delete always uses `openConfirmModal` for confirmation.** The gallery closes first so the modal renders above the canvas, not behind the gallery overlay.
- "+ New board" button in header
- Escape or backdrop click to close
- `updatedAt` on boards is stamped via `touchBoard` in `switchBoard` (when leaving a board)

### 4. Checkpoint history

Every 50 element mutations or 60 seconds (whichever comes first), a snapshot of the current board is saved to IDB. Up to 15 checkpoints per board. Checkpoints are also saved when switching away from a board.

Accessible via the command palette (`Ctrl+/` → "Restore checkpoint: X minutes ago").

### 5. Command palette integration

Custom items added to `<CommandPalette customCommandPaletteItems={...}>` in `App.tsx`:

- **Boards category:** New board, Rename current board, Duplicate current board, Hide/Show board tabs, dynamic "Switch to: X" entries for every other board
- **History category:** Up to 5 most recent checkpoints as restore items

---

## Key Files Changed in `excalidraw-app/`

| File | What changed |
| --- | --- |
| `App.tsx` | Board init, switchBoard, onChange wiring, gallery state, branding cleanup |
| `app_constants.ts` | Added `BOARD_LIST`, `ACTIVE_BOARD_ID`, `TAB_BAR_COLLAPSED` keys; `boardElementsKey()`, `boardAppStateKey()` helpers |
| `app-jotai.ts` | Added `boardsAtom`, `activeBoardIdAtom`, `checkpointsAtom`, `renamingBoardIdAtom` |
| `data/localStorage.ts` | Added board-scoped load/save/migrate functions |
| `data/LocalData.ts` | `save()` accepts optional `boardId` |
| `components/AppMainMenu.tsx` | Removed Excalidraw+, Socials, Sign in/up links |
| `components/AppWelcomeScreen.tsx` | Replaced Excalidraw logo with Weave (icon + `--color-logo-text`), attribution link |
| `components/AppSidebar.tsx` | Removed Excalidraw+ promo tabs, now just `<DefaultSidebar />` |
| `index.html` | Title, meta tags, hidden h1 all updated to Weave |

---

## Theming Rules

- CSS variables for the tab bar and gallery are defined on `.excalidraw-app` (light) and `.excalidraw-app.theme--dark` (dark) in `BoardTabs.scss` — not on `.excalidraw`, because the tab bar is a sibling of the canvas, not a child.
- The `theme--dark` class is toggled on the outer wrapper div in `App.tsx` to mirror `editorTheme`.
- On board switch, `appState.theme` is overridden with the current live theme so dark/light mode is global across all boards.
- The board name is injected into `appState.name` on load and on every switch, so the export dialog defaults to the board name.

---

## Architecture Constraints

- **Never modify `packages/excalidraw/` logic.** Locale string edits (`en.json`) are the only permitted exception, for branding.
- All Weave state uses Jotai atoms via `appJotaiStore` for cross-component access without prop drilling.
- `ExcalidrawImperativeAPI` is obtained via `useExcalidrawAPI()`. Key methods used: `updateScene()`, `getAppState()`, `getSceneElements()`, `history.clear()`.
- `LocalData.save()` is debounced 300ms. Call `LocalData.flushSave()` before any board switch.
