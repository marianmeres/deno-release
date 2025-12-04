# @marianmeres/deno-release

## Overview

- **Type**: CLI tool
- **Runtime**: Deno
- **Registry**: JSR (jsr:@marianmeres/deno-release)
- **Entry point**: `deno-release.ts`
- **Purpose**: Automate semantic version releases for Deno projects

## Package Structure

```
@marianmeres/deno-release/
├── deno.json          # Package manifest with version, exports, formatting config
├── deno-release.ts    # Main executable script (shebang: #!/usr/bin/env -S deno run -A)
├── README.md          # User documentation
└── AGENTS.md          # This file
```

## CLI Interface

### Invocation

```bash
deno run -A jsr:@marianmeres/deno-release <version-type> [custom-message]
```

### Arguments

| Position | Name           | Required | Values                       | Description                          |
|----------|----------------|----------|------------------------------|--------------------------------------|
| 1        | version-type   | Yes      | `major`, `minor`, `patch`    | Semantic version component to bump   |
| 2+       | custom-message | No       | Any string (space-separated) | Appended to commit/tag message       |

### Exit Codes

| Code | Meaning                                      |
|------|----------------------------------------------|
| 0    | Success or user cancelled                    |
| 1    | Error (invalid args, dirty git, missing files) |

## Exported API

### Types

```typescript
export type VersionType = "major" | "minor" | "patch";
```

### Functions

```typescript
export function bumpVersion(current: string, type: VersionType): string;
```

- **Input**: Semver string (e.g., "1.2.3") and bump type
- **Output**: New version string
- **Behavior**: Increments specified component, resets lower components to 0
- **Side effects**: Calls `Deno.exit(1)` on invalid version format

## Execution Flow

1. **Parse arguments**: Extract version type and optional message from `Deno.args`
2. **Validate version type**: Must be "major", "minor", or "patch"
3. **Check git repository**: Verify `.git` directory exists
4. **Check deno.json**: Verify file exists
5. **Check git status**: Fail if uncommitted changes exist (uses `git status --porcelain`)
6. **Check branch**: Warn if not on `main` or `master`, prompt to continue
7. **Read current version**: Parse `version` field from `deno.json`
8. **Calculate new version**: Apply bump logic
9. **Confirm with user**: Show preview, require "y" to proceed
10. **Update deno.json**: Write new version with 2-space indentation + trailing newline
11. **Git operations**:
    - `git add deno.json`
    - `git commit -m "Release: X.Y.Z [(custom message)]"`
    - `git tag -a vX.Y.Z -m "Release: X.Y.Z [(custom message)]"`
12. **Push to remote**:
    - `git push`
    - `git push --tags`

## Dependencies

- **External**: None (zero dependencies)
- **Deno APIs used**:
  - `Deno.args` - CLI arguments
  - `Deno.Command` - Shell command execution
  - `Deno.stat` - File/directory existence check
  - `Deno.readTextFile` - Read deno.json
  - `Deno.writeTextFile` - Write deno.json
  - `Deno.exit` - Process termination
  - `prompt` - User input (built-in)

## Requirements for Target Projects

- Must have `deno.json` in working directory
- `deno.json` must contain `"version"` field with valid semver (X.Y.Z)
- Must be inside a git repository (`.git` directory)
- Working tree must be clean (no uncommitted changes)
- Git remote must be configured for push

## Output Format

- Uses ANSI escape codes for colored terminal output:
  - Red (`\x1b[31m`): Errors
  - Green (`\x1b[32m`): Success messages, new version
  - Yellow (`\x1b[33m`): Warnings
  - Bold (`\x1b[1m`): Emphasis

## Commit/Tag Message Format

- Without custom message: `Release: X.Y.Z`
- With custom message: `Release: X.Y.Z (custom message here)`
- Tag name format: `vX.Y.Z` (prefixed with "v")

## Configuration

- **Formatting** (in deno.json):
  - Uses tabs for indentation
  - Line width: 90 characters
  - Indent width: 4
  - Prose wrap: preserve

## Limitations

- Only supports standard semver (X.Y.Z), no pre-release or build metadata
- Only checks for `main` or `master` branch names
- Writes deno.json with 2-space indentation (not configurable)
- No dry-run mode
- No support for monorepos or workspaces
- No changelog generation
