#!/bin/bash

# Setup script for Bitrise Artifacts Manager

set -e

echo "🚀 Setting up Bitrise Artifacts Manager..."

# Check Node.js version
echo "📦 Checking Node.js..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js v18 or higher."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version is too old. Please upgrade to v18 or higher."
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Check Rust
echo "🦀 Checking Rust..."
if ! command -v rustc &> /dev/null; then
    echo "❌ Rust is not installed. Installing..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source $HOME/.cargo/env
fi

echo "✅ Rust $(rustc --version) detected"

# Check ADB
echo "📱 Checking ADB..."
if ! command -v adb &> /dev/null; then
    echo "⚠️  ADB not found. You can install it via:"
    echo "   - macOS: brew install android-platform-tools"
    echo "   - Or download from: https://developer.android.com/tools/releases/platform-tools"
else
    echo "✅ ADB $(adb version | head -n1) detected"
fi

# Install dependencies
echo "📥 Installing dependencies..."
npm install

# Create config directory
echo "📁 Creating config directory..."
mkdir -p ~/.bitrise-artifacts

echo ""
echo "✨ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Get your Bitrise API token from: https://app.bitrise.io/me/profile#/security"
echo "2. Run: npm run tauri-dev"
echo "3. Enter your API token in the settings"
echo ""
echo "Happy building! 🎉"