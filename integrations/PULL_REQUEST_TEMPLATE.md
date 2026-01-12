# OpenCode Integration for SpecStory CLI

## Summary

This PR adds support for OpenCode (opencode.ai) to the SpecStory CLI, enabling automatic session capture and saving to `.specstory/history/`.

## Background

OpenCode is an open-source AI coding agent similar to Claude Code. Many users use multiple AI coding tools and would benefit from having OpenCode sessions saved alongside Claude Code, Cursor CLI, and Codex CLI sessions.

## Changes

### CLI Integration

Added OpenCode as a supported agent in the SpecStory CLI wrapper:

```bash
specstory run opencode    # Launch OpenCode with auto-save
specstory run opencode "fix bug"  # With initial prompt
OPENCODE_AGENT=plan specstory run opencode  # Plan mode
```

### Implementation Details

1. **Wrapper Script**: Created `scripts/specstory-opencode` that wraps the OpenCode binary
2. **Session Capture**: Automatically saves sessions to `.specstory/history/` in markdown format
3. **Format Compatibility**: Sessions use the same format as other supported tools (Claude Code, Cursor CLI)
4. **Environment Variables**: Supports `OPENCODE_BIN` and `OPENCODE_AGENT` for customization

### Files Changed

- `scripts/specstory-opencode` - New wrapper script
- `README.md` - Updated documentation

## Testing

Tested on:
- [x] macOS (Apple Silicon)
- [x] macOS (Intel)
- [x] Linux (x86_64)
- [x] Linux (arm64)

## Usage Example

```bash
# Install OpenCode
curl -fsSL https://opencode.ai/install | bash

# Run with SpecStory
specstory run opencode

# Work normally
# > Fix the bug in src/app.js
# ... conversation ...

# Session automatically saved to:
# .specstory/history/2026-01-10_12-00-00Z-project-name.md
```

## Alternative Installation

For users who want to try this before the PR is merged:

```bash
# Download wrapper
curl -o ~/.local/bin/specstory-opencode \
  https://raw.githubusercontent.com/ankurkakroo2/particle-test/main/integrations/specstory-opencode-wrapper.sh
chmod +x ~/.local/bin/specstory-opencode

# Add to PATH
export PATH="$HOME/.local/bin:$PATH"

# Use standalone or integrate with SpecStory
specstory-opencode run
```

## Checklist

- [x] Follows existing code style
- [x] Compatible with existing SpecStory infrastructure
- [x] Sessions saved in same format as other tools
- [x] Cloud sync works (no changes needed)
- [x] Documentation updated
- [x] Tested on multiple platforms

## Related

- OpenCode: https://opencode.ai
- SpecStory: https://specstory.com
- OpenCode GitHub: https://github.com/anomalyco/opencode
