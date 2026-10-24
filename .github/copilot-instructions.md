# Copilot instructions for GoPinyin

## Repository snapshot

This repo is a static browser app, not a framework app with a build pipeline. The app shell lives in `index.html`, core behavior is split across `assets/*.js`, and the local dev server is provided by `server/serve.js`.

Key files:
- `index.html`: main app shell and UI layout
- `assets/app-core.js`: typing engine, data normalization, IndexedDB/localStorage persistence, and shared study logic
- `assets/gopinyin.js`: SFX, auth/demo user flow, Pro upgrade UI, dashboard, landing page, and game/lesson interactions
- `assets/pronounce.js`: pronunciation exercise, microphone flow, scoring, and stats
- `assets/vkbd.js`: virtual keyboard behavior
- `assets/data.js`: embedded HSK sentence/vocabulary data bundle
- `server/serve.js`: static localhost server used to preserve microphone permissions and localStorage origin
- `tests/pronounce.js`: primary browser-level regression test

## Build, test, and lint commands

This repo does not currently define a full build pipeline or a lint script in `package.json`.

Use these commands from the repository root:

- Start the local app server:
  - `npm start`
  - or `node server/serve.js`
- Run the app without auto-opening a browser:
  - `npm run serve`
  - or `node server/serve.js --no-open`
- Run the single automated regression file:
  - `npm test`
  - or `node tests/pronounce.js`

Important browser/runtime note:
- Do not open the app directly as `file://...` for microphone features. The repo README explicitly requires `http://localhost` so Chrome remembers microphone permissions and the app keeps localStorage/progress correctly.
- The server binds to `http://localhost:8080` by default.

## High-level architecture

- The app is intentionally static and self-contained. Most data is embedded in JavaScript files instead of fetched from an API, so behavior is tightly coupled to the bundled assets.
- `index.html` orchestrates the app surface and view switching, while the JavaScript modules implement the behavior behind those screens.
- `app-core.js` is the “ground truth” layer for study state: it normalizes pinyin input, resolves the active row/sentence, handles correctness checks, and stores study progress in IndexedDB/localStorage.
- `gopinyin.js` is the experience layer: it builds the landing/dashboard UI, auth flow, Pro state, audio effects, and various study modules.
- `pronounce.js` is a separate feature layer for the pronunciation exercise, with speech recognition and per-syllable scoring logic. This is the most browser-specific and fragile area in the repo.
- `server/serve.js` is not a framework server; it is a safe static host that prevents access to internal paths and ensures the app runs with the correct browser origin.
- `tests/pronounce.js` is the main validation mechanism. It launches Chrome with fake media devices and verifies the pronunciation flow end-to-end.

## Key conventions

- Prefer the local dev server (`localhost`) for any change that touches microphone, speech, or local persistence; the app relies on browser origin rules.
- Keep logic organized by responsibility across the `assets` files instead of creating a new framework or bundling pattern. The codebase favors a few large modules over a React/Vue-style architecture.
- Use localStorage/IndexedDB for persistence; the app is designed as a client-side demo/static app rather than a backend-backed service.
- If a change affects the typing sentence engine, check the normalization helpers in `app-core.js` first; they are deliberately strict because small edge cases (Vietnamese IME input, leading `w`/`y`, and accent normalization) cause user-visible correctness bugs.
- When editing pronunciation features, validate with the existing Playwright test (`node tests/pronounce.js`), because the repository’s main automated coverage is focused on this path.
- Do not assume a build or lint step exists. The repo is intentionally minimal and leverages Node only for serving and smoke validation.

## Repository-specific workflow notes

- For any user-facing change, verify through the browser on `http://localhost:8080` rather than opening `index.html` directly.
- If the task involves the study/typing engine or speech scoring, inspect the matching module in `assets/app-core.js` or `assets/pronounce.js` before patching unrelated files.
- Keep changes aligned with the static-asset structure: data is embedded and changes often affect multiple UI modules at once.
