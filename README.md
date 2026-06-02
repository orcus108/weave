# Weave

A free, multi-board whiteboard. Draw, sketch, and diagram across as many canvases as you need — no paywalls.

Excalidraw is a fantastic whiteboard tool, but multi-board support is locked behind their paid plan. Weave fixes that. It keeps everything you love about Excalidraw and adds the features that should have been free to begin with.

---

## Features

- **Unlimited boards** — create, rename, duplicate, and switch between boards from the tab bar
- **Board gallery** — visual overview of all your boards with thumbnail previews and search
- **Checkpoint history** — automatic snapshots every 60 seconds or 50 changes; restore any point via the command palette (`Ctrl+/`)
- **Command palette integration** — switch boards, manage boards, and restore checkpoints without touching the mouse
- **Fully local** — everything is saved in your browser. No account, no server, no subscription

---

## Running locally

```bash
git clone https://github.com/orcus108/weave.git
cd weave
yarn install
yarn start        # opens http://localhost:3001
```

---

## Built on Excalidraw

Weave is a fork of [Excalidraw](https://excalidraw.com), an open-source virtual whiteboard released under the MIT license. The core drawing engine, rendering, and collaboration features are Excalidraw's work. We've built on top of it, not replaced it.

---

## License

MIT — same as the upstream Excalidraw project.
