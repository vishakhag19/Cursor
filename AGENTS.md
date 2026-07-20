# AGENTS.md

## Cursor Cloud specific instructions

### What this codebase is
A **dependency-free static website** (plain HTML/CSS/JS). There is **no build
step, no package manager, and no dependencies to install**. `python3` and
`node` are already available on the VM.

The `main` branch currently contains only `README.md`. The actual site
(`index.html`, `play.html`, `styles.css`, `scripts.js`) lives on feature
branches (e.g. `cursor/ux-design-portfolio-*`). If you don't see the site files
in the working tree, you're likely on `main`; check out the branch that contains
the site, or use `git worktree add <dir> <branch>` to preview it without leaving
your current branch.

### Run it (development)
From the directory that contains `index.html`:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000/` (landing page) or
`http://localhost:8000/play.html` (Play Lab). Editing any HTML/CSS/JS file and
refreshing the browser picks up changes immediately — there is no hot reload and
nothing to rebuild.

### Lint / test / build
There are **no lint, test, or build commands** in this repository. Verification
is done by serving the site and checking it in a browser. The core interactive
feature to sanity-check is the "warm-up prompt generator" button on
`play.html`, which swaps the displayed prompt text on each click (see
`scripts.js`).
