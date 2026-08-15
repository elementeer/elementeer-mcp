#!/bin/bash
# SkillWeave Release Gate — tag version check
# Enforces: capability.yaml version == package.json version
#           new tag > existing tag on origin (semver)
#           tag does NOT already exist on origin (unless --force)
# Usage: bash scripts/release-check.sh [--force]

set -euo pipefail

FORCE="${1:-}"

# LVC-209: the version locations live in .version.yaml. Both this gate and the
# bump tool read the SAME declaration via version-sync.py, so they cannot
# drift from each other. This replaces the old 2-way package.json vs
# capability.yaml grep, which never saw mcp-server/package.json and
# silently ignored readme.txt.
#
# The pushed tag is read from GITHUB_REF (refs/tags/vX.Y.Z). check-tag runs
# `check` internally (locations vs each other) AND compares source_of_truth
# against the tag. That second compare is the CAP-CI-001 case: a vX tag
# pointing at a commit whose package.json still said an older version. Without
# it, `check` passes a tag-vs-location drift, and the old derived-TAG logic
# would then check the WRONG tag's existence on origin and pass.
PUSHED_TAG="${GITHUB_REF##*/}"   # v2.4.2
TAG_VER="${PUSHED_TAG#v}"        # 2.4.2

echo "  version-sync:"
if ! python3 scripts/version-sync.py check-tag "$TAG_VER"; then
    echo "❌ VERSION SYNC FAILED: locations drifted or source_of_truth != tag"
    exit 1
fi

PKG_VER=$(python3 -c "import json; print(json.load(open('package.json'))['version'])" 2>/dev/null || echo "MISSING")

echo "  package.json:     $PKG_VER"

TAG="v$PKG_VER"
TAG="${PUSHED_TAG:-$TAG}"
echo "  tag:              $TAG"

# 3. Check tag on origin (Forgejo source of truth)
ORIGIN_URL=$(git remote get-url origin 2>/dev/null || echo "")
echo "  origin:           $ORIGIN_URL"

# Fetch tags silently
git fetch origin --tags --quiet 2>/dev/null || true

# Does tag already exist on origin?
if git ls-remote --tags origin "refs/tags/$TAG" | grep -q "$TAG"; then
    if [ "$FORCE" = "--force" ]; then
        echo "⚠️  Tag $TAG already exists on origin — --force allowed, will overwrite"
    else
        echo "❌ Tag $TAG already exists on origin"
        echo "   Use --force to overwrite, or bump version higher"
        exit 1
    fi
fi

# Does a LOWER or EQUAL tag already exist on origin? (only warn if force)
HIGHEST_TAG=$(git tag -l 'v[0-9]*' --sort=-version:refname | head -1)
if [ -n "$HIGHEST_TAG" ]; then
    HIGHEST_NUM=$(echo "$HIGHEST_TAG" | sed 's/^v//')
    CURRENT_NUM="$PKG_VER"
    if [ "$(printf '%s\n%s' "$HIGHEST_NUM" "$CURRENT_NUM" | sort -V | tail -1)" = "$HIGHEST_NUM" ] && [ "$HIGHEST_NUM" != "$CURRENT_NUM" ]; then
        echo "⚠️  Highest origin tag: $HIGHEST_TAG — your $TAG is lower"
        echo "   Are you releasing on a different repo clone? Check origin."
    fi
fi

# 4. GitHub mirror check (secondary — warn only)
#
# `grep -c` already prints 0 when nothing matches — it just exits 1 while
# doing so. The old `|| echo "0"` therefore appended a SECOND zero, and the
# variable held "0\n0". Every release run then printed
#   release-check.sh: line 59: [: 0 0: integer expected
# because `[` cannot compare a two-line value. Harmless in effect (an errored
# `[` counts as false inside `if`, so the check silently did nothing), but it
# was noise in every single run and the check itself never actually ran.
# `|| true` keeps grep's own 0 and swallows only the exit status.
GITHUB_URL=$(git remote get-url origin 2>/dev/null | grep -c "github" || true)
if [ "${GITHUB_URL:-0}" -gt 0 ]; then
    echo "⚠️  Remote origin points to GitHub, not Forgejo!"
    echo "   Forgejo (git.langevc.com) is the source of truth."
    echo "   Tag pushes should go to Forgejo first, then mirror to GitHub."
fi

echo "✅ Release check passed: $TAG ready"
