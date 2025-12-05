# @marianmeres/deno-release

An opinionated, interactive CLI tool for releasing Deno projects. Bumps the version
in `deno.json`, creates an annotated git tag, and pushes everything to the remote
repository.

## Features

- Semantic versioning (`major`, `minor`, `patch`)
- Interactive confirmation before making changes
- Non-interactive mode with `--yes` flag for CI/CD pipelines
- Validates clean git state (no uncommitted changes)
- Warns when not on `main`/`master` branch
- Creates annotated git tags with optional custom message
- Pushes commits and tags to remote

## Usage

### Via `deno run`

```bash
# Patch release (1.0.0 -> 1.0.1)
deno run -A jsr:@marianmeres/deno-release patch

# Minor release (1.0.0 -> 1.1.0)
deno run -A jsr:@marianmeres/deno-release minor

# Major release (1.0.0 -> 2.0.0)
deno run -A jsr:@marianmeres/deno-release major

# With custom message
deno run -A jsr:@marianmeres/deno-release patch "Fixed critical bug"

# Skip confirmation prompts (useful for CI/CD)
deno run -A jsr:@marianmeres/deno-release --yes patch
deno run -A jsr:@marianmeres/deno-release -y minor "New feature"
```

### As a Deno task

Add to your `deno.json`:

```json
{
  "tasks": {
    "release": "deno run -A jsr:@marianmeres/deno-release"
  }
}
```

Then run:

```bash
deno task release patch
deno task release minor "Added new feature"
```

### Install globally

```bash
deno install -A -g -n release jsr:@marianmeres/deno-release
```

Then use anywhere:

```bash
release patch
release minor "New feature"
release --yes patch  # non-interactive
```

## API

The package also exports a `bumpVersion` utility function:

```ts
import { bumpVersion, type VersionType } from "jsr:@marianmeres/deno-release";

bumpVersion("1.2.3", "patch"); // "1.2.4"
bumpVersion("1.2.3", "minor"); // "1.3.0"
bumpVersion("1.2.3", "major"); // "2.0.0"
```

## Requirements

- Your project must have a `deno.json` with a `version` field
- Must be inside a git repository
- All changes must be committed before releasing

## What it does

1. Validates you're in a git repo with `deno.json`
2. Checks for uncommitted changes (exits if any)
3. Warns if not on `main`/`master` branch
4. Shows preview of changes and asks for confirmation
5. Updates `version` in `deno.json`
6. Commits the change with message `Release: X.Y.Z`
7. Creates annotated tag `vX.Y.Z`
8. Pushes commit and tags to remote

## License

MIT
