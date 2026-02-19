# Bitrise Artifacts Manager

A modern Tauri desktop application for managing Bitrise Android build artifacts. Browse builds, download APKs, and install them directly to connected Android devices via ADB.

![License](https://img.shields.io/badge/license-MIT-blue.svg)

## Features

- **Browse Bitrise Apps**: Connect using your Personal Access Token and browse your Bitrise apps
- **View Builds by Branch**: Builds are automatically grouped by branch for easy navigation
- **Download APKs**: Download Android artifacts directly to your local machine
- **ADB Integration**: Install APKs directly to connected Android devices
- **Dark Mode**: Modern dark UI optimized for developer workflows
- **Persistent Settings**: Save your API token and selected app between sessions

## Tech Stack

- **Backend**: Rust with Tauri v2
- **Frontend**: React + TypeScript + Tailwind CSS
- **API**: Bitrise REST API v0.1
- **ADB**: Android Debug Bridge integration

## Prerequisites

Before you begin, ensure you have the following installed:

### Required

- **Node.js** (v18 or higher)
  ```bash
  node --version
  ```

- **Rust** (latest stable)
  ```bash
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
  ```

- **ADB** (Android Debug Bridge)
  - Install Android SDK Platform Tools from [developer.android.com](https://developer.android.com/tools/releases/platform-tools)
  - Or via Homebrew: `brew install android-platform-tools`

### Recommended

- **Tauri CLI** (optional, for building)
  ```bash
  cargo install tauri-cli
  ```

## Installation

### Download Pre-built Binaries

Download the latest release from the [Releases page](https://github.com/ivanfenenko/bitrise-artifacts/releases).

**Available for:**
- macOS (Intel, Apple Silicon, Universal)
- Windows (64-bit)
- Linux (Debian, RPM, AppImage)

#### macOS Installation Notes

Since the app is not signed with an Apple Developer certificate, you'll see a security warning on first launch. To open the app:

**Method 1: Right-click to open**
1. Right-click (or Control+click) on "Bitrise Artifacts"
2. Select "Open"
3. Click "Open" in the dialog

**Method 2: System Settings**
1. Try to open the app (it will be blocked)
2. Go to System Settings → Privacy & Security
3. Scroll down to find "Bitrise Artifacts was blocked"
4. Click "Open Anyway"

**Method 3: Command line**
```bash
xattr -cr "/Applications/Bitrise Artifacts.app"
```

### Development Setup

#### Option 1: Quick Setup (Recommended)

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd bitrise-artifacts
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run in development mode**
   ```bash
   npm run tauri-dev
   ```

#### Option 2: Manual Project Setup

If you want to recreate the project from scratch:

1. **Create a new Tauri project**
   ```bash
   npm create tauri-app@latest bitrise-artifacts -- --template react-ts
   cd bitrise-artifacts
   ```

2. **Install additional dependencies**
   ```bash
   npm install lucide-react date-fns
   npm install -D tailwindcss postcss autoprefixer
   npx tailwindcss init -p
   ```

3. **Copy the source files** from this repository into your project

4. **Run the app**
   ```bash
   npm run tauri-dev
   ```

## Configuration

### Getting Your Bitrise API Token

1. Go to [Bitrise Account Settings](https://app.bitrise.io/me/profile#/security)
2. Scroll down to "Personal access tokens"
3. Click "Generate new token"
4. Give it a name (e.g., "Artifacts Manager")
5. Copy the token and paste it into the app settings

### Connecting an Android Device

1. Enable **Developer Options** on your Android device
2. Enable **USB Debugging**
3. Connect your device via USB
4. Accept the USB debugging prompt on your device
5. The device will appear in the bottom bar of the app

## Development

### Project Structure

```
bitrise-artifacts/
├── src/                          # Frontend (React)
│   ├── components/               # React components
│   ├── api/                      # API wrapper
│   ├── types/                    # TypeScript types
│   ├── App.tsx                   # Main app component
│   ├── main.tsx                  # Entry point
│   └── styles.css                # Global styles
├── src-tauri/                    # Backend (Rust)
│   ├── src/
│   │   ├── main.rs               # Tauri entry point
│   │   ├── commands.rs           # Tauri commands
│   │   ├── bitrise.rs            # Bitrise API client
│   │   ├── adb.rs                # ADB integration
│   │   └── fs.rs                 # File system utilities
│   ├── Cargo.toml              # Rust dependencies
│   └── tauri.conf.json         # Tauri configuration
├── package.json
└── README.md
```

### Available Scripts

```bash
# Run in development mode
npm run tauri-dev

# Build the application
npm run tauri-build

# Run frontend only
npm run dev

# Build frontend only
npm run build
```

### Building for Production

**macOS:**
```bash
npm run tauri-build
# Output: src-tauri/target/release/bundle/macos/Bitrise Artifacts.app
```

**Windows:**
```bash
npm run tauri-build
# Output: src-tauri/target/release/bundle/msi/*.msi
```

**Linux:**
```bash
npm run tauri-build
# Output: src-tauri/target/release/bundle/deb/*.deb
```

## Troubleshooting

### ADB not found

If you get "ADB not found" errors:

1. Verify ADB is installed: `adb --version`
2. Make sure ADB is in your PATH
3. On macOS/Linux, you may need to add to `~/.zshrc` or `~/.bashrc`:
   ```bash
   export PATH="$PATH:$HOME/Library/Android/sdk/platform-tools"
   ```

### API Token Issues

- Ensure your token hasn't expired
- Check that you have access to the Bitrise apps you're trying to view
- Verify the token has the correct permissions

### Build Errors

If you encounter build errors:

1. **Update Rust**: `rustup update`
2. **Clear cache**: `rm -rf node_modules src-tauri/target && npm install`
3. **Check Node version**: Must be v18 or higher

## API Reference

The app uses the following Bitrise API endpoints:

- `GET /v0.1/apps` - List apps
- `GET /v0.1/apps/{app-slug}/builds` - List builds
- `GET /v0.1/apps/{app-slug}/builds/{build-slug}/artifacts` - List artifacts
- `GET /v0.1/apps/{app-slug}/builds/{build-slug}/artifacts/{artifact-slug}` - Get artifact download URL

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - feel free to use this project for personal or commercial purposes.

## Acknowledgments

- [Tauri](https://tauri.app/) - For the amazing desktop app framework
- [Bitrise](https://bitrise.io/) - For the CI/CD platform and API
- [Lucide](https://lucide.dev/) - For the beautiful icons