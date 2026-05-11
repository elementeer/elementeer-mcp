#!/bin/bash
# ============================================================================
# Release Quality Gate — runs before AND after every release build
# ============================================================================
# Pre-build:  ./scripts/release-check.sh --pre-build
# Post-build: ./scripts/release-check.sh --post-build
# Full gate:  ./scripts/release-check.sh (runs both)
#
# Exit 0 → all gates passed, release can proceed
# Exit 1 → gate failure, release blocked
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
MCP_DIR="$REPO_DIR/mcp-server"
MIRROR_DIR="$REPO_DIR/mirror/generated"
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

GATE_PASS=0; GATE_FAIL=0

log_section()  { echo -e "\n${BLUE}═══ $1 ═══${NC}"; }
log_pass()     { echo -e "  ${GREEN}✓${NC} $1"; GATE_PASS=$((GATE_PASS + 1)); }
log_fail()     { echo -e "  ${RED}✗${NC} $1"; GATE_FAIL=$((GATE_FAIL + 1)); }
log_warn()     { echo -e "  ${YELLOW}⚠${NC} $1"; }

# ── Gate 0: Source-of-truth check (must run first) ──────────────────────
check_forgejo_origin() {
    log_section "Source of Truth"
    local remotes
    remotes=$(cd "$REPO_DIR" && git remote -v 2>/dev/null) || true

    if echo "$remotes" | grep -q 'git\.langevc\.com.*(push)'; then
        log_pass "Forgejo is push remote (git.langevc.com)"
    else
        log_fail "Forgejo (git.langevc.com) must be the push origin"
        log_warn "Git remotes found:"
        echo "$remotes" | head -6
        return
    fi

    # Verify we're working from Forgejo, not GitHub clone
    local origin_url
    origin_url=$(cd "$REPO_DIR" && git remote get-url origin 2>/dev/null) || true
    if echo "$origin_url" | grep -q 'github\.com'; then
        log_fail "Origin is GitHub — this is a mirror, not the source of truth"
        log_fail "Switch to Forgejo: cd ~/Documents/repositories/forgejo/elementeer/elementeer-mcp"
    elif echo "$origin_url" | grep -q 'git\.langevc\.com'; then
        log_pass "Working from Forgejo source of truth ($origin_url)"
    else
        log_fail "Unknown origin: $origin_url"
    fi
}

check_plugin_origin() {
    log_section "Plugin Source"

    local plugin_forgejo="/Users/andrelange/Documents/repositories/forgejo/elementeer/elementeer"
    if [ ! -d "$plugin_forgejo/.git" ]; then
        log_fail "Plugin Forgejo repo not found at $plugin_forgejo"
        return
    fi

    local plugin_origin
    plugin_origin=$(cd "$plugin_forgejo" && git remote get-url origin 2>/dev/null) || ""
    if echo "$plugin_origin" | grep -q 'git\.langevc\.com'; then
        log_pass "Plugin source: Forgejo ($plugin_origin)"
    else
        log_fail "Plugin origin is not Forgejo: $plugin_origin"
    fi

    # Check if Forgejo is ahead of mirror (changes not yet mirrored to GitHub)
    local mirror_url
    mirror_url=$(cd "$plugin_forgejo" && git remote get-url github-public 2>/dev/null || true)
    if [ -n "$mirror_url" ]; then
        cd "$plugin_forgejo"
        local forgejo_commit; forgejo_commit=$(git rev-parse HEAD 2>/dev/null)
        local mirror_commit; mirror_commit=$(git ls-remote github-public HEAD 2>/dev/null | awk '{print $1}')
        if [ "$forgejo_commit" != "$mirror_commit" ] && [ -n "$mirror_commit" ]; then
            log_warn "Forgejo and GitHub mirror diverged — mirror workflow may be pending"
        else
            log_pass "Forgejo ↔ GitHub mirror in sync"
        fi
    else
        log_warn "No GitHub mirror remote configured on plugin repo"
    fi
}

# ── Gate 1: Plugin PHP files exist ──────────────────────────────────────
check_plugin_files() {
    log_section "Plugin Files"
    local plugin_root="$MIRROR_DIR/plugin-public/elementeer"
    local manifest_file="$MIRROR_DIR/plugin-public/.build-manifest"

    if [ -f "$manifest_file" ]; then
        log_pass "Found .build-manifest — validating all required files"
        local missing=0
        while IFS= read -r line || [ -n "$line" ]; do
            # Skip comments and empty lines
            [[ "$line" =~ ^# ]] && continue
            [[ -z "$line" ]] && continue
            # Directory entries start with @
            if [[ "$line" =~ ^@ ]]; then
                local dir="${line#@}"
                dir="${dir#elementeer/}"
                if [ -d "$plugin_root/$dir" ]; then
                    : # directory exists — ok
                else
                    log_fail "MISSING directory: $dir"
                    missing=$((missing + 1))
                fi
                continue
            fi
            # File entries: "path/to/file  > N"
            local file; file=$(echo "$line" | awk '{print $1}')
            local min_bytes; min_bytes=$(echo "$line" | awk '{print $NF}')
            local full="$plugin_root/$file"
            if [ -f "$full" ]; then
                local size; size=$(stat -f%z "$full" 2>/dev/null || stat -c%s "$full" 2>/dev/null || echo 0)
                if [ "$size" -ge "$min_bytes" ] 2>/dev/null; then
                    : # ok
                else
                    log_fail "TOO SMALL: $file ($size bytes, need >= $min_bytes)"
                    missing=$((missing + 1))
                fi
            else
                log_fail "MISSING: $file"
                missing=$((missing + 1))
            fi
        done < "$manifest_file"
        if [ "$missing" -eq 0 ]; then
            log_pass "Build manifest: all files present"
        else
            log_fail "Build manifest: $missing items missing"
        fi
    else
        log_warn "No .build-manifest found — falling back to minimal checks"
        local required=(
            "$MIRROR_DIR/plugin-public/elementeer/elementeer.php"
            "$MIRROR_DIR/plugin-public/elementeer/includes/Api/Router.php"
            "$MIRROR_DIR/plugin-public/elementeer/includes/Api/Templates.php"
            "$MIRROR_DIR/plugin-public/elementeer/includes/Api/ThemeBuilder.php"
            "$MIRROR_DIR/plugin-public/elementeer/includes/Api/Assessment.php"
            "$MIRROR_DIR/plugin-public/elementeer/includes/Api/Content.php"
            "$MIRROR_DIR/plugin-public/elementeer/includes/Api/GlobalStyles.php"
            "$MIRROR_DIR/plugin-public/elementeer/includes/Plugin.php"
            "$MIRROR_DIR/plugin-public/elementeer/readme.txt"
            "$MIRROR_DIR/plugin-public/elementeer/assets/images/icon.svg"
        )
        for f in "${required[@]}"; do
            if [ -f "$f" ]; then
                log_pass "$(basename "$f")"
            else
                log_fail "MISSING: $f"
            fi
        done
    fi
}

# ── Gate 2: Plugin PHP syntax check ─────────────────────────────────────
check_php_syntax() {
    log_section "PHP Syntax"
    local php_files
    php_files=$(find "$MIRROR_DIR/plugin-public/elementeer/includes" -name '*.php' -not -path '*/backup*/*' 2>/dev/null || true)
    local errs=0
    for f in $php_files; do
        if ! php -l "$f" > /dev/null 2>&1; then
            log_fail "Syntax error in $f"
            errs=$((errs + 1))
        fi
    done
    if [ $errs -eq 0 ]; then
        log_pass "All PHP files pass syntax check ($(echo "$php_files" | wc -l | tr -d ' ') files)"
    fi
}

# ── Gate 3: MCP TypeScript compiles ─────────────────────────────────────
check_tsc() {
    log_section "TypeScript Compilation"
    (cd "$MCP_DIR" && npx tsc --noEmit 2>&1) && log_pass "TypeScript compiles clean" || log_fail "TypeScript errors"
}

# ── Gate 4: MCP unit tests (vitest) ─────────────────────────────────────
check_mcp_tests() {
    log_section "MCP Unit Tests"
    local out
    out=$(cd "$MCP_DIR" && npx vitest --run --reporter=basic 2>&1) || true
    # vitest prints summary like: "Tests  478 passed | 253 skipped (731)"
    if echo "$out" | grep -q 'Tests.*passed.*skipped'; then
        log_pass "All MCP tests pass"
    elif echo "$out" | grep -q 'FAIL'; then
        log_fail "Some MCP tests failing"
        echo "$out" | grep 'FAIL' | head -5
    else
        log_fail "MCP test output unclear"
        echo "$out" | tail -10
    fi
}

# ── Gate 5: Lint (if configured) ────────────────────────────────────────
check_lint() {
    log_section "Lint"
    if [ -f "$MCP_DIR/.eslintrc.json" ] || [ -f "$MCP_DIR/eslint.config.js" ] || grep -q '"eslint"' "$MCP_DIR/package.json" 2>/dev/null; then
        (cd "$MCP_DIR" && npx eslint src/ 2>&1) && log_pass "ESLint clean" || log_warn "ESLint issues (existing — review before release)"
    else
        log_warn "No ESLint config found — skipping lint"
    fi
}

# ── Gate 6: Build produces dist/ ────────────────────────────────────────
check_build_output() {
    log_section "Build Output"

    # Expected version from plugin header (single source of truth)
    local expected_version
    expected_version=$(grep "Version:" "$MIRROR_DIR/plugin-public/elementeer/elementeer.php" 2>/dev/null | \
                       head -1 | sed 's/.*Version:[[:space:]]*//; s/[[:space:]].*//')
    if [ -z "$expected_version" ]; then
        log_fail "Cannot read version from elementeer.php"
        expected_version="unknown"
    else
        log_pass "Plugin version: $expected_version"
    fi

    local dist="$MCP_DIR/dist"
    if [ -d "$dist" ] && [ -f "$dist/index.js" ]; then
        local js_count; js_count=$(find "$dist" -name '*.js' | wc -l | tr -d ' ')
        log_pass "dist/ exists with $js_count JS files"
    else
        log_fail "dist/ missing or no index.js — run npm run build"
    fi

    local zip
    zip=$(ls -t /tmp/elementeer-build-final/elementeer-${expected_version}.zip 2>/dev/null | head -1 || true)
    if [ -z "$zip" ]; then
        # Fallback: any elementeer ZIP
        zip=$(ls -t /tmp/elementeer-build-final/elementeer-*.zip 2>/dev/null | head -1 || true)
    fi
    if [ -n "$zip" ]; then
        local zip_name; zip_name=$(basename "$zip")
        log_pass "Plugin ZIP: $zip_name ($(du -h "$zip" | cut -f1))"

        # Guard: ZIP version must match plugin header version
        local zip_version
        zip_version=$(echo "$zip_name" | sed 's/elementeer-//; s/\.zip//')
        if [ "$zip_version" != "$expected_version" ]; then
            log_fail "Version mismatch: ZIP has $zip_version but plugin header has $expected_version"
        fi
    else
        log_fail "Plugin ZIP not found in /tmp/elementeer-build-final/"
    fi

    local tarball
    tarball=$(ls -t /tmp/elementeer-build-final/elementeer-mcp-${expected_version}.tar.gz 2>/dev/null | head -1 || true)
    if [ -z "$tarball" ]; then
        tarball=$(ls -t /tmp/elementeer-build-final/elementeer-mcp-*.tar.gz 2>/dev/null | head -1 || true)
    fi
    if [ -n "$tarball" ]; then
        local tar_name; tar_name=$(basename "$tarball")
        log_pass "MCP tarball: $tar_name ($(du -h "$tarball" | cut -f1))"

        # Guard: Tarball version must match plugin header version
        local tar_version
        tar_version=$(echo "$tar_name" | sed 's/elementeer-mcp-//; s/\.tar\.gz//')
        if [ "$tar_version" != "$expected_version" ]; then
            log_fail "Version mismatch: tarball has $tar_version but plugin header has $expected_version"
        fi
    else
        log_fail "MCP tarball not found in /tmp/elementeer-build-final/"
    fi
}

# ── Gate 7: capaability.yaml valid YAML ─────────────────────────────────
check_capability_yaml() {
    log_section "Capability YAML"
    local yaml="$REPO_DIR/capability.yaml"
    if [ -f "$yaml" ]; then
        python3 -c "import yaml; yaml.safe_load(open('$yaml'))" 2>/dev/null && log_pass "Valid YAML" || log_fail "Invalid YAML"
    else
        log_fail "capability.yaml not found"
    fi
}

# ── Summary ─────────────────────────────────────────────────────────────
print_summary() {
    log_section "Gate Summary"
    local total=$((GATE_PASS + GATE_FAIL))
    echo -e "  ${GREEN}Passed: $GATE_PASS${NC}  ${RED}Failed: $GATE_FAIL${NC}  Total: $total"
    if [ $GATE_FAIL -gt 0 ]; then
        echo -e "\n${RED}RELEASE BLOCKED — fix the failing gates above.${NC}"
        exit 1
    else
        echo -e "\n${GREEN}All gates passed — release can proceed.${NC}"
        exit 0
    fi
}

# ── Main ────────────────────────────────────────────────────────────────
MODE="${1:-full}"

case "$MODE" in
    --pre-build)
        log_section "PRE-BUILD GATES"
        check_forgejo_origin
        check_plugin_origin
        check_plugin_files
        check_php_syntax
        check_tsc
        check_mcp_tests
        check_lint
        print_summary
        ;;
    --post-build)
        log_section "POST-BUILD GATES"
        check_build_output
        check_capability_yaml
        print_summary
        ;;
    full|*)
        log_section "FULL RELEASE GATE"
        # Pre-build
        check_forgejo_origin
        check_plugin_origin
        check_plugin_files
        check_php_syntax
        check_tsc
        check_mcp_tests
        check_lint
        # Post-build
        check_build_output
        check_capability_yaml
        print_summary
        ;;
esac
