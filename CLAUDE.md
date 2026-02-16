# CLAUDE.md

## Project

Bitrise Artifacts Manager — a Tauri 2 desktop app for browsing Bitrise builds, downloading APK artifacts, and installing them to Android devices via ADB.

## Tech Stack

- **Frontend:** React 18 + TypeScript, Vite, Tailwind CSS (dark theme)
- **Backend:** Rust (2021 edition), Tauri 2, Tokio, Reqwest
- **Plugins:** tauri-plugin-shell (ADB), tauri-plugin-fs, tauri-plugin-http
- **Icons:** Lucide React | **Dates:** date-fns

## Commands

```bash
npm run tauri-dev      # Full dev mode (kills port 1420 first, then starts Tauri + Vite)
npm run dev            # Vite dev server only (port 1420)
npm run build          # Build frontend (tsc + vite build)
npm run tauri-build    # Build production desktop app
```

No test suite exists yet.

## Architecture

Frontend and backend communicate via Tauri's `invoke()` IPC. React calls `api.*` wrappers in `src/api/index.ts`, which invoke Rust command handlers in `src-tauri/src/commands.rs`.

### Frontend (`src/`)
- `App.tsx` — root component, all top-level state lives here
- `api/index.ts` — thin wrappers around `invoke()` for each Tauri command
- `api/bitrise.ts` — `BitriseClient` class using Tauri HTTP plugin directly
- `components/` — Sidebar, BuildList, ArtifactPanel, DeviceBar, SettingsModal
- `types/index.ts` — shared TypeScript interfaces

### Backend (`src-tauri/src/`)
- `main.rs` — Tauri app setup, plugin registration, command registration
- `commands.rs` — all `#[tauri::command]` handlers
- `bitrise.rs` — Rust `BitriseClient` (Reqwest-based HTTP client for Bitrise API)
- `adb.rs` — ADB device detection and APK installation via `std::process::Command`
- `fs.rs` — settings persistence to `~/.bitrise-artifacts/settings.json`

### IPC Commands
| Invoke name | Purpose |
|---|---|
| `get_apps` | Fetch Bitrise apps list |
| `get_builds` | Fetch builds for an app |
| `get_artifacts` | Fetch artifacts for a build |
| `download_artifact` | Download APK to cache (`~/.bitrise-artifacts/cache/`) |
| `save_to_downloads` | Copy cached APK to ~/Downloads |
| `get_connected_devices` | List ADB devices |
| `install_apk` | Install APK to device via ADB |
| `save_settings` / `load_settings` | Persist/load settings JSON |

## Bitrise API

Base: `https://api.bitrise.io/v0.1` | Auth: `Authorization: token {api_token}`

- `GET /apps` — list apps
- `GET /apps/{slug}/builds?limit=50` — list builds
- `GET /apps/{slug}/builds/{build}/artifacts` — list artifacts
- `GET /apps/{slug}/builds/{build}/artifacts/{artifact}` — get download URL

## Conventions

- **Rust:** snake_case functions, CamelCase types, `anyhow::Result` for errors, async/await everywhere
- **TypeScript:** camelCase functions/vars, PascalCase components, all state in App.tsx via hooks
- **Styling:** Tailwind utility classes only, custom color tokens in `tailwind.config.js`, dark mode enforced
- **No tests yet** — be careful with refactors, verify manually
- **Settings dir:** `~/.bitrise-artifacts/` (settings.json + cache/)

## Gotchas

- The Bitrise API client exists in **both** frontend (`src/api/bitrise.ts`) and backend (`src-tauri/src/bitrise.rs`) — the frontend version uses Tauri's HTTP plugin, the backend uses Reqwest
- ADB must be installed and on PATH for device features to work
- `tauri-dev` script kills any process on port 1420 before starting
- Tauri window config: 1400x900 default, 1000x600 minimum
