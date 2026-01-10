#!/bin/bash
#
# Install SpecStory + OpenCode Integration
#
# This script installs the OpenCode wrapper for SpecStory CLI integration.
#

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WRAPPER_SCRIPT="$SCRIPT_DIR/specstory-opencode-wrapper.sh"
INSTALL_DIR="${1:-$HOME/.local/bin}"
SPECSTORY_BIN=""

# Find SpecStory installation
find_specstory() {
    # Check common locations
    local paths=(
        "/usr/local/bin/specstory"
        "$HOME/.local/bin/specstory"
        "$HOME/bin/specstory"
    )
    
    for path in "${paths[@]}"; do
        if [ -f "$path" ]; then
            SPECSTORY_BIN="$path"
            return 0
        fi
    done
    
    # Try which
    SPECSTORY_BIN=$(which specstory 2>/dev/null || true)
    
    if [ -z "$SPECSTORY_BIN" ]; then
        return 1
    fi
    return 0
}

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[Install]${NC} $1"; }
warn() { echo -e "${YELLOW}[Install]${NC} $1"; }
error() { echo -e "${RED}[Error]${NC} $1"; }

# Main installation
main() {
    log "Installing SpecStory + OpenCode Integration..."
    
    # Create install directory
    if [ ! -d "$INSTALL_DIR" ]; then
        mkdir -p "$INSTALL_DIR"
    fi
    
    # Copy wrapper script
    log "Installing wrapper to: $INSTALL_DIR/specstory-opencode"
    cp "$WRAPPER_SCRIPT" "$INSTALL_DIR/specstory-opencode"
    chmod +x "$INSTALL_DIR/specstory-opencode"
    
    # Find SpecStory installation
    if find_specstory; then
        log "Found SpecStory at: $SPECSTORY_BIN"
        
        # Check if we need to add OpenCode support
        if grep -q "opencode" "$SPECSTORY_BIN" 2>/dev/null; then
            log "SpecStory already supports OpenCode!"
        else
            warn "SpecStory doesn't seem to support OpenCode natively."
            info "Using standalone wrapper instead."
        fi
    else
        warn "SpecStory CLI not found."
        info "The wrapper will work as a standalone tool."
    fi
    
    echo ""
    log "✅ Installation complete!"
    echo ""
    echo "Usage:"
    echo "  $INSTALL_DIR/specstory-opencode run"
    echo "  $INSTALL_DIR/specstory-opencode 'fix the bug'"
    echo ""
    echo "To add to PATH:"
    echo "  echo 'export PATH=\"$INSTALL_DIR:\$PATH\"' >> ~/.zshrc"
    echo ""
    echo "Or create an alias:"
    echo "  alias opencode='$INSTALL_DIR/specstory-opencode'"
    echo ""
}

main
