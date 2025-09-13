# Repository Guidelines

## Project Structure & Module Organization
- `src/index.ts`: Node/Express server, MCP tools, WebSocket.
- `src/public/`: Frontend (Vanilla TS) with `index.html`, `main.ts`, and `modules/` (`parser.ts`, `renderer.ts`, `state.ts`, `dom.ts`, `events.ts`).
- `dist/`: Compiled server output (`tsc`).
- `subagents/`: Role docs for specialized agents.
- Test scripts: `test-mcp.js`, `test-websocket.js` (manual checks).

## Build, Test, and Development Commands
- `npm run dev`: Build frontend then run server in watch mode via `tsx`.
- `npm run build`: TypeScript build for server (`tsc`).
- `npm run build:frontend`: Bundle frontend with `esbuild` → `src/public/dist/main.js`.
- `npm run build:all`: Server + frontend build.
- `npm start`: Start from compiled `dist/index.js`.
- Tests (manual): Start server, then `node test-mcp.js` and `node test-websocket.js`.
  - Server chooses an available port starting at 3100.

## Coding Style & Naming Conventions
- Language: TypeScript (ESM). Formatting via Biome.
- Run `npm run format` before pushing.
- Indentation: tabs; Quotes: double (Biome default).
- Filenames: lowercase; use `kebab-case` for multiword (e.g., `ui-controls.ts`).
- Code: `camelCase` variables/functions, `PascalCase` types/classes, `UPPER_SNAKE_CASE` constants.
- Keep modules small and single‑purpose under `src/public/modules/`.

## Testing Guidelines
- No formal test framework; provide minimal reproducible scripts.
- Place ad‑hoc tests as `test-*.js` in repo root (or a `tests/` folder if added).
- Verify: MCP HTTP initialize flow (`test-mcp.js`) and WebSocket connectivity (`test-websocket.js`).
- For UI changes, add a quick GIF/screenshot of the canvas and list DSL used.

## Commit & Pull Request Guidelines
- Use Conventional Commits seen in history: `feat:`, `fix:`, `chore:`, `refactor:`, `ci:`.
- PRs: concise description, linked issue, steps to reproduce, and test evidence (logs/screenshots). Include any DSL snippets used.
- Keep PRs focused and under ~300 lines when possible. Update README/DSL notes if behavior changes.

## Security & Configuration Tips
- No secrets required; avoid adding credentials to code or logs.
- Server auto‑selects a free port from 3100; log shows the active URL.
