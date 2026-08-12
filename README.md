# Forge

**Code-native design system creator** — an IDE for building design systems visually and exporting them as production React + TypeScript + CSS variable code.

Open the app and you land directly in the editor with a polished default system.

## Live demo

After GitHub Pages is enabled for this repo (**Settings → Pages → Source: GitHub Actions**), the app is published at:

**https://vishakhag19.github.io/Cursor/**

Use that URL if Cloud Agent port forwarding does not work on your machine.

## Quick start (local)

```bash
npm install
npm run dev
```

Open **http://localhost:5173** in your browser.

Build:

```bash
npm run build
npm run preview
```

## Cloud Agent preview

When running inside a Cursor Cloud Agent, `localhost:5173` on **your computer** only works if the port is forwarded from the remote VM:

1. Open this agent from **Cursor Desktop** (Agents window), not only the web dashboard.
2. Confirm the dev server is running (this repo’s `.cursor/environment.json` starts it on port **5173**).
3. Click the **plug icon** (top-right of the agent panel) or open the **Ports** tab in the terminal area.
4. Forward port **5173** manually if it is not listed automatically.
5. Open the forwarded local URL shown in the Ports panel (often `http://localhost:5173`, or another port if 5173 is busy locally).

If forwarding still fails, clone the repo locally and run `npm install && npm run dev`, or use the **GitHub Pages** demo link above.

## What you can do

1. Start from **Forge Default**, an attributed open-source-inspired **preset**, or **scratch**
2. Edit foundations (colors, type, spacing, radius, borders, shadows, motion, icons, breakpoints)
3. Select components for your system
4. Preview interactive components (hover, focus, keyboard, light/dark, responsive, example app)
5. Inspect **Visual | Tokens | Code** for the same source of truth
6. Export a downloadable `design-system.zip`
7. Propose AI edits as a reviewable design diff (heuristic offline; optional OpenAI-compatible API)

## Architecture

| Module | Role |
|---|---|
| `src/schema` | Typed serializable design-system document |
| `src/store` | Zustand + immer editor state, undo/redo |
| `src/token-engine` | Ref resolution, CSS vars, contrast, impact |
| `src/components` | Tokenized interactive components + registry |
| `src/preview` | Isolated `.ds-preview` (no editor chrome bleed) |
| `src/presets` | 8 attributed starter systems |
| `src/export` | Codegen + JSZip |
| `src/ai` | Schema-aware proposals + design diff |
| `src/editor` | Apple-principle-inspired editor chrome |

Editor chrome uses IBM Plex and Forge tokens under `.forge-editor`. User systems render only under `.ds-preview`.

## Optional AI

Set in `.env`:

```bash
VITE_AI_API_KEY=sk-...
VITE_AI_BASE_URL=https://api.openai.com/v1
VITE_AI_MODEL=gpt-4o-mini
```

Without a key, AI still works via local schema-aware heuristics.

## Presets

Presets translate published foundation ideas into Forge’s schema. They are **not** official vendor implementations. Each preset shows license and attribution in the Themes & Presets panel.

## License

MIT for this application. Respect upstream licenses for any referenced design systems and icon packages.
