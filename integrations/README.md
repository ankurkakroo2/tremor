# OpenCode Support for SpecStory CLI

## Overview

This PR adds support for OpenCode (opencode.ai) to the SpecStory CLI, allowing users to automatically save OpenCode sessions to `.specstory/history/`.

## Changes

### 1. Update CLI to support OpenCode

Modify the CLI wrapper to recognize and support OpenCode as an agent.

## Usage

After this PR is merged, users can use:

```bash
specstory run opencode          # Run OpenCode with auto-save
specstory run opencode "fix bug" # Run with initial prompt
OPENCODE_AGENT=plan specstory run opencode  # Use plan agent
```

## Alternative: Standalone Wrapper

If you want to use OpenCode with SpecStory without waiting for this PR:

```bash
# Save as ~/.local/bin/specstory-opencode
curl -o ~/.local/bin/specstory-opencode https://raw.githubusercontent.com/ankurkakroo2/particle-test/main/integrations/specstory-opencode-wrapper.sh
chmod +x ~/.local/bin/specstory-opencode

# Option 1: Add to PATH
export PATH="$HOME/.local/bin:$PATH"

# Option 2: Create alias
alias specstory-opencode='OPENCODE_BIN=/Users/ankur/.opencode/bin/opencode ~/.local/bin/specstory-opencode'

# Usage
specstory-opencode run "fix the bug in src/app.js"
```

## Installation

### Option 1: Add to PATH (Recommended)

```bash
# Download the wrapper
curl -o /usr/local/bin/specstory-opencode \
  https://raw.githubusercontent.com/ankurkakroo2/particle-test/main/integrations/specstory-opencode-wrapper.sh

chmod +x /usr/local/bin/specstory-opencode

# Create a symlink that integrates with SpecStory
ln -sf /usr/local/bin/specstory-opencode /usr/local/bin/opencode

# Now use:
specstory run opencode
# or just:
opencode
```

### Option 2: As SpecStory run command

The wrapper script intercepts OpenCode and saves sessions automatically.

## Session Format

Sessions are saved to `.specstory/history/` in markdown format:

```markdown
---
title: OpenCode Session - my-project
date: 2026-01-10T12:00:00Z
tool: opencode
agent: build
---

# OpenCode Session - my-project

**Started:** 2026-01-10 12:00:00 UTC  
**Directory:** /path/to/project  
**Agent:** build

---

## Conversation

[Captured output]

---

**Session ended:** 2026-01-10 12:05:00 UTC
```

## Requirements

- OpenCode installed (https://opencode.ai/install)
- SpecStory CLI installed
- Write access to `.specstory/history/` in project directory

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENCODE_BIN` | Path to OpenCode binary | `~/.opencode/bin/opencode` |
| `OPENCODE_AGENT` | Agent mode (build/plan) | `build` |
| `SPECSTORY_DIR` | SpecStory history directory | `.specstory/history` |

## Integration with Existing SpecStory

This wrapper is designed to work alongside existing SpecStory functionality:

1. Sessions are saved in the same format as Claude Code, Cursor CLI, etc.
2. Cloud sync works the same way
3. Search and sharing work identically

## License

MIT License - Same as SpecStory project.
