# CLAUDE.md

@AGENTS.md

The shared instructions for this repo live in `AGENTS.md` (repo map, constraints,
commands, workflow) and apply to Claude Code the same as to any other agent.

## Claude Code-specific notes

- Prefer the `pnpm` scripts over calling `esbuild`/`tsc`/`playwright` directly — they
  encode the right paths and flags (see the command list in `AGENTS.md`).
- `package/goo-button.min.js`, `demo/src/goo-button.js` and `demo/src/highlight.min.js`
  are generated. If a diff shows unexpected changes in those files without a matching
  source change, that's a sign `pnpm build` / `pnpm build:demo` was run unnecessarily
  or a build input drifted — don't just accept the diff, check why.
- When asked to "fix" something in `docs/usage.md#limits` (RTL not mirrored, no
  reserved clipping space, etc.) — these are documented, intentional limits, not bugs.
  Confirm with the user before changing that behavior rather than silently treating it
  as a defect.
- Run `pnpm test:full` before reporting a task complete whenever you touched anything
  under `package/src/`, `test/`, or `e2e/`.
