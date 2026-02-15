# Bitrise Artifacts - Project Documentation

## Project Overview
Tauri desktop app for managing Bitrise Android build artifacts. Browse builds, download APKs, install to devices via ADB.

## Architecture

### Frontend (React + TypeScript)
- **src/App.tsx**: Main app component, manages global state
- **src/components/**: UI components
  - `Sidebar.tsx`: App selector sidebar
  - `BuildList.tsx`: Builds grouped by branch
  - `ArtifactPanel.tsx`: Artifact download/install panel
  - `SettingsModal.tsx`: API token configuration
  - `DeviceBar.tsx`: ADB device status bar
- **src/api/index.ts**: Tauri command wrappers
- **src/types/index.ts**: TypeScript type definitions

### Backend (Rust)
- **src-tauri/src/main.rs**: Tauri app entry point
- **src-tauri/src/commands.rs**: Tauri command handlers
- **src-tauri/src/bitrise.rs**: Bitrise API client
- **src-tauri/src/adb.rs**: ADB integration
- **src-tauri/src/fs.rs**: File system & settings persistence

## Key Commands

```bash
# Development
npm run tauri-dev          # Run dev mode
npm run dev               # Frontend only

# Building
npm run tauri-build       # Build production app
npm run build             # Build frontend only

# Setup
./setup.sh                # Initial setup script
```

## Data Flow
1. User enters API token → `saveSettings()` → ~/.bitrise-artifacts/settings.json
2. Token sent to Rust → BitriseClient initialized
3. Fetch apps → display in sidebar
4. Select app → fetch builds → group by branch
5. Select build → fetch artifacts → filter APKs
6. Download/install APK → invoke Rust command → ADB or file system

## Environment Requirements
- Node.js v18+
- Rust (latest stable)
- ADB (Android Platform Tools)

## Configuration
Settings stored in: `~/.bitrise-artifacts/settings.json`
```json
{
  "api_token": "your_token_here",
  "selected_app_slug": "optional-app-slug"
}
```

## API Endpoints Used
- GET /v0.1/apps
- GET /v0.1/apps/{slug}/builds
- GET /v0.1/apps/{slug}/builds/{build}/artifacts
- GET /v0.1/apps/{slug}/builds/{build}/artifacts/{artifact}

## Styling
- Tailwind CSS with custom dark theme
- Colors defined in tailwind.config.js
- Dark mode by default (class strategy)

## Testing Checklist
- [ ] Settings save/load
- [ ] App list fetch
- [ ] Build list fetch with grouping
- [ ] Artifact list fetch
- [ ] APK download
- [ ] Device detection
- [ ] APK install via ADB
- [ ] Error handling for network failures
- [ ] UI responsiveness