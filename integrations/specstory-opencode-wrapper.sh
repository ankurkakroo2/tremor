#!/bin/bash
#
# OpenCode wrapper for SpecStory CLI integration
# This script wraps OpenCode to save sessions to .specstory/history/
#
# Usage:
#   specstory run opencode        # Launch OpenCode with auto-save
#   specstory run opencode "..."  # Launch with initial prompt
#
# Environment Variables:
#   OPENCODE_BIN     Path to OpenCode binary (default: ~/.opencode/bin/opencode)
#   OPENCODE_AGENT   Agent mode: build or plan (default: build)
#   SPECSTORY_DIR    SpecStory history directory (default: .specstory/history)
#

set -e

# Configuration
OPENCODE_BIN="${OPENCODE_BIN:-$HOME/.opencode/bin/opencode}"
SPECSTORY_DIR="${SPECSTORY_DIR:-.specstory/history}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${GREEN}[SpecStory]${NC} $1"; }
warn() { echo -e "${YELLOW}[SpecStory]${NC} $1"; }
info() { echo -e "${BLUE}[SpecStory]${NC} $1"; }

# Generate session filename
generate_session_file() {
    local timestamp=$(date -u +"%Y-%m-%d_%H-%M-%SZ")
    local sanitized_pwd=$(echo "$PWD" | tr '/' '_' | sed 's/^_//')
    echo "${SPECSTORY_DIR}/${timestamp}-${sanitized_pwd}.md"
}

# Save session metadata and capture
save_session() {
    local exit_code=$1
    shift
    local args="$*"
    
    # Ensure directory exists
    [ ! -d "$SPECSTORY_DIR" ] && mkdir -p "$SPECSTORY_DIR"
    
    local session_file=$(generate_session_file)
    
    # Write session file in SpecStory format
    cat > "$session_file" << EOF
---
title: OpenCode Session - $(basename "$PWD")
date: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
tool: opencode
agent: ${OPENCODE_AGENT:-build}
exit_code: $exit_code
---

# OpenCode Session - $(basename "$PWD")

**Started:** $(date -u +"%Y-%m-%d %H:%M:%S UTC")  
**Directory:** $PWD  
**Agent:** ${OPENCODE_AGENT:-build}  
**Command:** opencode $args

---

## Conversation

EOF

    log "Session saved to: $session_file"
}

# Check OpenCode installation
check_opencode() {
    if [ ! -f "$OPENCODE_BIN" ]; then
        warn "OpenCode not found at: $OPENCODE_BIN"
        info "Install from: https://opencode.ai/install"
        info "Or set OPENCODE_BIN environment variable"
        return 1
    fi
    return 0
}

# Main wrapper
main() {
    local args="$*"
    
    # Check for help flag
    for arg in "$@"; do
        case "$arg" in
            --help|-h|--version)
                "$OPENCODE_BIN" "$@"
                exit $?
                ;;
        esac
    done
    
    # Check OpenCode
    if ! check_opencode; then
        warn "Falling back to direct OpenCode..."
        exec "$OPENCODE_BIN" "$@"
    fi
    
    info "Starting OpenCode with SpecStory session capture..."
    info "Sessions will be saved to: $SPECSTORY_DIR"
    echo ""
    
    # Run OpenCode
    "$OPENCODE_BIN" "$@"
    local exit_code=$?
    
    echo ""
    save_session $exit_code $args
    
    exit $exit_code
}

main "$@"
