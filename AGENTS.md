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

## UI Features

### Build List (`src/components/BuildList.tsx`)
- **Pipeline grouping:** Builds with the same `build_number` are grouped together
- **Status filtering:** Filter by all/success/failed builds
- **Branch filtering:** Click filter icon to show/filter by specific branches
- **Branch watching:** Watch branches to quickly access their builds (only shown in "all builds" mode)
- **Search:** Search builds by build number, branch, user, or commit hash
- **Commit messages:** Expandable/collapsible (click chevron icon, doesn't interfere with build selection)
- **Metadata display:** Branch, user (PR author priority), build number, commit hash, duration, PR info
- **Context menu:** Right-click individual builds to open in Bitrise

### Sidebar (`src/components/Sidebar.tsx`)
- **Resizable:** Drag the right edge to resize (180-400px)
- **Width persistence:** Sidebar width is saved to settings and restored on restart
- **App icons:** Shows Bitrise app avatars
- **Watched branches:** Quick access to filtered builds by watched branches

### Artifact Panel (`src/components/ArtifactPanel.tsx`)
- **Resizable:** Drag the left edge to resize (280-700px)
- **Width persistence:** Panel width is saved to settings
- **Download:** Downloads APKs to cache directory
- **Install:** Installs APKs to selected ADB device
- **Uninstall:** Remove apps from devices
- **Save to Downloads:** Copy cached APK to ~/Downloads

### Device Bar (`src/components/DeviceBar.tsx`)
- **Auto-detection:** Polls ADB for connected devices
- **Device info:** Shows device model, Android version, installed app versions
- **Selection:** Select target device for APK installation

## State Management

All state is managed in `App.tsx` using React hooks:
- `settings`: User settings (API token, sidebar/panel widths)
- `apps`: List of Bitrise apps
- `builds`: List of builds for selected app
- `selectedBuild`: Currently selected build
- `artifacts`: Artifacts for selected build
- `devices`: Connected ADB devices
- `watchedBranches`: User's watched branches
- `activeBranchFilter`: Current branch filter

Settings persist to `~/.bitrise-artifacts/settings.json` via Rust backend.

## Recent Changes

### UI Enhancements (commits: cec6de8, 0d4e387)
- Made branch name, build number, user, and PR author more prominent in build cards
- Added expandable commit messages with dedicated toggle button
- Moved watch button to pipeline group header
- Watch button shows "Watched" status with filled icon for watched branches
- Added `pull_request_author` field (extracted from `original_build_params`)
- Fixed React rendering "0" by using `!!` operator on conditionals
- Pipeline groups are non-clickable (no valid pipeline URL available from API)

### Sidebar Persistence (commit: f45a060)
- Added debounced saving (100ms) during drag operations
- Immediate save on mouse up with final width
- Default sidebar width changed to 400px (max width)

### CI/CD (commits: 07c8e46, 38dc02f, 51ae890, 8163e89)
- GitHub Actions workflows for release builds (macOS, Linux, Windows, macOS Universal)
- Build check workflow for PRs and main branch pushes
- Added `package-lock.json` and `Cargo.lock` for reproducible builds
- `.tauri-dev.pid` added to gitignore

## Known Issues & Limitations

- **Pipeline URLs:** Bitrise API doesn't provide valid pipeline IDs, so pipeline groups can't be opened directly in Bitrise
- **No tests:** Changes should be verified manually by running the app
- **ADB requirement:** Device features require ADB to be installed and in PATH
- **Single platform downloads:** Only downloads APKs (no iOS support)

## Notes

- Bitrise API client exists in both frontend (`src/api/bitrise.ts`) and backend (`src-tauri/src/bitrise.rs`)
- No test suite exists — changes should be verified manually
- ADB integration uses `std::process::Command`, not the Tauri shell plugin
- Dark mode is always on (Tailwind `class` strategy, `<html class="dark">`)
- All API calls go through the Rust backend (Tauri commands) for security and capability access
