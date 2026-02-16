# AGENTS.md

## Project Overview

Bitrise Artifacts Manager — a Tauri 2 desktop app for managing Bitrise Android build artifacts. Users browse apps and builds, download APKs, and install them to connected Android devices via ADB.

## Architecture

```
src/                          # Frontend (React 18 + TypeScript + Tailwind CSS)
├── App.tsx                   # Root component, manages all top-level state
├── api/
│   ├── index.ts              # Tauri invoke() wrappers for IPC
│   └── bitrise.ts            # BitriseClient using Tauri HTTP plugin
├── components/
│   ├── Sidebar.tsx           # App selector sidebar with icons
│   ├── BuildList.tsx         # Builds grouped by branch, status indicators
│   ├── ArtifactPanel.tsx     # Artifact download/install actions
│   ├── DeviceBar.tsx         # Bottom bar showing connected ADB devices
│   └── SettingsModal.tsx     # API token configuration dialog
├── types/index.ts            # TypeScript interfaces (App, Build, Artifact, Device, Settings)
├── main.tsx                  # React entry point
└── styles.css                # Tailwind imports + custom scrollbar styles

src-tauri/                    # Backend (Rust + Tauri 2)
├── src/
│   ├── main.rs               # App entry, plugin/command registration
│   ├── commands.rs           # #[tauri::command] handlers (IPC endpoints)
│   ├── bitrise.rs            # BitriseClient (Reqwest HTTP client)
│   ├── adb.rs                # ADB device detection + APK install
│   └── fs.rs                 # Settings persistence (~/.bitrise-artifacts/)
├── Cargo.toml                # Rust deps: tauri 2, tokio, reqwest, serde, anyhow
└── tauri.conf.json           # Window config, bundle settings, dev server URL
```

## Data Flow

1. User enters Bitrise API token in SettingsModal
2. Token saved to `~/.bitrise-artifacts/settings.json` via Rust `save_settings` command
3. Frontend calls `get_apps(token)` → Rust fetches from Bitrise API → returns app list
4. User selects app → `get_builds(slug)` → builds grouped by branch in BuildList
5. User selects build → `get_artifacts(slug, build)` → APKs shown in ArtifactPanel
6. Download: `download_artifact()` → cached to `~/.bitrise-artifacts/cache/`
7. Install: `install_apk(path, device_id)` → ADB command executed by Rust

## Bitrise REST API

Base URL: `https://api.bitrise.io/v0.1` | Auth header: `Authorization: token {api_token}`

| Endpoint | Purpose |
|---|---|
| `GET /apps` | List accessible apps |
| `GET /apps/{slug}/builds?limit=50` | List recent builds |
| `GET /apps/{slug}/builds/{build}/artifacts` | List build artifacts |
| `GET /apps/{slug}/builds/{build}/artifacts/{artifact}` | Get artifact download URL |

## IPC Commands (Tauri invoke)

| Command | Args | Returns |
|---|---|---|
| `get_apps` | `token` | `App[]` |
| `get_builds` | `app_slug` | `Build[]` |
| `get_artifacts` | `app_slug, build_slug` | `Artifact[]` |
| `download_artifact` | `app_slug, build_slug, artifact_slug, filename` | `string` (cache path) |
| `save_to_downloads` | `cache_path, file_name` | `string` (downloads path) |
| `get_connected_devices` | — | `Device[]` |
| `install_apk` | `apk_path, device_id` | `string` |
| `save_settings` | `settings: Settings` | — |
| `load_settings` | — | `Settings` |

## Development

```bash
npm run tauri-dev      # Full dev mode (Tauri + Vite on port 1420)
npm run dev            # Vite dev server only
npm run build          # Build frontend (tsc + vite)
npm run tauri-build    # Build production desktop bundle
```

**Requirements:** Node.js 18+, Rust stable, ADB on PATH (for device features)

## Conventions

- **State management:** React hooks in App.tsx (no external state library)
- **Styling:** Tailwind CSS utility classes, custom dark theme in `tailwind.config.js`
- **Rust errors:** `anyhow::Result<T>`, converted to `String` for Tauri IPC
- **All Tauri commands are async** (Tokio runtime)
- **Settings dir:** `~/.bitrise-artifacts/` contains `settings.json` and `cache/`

## Notes

- Bitrise API client exists in both frontend (`src/api/bitrise.ts`) and backend (`src-tauri/src/bitrise.rs`)
- No test suite exists — changes should be verified manually
- ADB integration uses `std::process::Command`, not the Tauri shell plugin
- Dark mode is always on (Tailwind `class` strategy, `<html class="dark">`)
