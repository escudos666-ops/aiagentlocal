#!/bin/bash
# Docker Sandboxes Setup Validation Script
# Simple quick-check after running setup

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
GRAY='\033[0;37m'
NC='\033[0m'

passed=0
failed=0
warnings=0
detailed="${1:--}"

write_header() {
    echo ""
    echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║     Docker Sandboxes Setup Validation                      ║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

write_check() {
    local num="$1"
    local title="$2"
    echo -e "${MAGENTA}Check $num: $title${NC}"
}

write_pass() {
    local msg="$1"
    echo -e "  ${GREEN}✓${NC} $msg"
    ((passed++))
}

write_fail() {
    local msg="$1"
    local fix="$2"
    echo -e "  ${RED}✗${NC} $msg"
    if [ -n "$fix" ]; then
        echo -e "    ${YELLOW}$fix${NC}"
    fi
    ((failed++))
}

write_warn() {
    local msg="$1"
    local fix="$2"
    echo -e "  ${YELLOW}⚠${NC} $msg"
    if [ -n "$fix" ]; then
        echo -e "    ${YELLOW}$fix${NC}"
    fi
    ((warnings++))
}

write_debug() {
    if [ "$detailed" = "--detailed" ] || [ "$detailed" = "-d" ]; then
        echo -e "    ${GRAY}$1${NC}"
    fi
}

# ============================================================================
# Checks
# ============================================================================

write_header

# Check 1: Architecture
write_check "1" "System Architecture"
arch=$(uname -m)
if [ "$arch" = "arm64" ]; then
    write_pass "System architecture: $arch (Apple Silicon)"
else
    write_fail "System architecture is $arch (arm64 required)"
fi
echo ""

# Check 2: macOS Version
write_check "2" "macOS Version"
macos_version=$(sw_vers -productVersion)
major=$(echo $macos_version | cut -d. -f1)
if [ "$major" -ge 12 ]; then
    write_pass "macOS version: $macos_version (12+)"
else
    write_fail "macOS version: $macos_version (12+ required)"
fi
echo ""

# Check 3: Homebrew
write_check "3" "Homebrew Installation"
if command -v brew &> /dev/null; then
    brew_version=$(brew --version | head -n1)
    write_pass "Homebrew installed: $brew_version"
    write_debug "Location: $(which brew)"
else
    write_fail "Homebrew not found" "Run: /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
fi
echo ""

# Check 4: sbx CLI
write_check "4" "Docker Sandboxes CLI"
if command -v sbx &> /dev/null; then
    sbx_version=$(sbx version 2>&1 | head -n1)
    write_pass "sbx CLI found: $sbx_version"
    write_debug "Location: $(which sbx)"
else
    write_fail "sbx CLI not found in PATH" "Run: brew install docker/tap/sbx"
fi
echo ""

# Check 5: Docker Authentication
write_check "5" "Docker Authentication"
if command -v sbx &> /dev/null; then
    auth_output=$(sbx version 2>&1)
    if echo "$auth_output" | grep -q "not authenticated"; then
        write_fail "Not authenticated with Docker" "Run: sbx login"
    else
        write_pass "Authenticated with Docker"
    fi
else
    write_warn "Cannot check authentication (sbx not found)"
fi
echo ""

# Check 6: Sandbox Daemon
write_check "6" "Sandbox Daemon"
if command -v sbx &> /dev/null; then
    if sbx ls 2>&1 | grep -q "NAME\|No sandboxes\|AGENT"; then
        sandbox_count=$(sbx ls 2>&1 | grep -c "sbx-\|AGENT" || echo 0)
        write_pass "Sandbox daemon is running"
        write_debug "Active sandboxes: $((sandbox_count / 2))"
    else
        write_warn "Sandbox daemon not responding" "Try: sbx ls"
    fi
else
    write_warn "Cannot check daemon (sbx not found)"
fi
echo ""

# Check 7: Network Policy
write_check "7" "Network Policy"
if command -v sbx &> /dev/null; then
    policy=$(sbx policy ls 2>&1 | head -n1)
    if [ -n "$policy" ]; then
        write_pass "Network policy configured: $policy"
        write_debug "Run 'sbx policy ls' for full policy details"
    else
        write_warn "Network policy not configured" "Run: sbx policy reset"
    fi
else
    write_warn "Cannot check policy (sbx not found)"
fi
echo ""

# Check 8: Git
write_check "8" "Git Installation"
if command -v git &> /dev/null; then
    git_version=$(git --version)
    write_pass "$git_version"
    write_debug "Location: $(which git)"
else
    write_fail "Git not found" "Run: brew install git"
fi
echo ""

# Check 9: Git Ignore
write_check "9" "Git Global Ignore"
if command -v git &> /dev/null; then
    git_ignore_path=$(git config --global core.excludesFile 2>/dev/null || echo "$HOME/.config/git/ignore")
    
    if [ -f "$git_ignore_path" ]; then
        if grep -q "\.sbx/" "$git_ignore_path" 2>/dev/null; then
            write_pass ".sbx/ in global gitignore"
            write_debug "Location: $git_ignore_path"
        else
            write_warn ".sbx/ not found in gitignore" "Run: echo '.sbx/' >> '$git_ignore_path'"
        fi
    else
        write_warn "Git ignore file not found" "Run: mkdir -p $(dirname "$git_ignore_path"); echo '.sbx/' > '$git_ignore_path'"
    fi
else
    write_warn "Cannot check gitignore (git not found)"
fi
echo ""

# ============================================================================
# Summary
# ============================================================================

echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                     SUMMARY                               ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

echo -e "  ${GREEN}✓ Passed:   $passed${NC}"
echo -e "  ${YELLOW}⚠ Warnings: $warnings${NC}"
echo -e "  ${RED}✗ Failed:   $failed${NC}"
echo ""

if [ $failed -eq 0 ] && [ $warnings -eq 0 ]; then
    echo -e "  ${GREEN}🎉 All checks passed! Docker Sandboxes is ready to use.${NC}"
    echo ""
    echo -e "  ${CYAN}Quick start:${NC}"
    echo -e "    ${GRAY}cd /path/to/your/project${NC}"
    echo -e "    ${GRAY}sbx run claude${NC}"
    echo ""
    exit 0
elif [ $failed -eq 0 ]; then
    echo -e "  ${YELLOW}⚠ Setup is mostly working, but some configurations are recommended.${NC}"
    echo ""
    exit 0
else
    echo -e "  ${RED}✗ Setup has errors. Please fix the issues above.${NC}"
    echo ""
    exit 1
fi
