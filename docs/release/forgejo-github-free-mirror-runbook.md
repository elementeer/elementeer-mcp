# Forgejo to GitHub Mirror Runbook

## Purpose

This runbook turns the mirror strategy into an operational release procedure.

It covers three mirror paths:

1. **MCP Server Free Mirror** — public GitHub mirror of the Free MCP surface (47 tools, public docs only)
2. **WP Plugin Mirror** — public GitHub mirror of the WordPress plugin (standalone, GPL-2.0-or-later)
3. **Private Full Mirror** — private GitHub mirror of the complete repository (backup, all tiers)

It assumes:

- Forgejo is the canonical private primary repository
- GitHub hosts public `Free` mirrors for discovery and distribution
- `Advanced` and `studio_future` remain private in public mirrors
- Private full mirrors on GitHub serve as operational backup

## Operators

- release operator on the private Forgejo primary
- optional reviewer for public mirror publication

## Preconditions

Before starting a mirror release:

1. The target commit on Forgejo is the intended release candidate.
2. Free and Advanced tier boundaries are green in the primary repo.
3. Public docs and manifest entries are in sync.
4. The mirror dry-run is deterministic: the staging directory is cleaned first, and the staged Free surface does not contain time-based metadata.
5. The normal repo build completes cleanly before mirror publication.

## Lifecycle

Follow this sequence for every Free mirror publication:

1. Preflight
2. Release gate
3. Staging dry-run
4. Publication
5. Post-publish verification

Expected outputs by stage:

- Preflight: chosen Forgejo commit or tag, green tier boundaries, synced docs and manifest
- Release gate: successful `npm run release:free-mirror:gate` run with no failed step
- Staging dry-run: `mirror/generated/free-public/` populated from a clean directory with deterministic file contents
- Publication: public GitHub mirror updated from the exact approved staging artifact
- Post-publish verification: public mirror matches the staged file set and remains buildable

## Release Gate Command

Run the full Free gate bundle from the primary repository root:

```bash
npm run release:free-mirror:gate
```

This runs:

1. build
2. Free contract tests
3. Free mirror verification
4. Free mirror staging preparation
5. Free release verification

Successful output should confirm:

- build completed cleanly
- Free contract tests passed
- mirror verification passed
- staging artifact prepared at `mirror/generated/free-public/`
- release verification passed

## Staging Output

The staged public artifact is generated under:

```text
mirror/generated/free-public/
```

Expected key files:

- `README.md`
- `free-tool-surface.json`
- all docs listed in `mirror/free-mirror.manifest.json -> publicDocumentation`

## Publication Flow

### 1. Verify the candidate on Forgejo

- check the intended commit or tag
- run `npm run release:free-mirror:gate`
- inspect `mirror/generated/free-public/`
- confirm the staged file list matches the manifest exactly

### 2. Sanity-check the public narrative

- confirm `README.md` centers the public `Free` surface and does not promise active Advanced or Studio behavior
- confirm the public quickstart is present
- confirm no Advanced or Studio promises appear in staged docs

### 3. Publish to GitHub mirror

- push the approved mirror content or mirror branch to the public GitHub repository
- keep the publication tied to the exact Forgejo release candidate

### 4. Post-publish verification

- confirm the GitHub mirror matches the staged Free artifact
- confirm the public repo remains buildable
- confirm the published docs set matches the manifest

## Failure Gates

Stop the publication flow immediately if any of the following occur:

- the build fails
- `npm run release:free-mirror:gate` fails
- the staging directory is not clean before dry-run generation
- the staged artifact includes stale files or time-based metadata
- the staged file list drifts from `mirror/free-mirror.manifest.json`
- a staged doc implies Advanced or Studio behavior
- the public mirror no longer matches the approved staging artifact

## Stop Conditions

Do not publish if:

- `release:free-mirror:gate` fails
- the staged artifact contains private docs
- the staged README or quickstart promises active Advanced or Studio behavior instead of treating them as private or future layers
- the public tool surface does not match `registerFreeTools`
- the staged dry-run includes stale files or time-based metadata
- the normal build does not complete cleanly

## Notes

- This runbook is private operational documentation and must not be part of the public mirror docs set.
- The staged artifact is the source of truth for what should appear in the public GitHub mirror.

---

## Mirror Path 2: WP Plugin Mirror

### Release Gate Command

```bash
npm run plugin-mirror:gate
```

This runs:

1. Plugin mirror verification (`verify:plugin-mirror`)
2. Plugin mirror staging preparation (`prepare:plugin-mirror`)

### Staging Output

```text
mirror/generated/plugin-public/plugin/
```

Contains: `elementeer.php`, `composer.json`, `readme.txt`, `includes/`, `assets/`, `README.md`, `plugin-mirror-manifest.json`

### Publication Flow

1. Run `npm run plugin-mirror:gate` on Forgejo primary
2. Inspect `mirror/generated/plugin-public/plugin/` for completeness
3. Push staged plugin to public GitHub mirror repository (`elementeer/elementeer`)
4. Verify WordPress.org compatibility: `readme.txt` header is correct

### Stop Conditions

- Plugin bootstrap file (`elementeer.php`) missing
- `plugin/composer.json` license is not `GPL-2.0-or-later`
- `plugin/readme.txt` contains "elementify" references
- Plugin verification script fails

---

## Mirror Path 3: Private Full Mirror (Backup)

### Purpose

A complete private mirror on GitHub serves as an operational backup of the entire Forgejo primary. It contains ALL tiers (Free + Advanced + Studio Future) and ALL code — no filtering.

### How It Works

From the Forgejo primary:

```bash
git remote add github-mirror git@github.com:elementeer/elementeer-mcp.git
git push --mirror github-mirror
```

Or via CI/CD workflow on Forgejo Actions (every push to main):

```yaml
name: Private Mirror to GitHub
on:
  push:
    branches: [main]
jobs:
  mirror:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - run: |
          git remote add github-mirror https://${{ secrets.GH_MIRROR_TOKEN }}@github.com/elementeer/elementeer-mcp.git
          git push --mirror github-mirror
```

### Stop Conditions

- Only if GitHub is unreachable — this is a best-effort backup
