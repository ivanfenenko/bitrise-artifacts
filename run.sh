#!/bin/bash

# Bitrise Artifacts - Run Script
# Usage: ./run.sh [restart|clean]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="Bitrise Artifacts"
PID_FILE=".tauri-dev.pid"

# Helper functions
log_info() {
    echo -e "${BLUE}ℹ${NC}  $1"
}

log_success() {
    echo -e "${GREEN}✓${NC}  $1"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC}  $1"
}

log_error() {
    echo -e "${RED}✗${NC}  $1"
}

# Cleanup function
cleanup() {
    log_info "Cleaning up..."
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE" 2>/dev/null || echo "")
        if [ -n "$PID" ] && ps -p "$PID" > /dev/null 2>&1; then
            kill "$PID" 2>/dev/null || true
            wait "$PID" 2>/dev/null || true
        fi
        rm -f "$PID_FILE"
    fi
    
    # Kill any remaining tauri processes
    pkill -f "tauri dev" 2>/dev/null || true
    
    log_success "Cleanup complete"
}

# Set trap for cleanup on exit
trap cleanup EXIT INT TERM

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed"
        echo "   Install from: https://nodejs.org/ (v18+ required)"
        exit 1
    fi
    
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        log_error "Node.js version too old: $(node -v)"
        echo "   Please upgrade to v18 or higher"
        exit 1
    fi
    log_success "Node.js $(node -v)"
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        log_error "npm is not installed"
        exit 1
    fi
    log_success "npm $(npm -v)"
    
    # Check Rust
    if ! command -v rustc &> /dev/null; then
        log_error "Rust is not installed"
        echo "   Install from: https://rustup.rs/"
        exit 1
    fi
    log_success "Rust $(rustc --version | cut -d' ' -f2)"
    
    # Check ADB (optional but recommended)
    if ! command -v adb &> /dev/null; then
        log_warning "ADB not found - device installation will not work"
        echo "   Install: brew install android-platform-tools"
    else
        log_success "ADB $(adb version | head -n1 | cut -d' ' -f5)"
    fi
}

# Install dependencies
install_deps() {
    if [ ! -d "node_modules" ]; then
        log_info "Installing dependencies..."
        npm install
        log_success "Dependencies installed"
    else
        log_info "Dependencies already installed"
    fi
}

# Clean build artifacts
clean() {
    log_info "Cleaning build artifacts..."
    
    rm -rf node_modules
    rm -rf dist
    rm -rf src-tauri/target
    rm -f "$PID_FILE"
    
    log_success "Clean complete"
    echo ""
    log_info "Run './run.sh' to rebuild from scratch"
}

# Run the app
run_app() {
    log_info "Starting $APP_NAME..."
    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  $APP_NAME Development Server${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
    echo ""
    
    # Store the npm run process ID
    npm run tauri-dev &
    NPM_PID=$!
    echo $NPM_PID > "$PID_FILE"
    
    log_success "App started (PID: $NPM_PID)"
    log_info "Press Ctrl+C to stop"
    echo ""
    
    # Wait for the process
    wait $NPM_PID
}

# Restart the app
restart_app() {
    log_info "Restarting $APP_NAME..."
    cleanup
    sleep 1
    run_app
}

# Watch mode with auto-restart
watch_mode() {
    log_info "Starting in watch mode..."
    
    while true; do
        run_app
        EXIT_CODE=$?
        
        if [ $EXIT_CODE -eq 0 ]; then
            log_info "App exited normally"
            break
        else
            log_warning "App crashed with exit code $EXIT_CODE"
            log_info "Restarting in 3 seconds... (Press Ctrl+C to stop)"
            sleep 3
            cleanup
        fi
    done
}

# Main function
main() {
    local command="${1:-run}"
    
    case "$command" in
        run|start)
            check_prerequisites
            install_deps
            run_app
            ;;
        restart)
            restart_app
            ;;
        watch)
            check_prerequisites
            install_deps
            watch_mode
            ;;
        clean)
            clean
            ;;
        help|--help|-h)
            echo "Usage: ./run.sh [command]"
            echo ""
            echo "Commands:"
            echo "  run, start    Start the app (default)"
            echo "  restart       Stop and restart the app"
            echo "  watch         Run with auto-restart on crash"
            echo "  clean         Remove all build artifacts"
            echo "  help          Show this help message"
            echo ""
            echo "Examples:"
            echo "  ./run.sh              # Start the app"
            echo "  ./run.sh restart      # Restart the app"
            echo "  ./run.sh clean        # Clean build files"
            ;;
        *)
            log_error "Unknown command: $command"
            echo "Run './run.sh help' for usage information"
            exit 1
            ;;
    esac
}

# Run main with all arguments
main "$@"