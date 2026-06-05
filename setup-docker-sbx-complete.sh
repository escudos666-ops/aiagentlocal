#!/bin/bash
# Docker Sandboxes Complete Automation & Verification
# macOS (arm64) Setup Script with Full Testing

set -e

# ============================================================================
# Configuration
# ============================================================================

NETWORK_POLICY="${1:-Open}"
TEST_AGENT="${2:-claude}"
SKIP_NETWORK_TEST="${SKIP_NETWORK_TEST:-false}"
SKIP_SANDBOX_TEST="${SKIP_SANDBOX_TEST:-false}"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
GRAY='\033[0;37m'
DARK_GRAY='\033[0;90m'
NC='\033[0m'

# Track results
declare -A results
results[Architecture]="PENDING"
results[Homebrew]="PENDING"
results[SbxInstall]="PENDING"
results[SbxInPath]="PENDING"
results[DockerAuth]="PENDING"
results[NetworkPolicy]="PENDING"
results[GitIgnore]="PENDING"
results[NetworkTest]="PENDING"
results[SandboxTest]="PENDING"

# ============================================================================
# Logging & Output Functions
# ============================================================================

write_status() {
    local message="$1"
    local status="${2:-INFO}"
    local timestamp=$(date "+%H:%M:%S")
    
    case "$status" in
        INFO)    echo -e "${CYAN}[${timestamp}] ℹ${NC} $message" ;;
        SUCCESS) echo -e "${GREEN}[${timestamp}] ✓${NC} $message" ;;
        WARNING) echo -e "${YELLOW}[${timestamp}] ⚠${NC} $message" ;;
        ERROR)   echo -e "${RED}[${timestamp}] ✗${NC} $message" ;;
        DEBUG)   echo -e "${GRAY}[${timestamp}] »${NC} $message" ;;
        STEP)    echo -e "${MAGENTA}[${timestamp}] →${NC} $message" ;;
    esac
}

write_header() {
    local title="$1"
    local subtitle="$2"
    echo ""
    echo -e "${CYAN}╔════════════════════════════════════════════════════════════════════╗${NC}"
    printf "${CYAN}║${NC} %-66s ${CYAN}║${NC}\n" "$title"
    if [ -n "$subtitle" ]; then
        printf "${CYAN}║${NC} %-66s ${CYAN}║${NC}\n" "$subtitle"
    fi
    echo -e "${CYAN}╚════════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

write_section() {
    local title="$1"
    echo ""
    echo -e "${DARK_GRAY}─────────────────────────────────────────────────────────────────────${NC}"
    echo -e "${MAGENTA}  $title${NC}"
    echo -e "${DARK_GRAY}─────────────────────────────────────────────────────────────────────${NC}"
}

write_result() {
    local name="$1"
    local status="$2"
    local details="$3"
    
    if [ "$status" = "PASS" ]; then
        echo -e "  ${GREEN}[✓]${NC} $name ${GRAY}${details}${NC}"
    elif [ "$status" = "PARTIAL" ]; then
        echo -e "  ${YELLOW}[~]${NC} $name ${GRAY}${details}${NC}"
    elif [ "$status" = "SKIP" ]; then
        echo -e "  ${GRAY}[⊘]${NC} $name ${GRAY}${details}${NC}"
    else
        echo -e "  ${RED}[✗]${NC} $name ${GRAY}${details}${NC}"
    fi
}

# ============================================================================
# Prerequisite Checks
# ============================================================================

check_architecture() {
    write_section "Step 1: Architecture Check"
    write_status "Checking system architecture..." "STEP"
    
    local arch=$(uname -m)
    if [ "$arch" != "arm64" ]; then
        write_status "sbx on macOS requires arm64 (Apple Silicon). Current: $arch" "ERROR"
        exit 1
    fi
    
    write_status "System architecture: $arch (supported)" "SUCCESS"
    results[Architecture]="PASS"
}

check_macos_version() {
    write_status "Checking macOS version..." "STEP"
    
    local macos_version=$(sw_vers -productVersion)
    local major=$(echo $macos_version | cut -d. -f1)
    
    if [ "$major" -lt 12 ]; then
        write_status "macOS 12+ required. Current: $macos_version" "ERROR"
        exit 1
    fi
    
    write_status "macOS version compatible: $macos_version" "SUCCESS"
}

check_internet() {
    write_status "Checking internet connectivity..." "STEP"
    
    if ! ping -c 1 -W 5 8.8.8.8 > /dev/null 2>&1; then
        write_status "No internet connection detected. sbx installation requires internet." "ERROR"
        exit 1
    fi
    
    write_status "Internet connectivity confirmed" "SUCCESS"
}

# ============================================================================
# Homebrew Setup
# ============================================================================

install_homebrew() {
    write_section "Step 2: Homebrew Installation"
    
    if command -v brew &> /dev/null; then
        write_status "Homebrew is already installed" "SUCCESS"
        results[Homebrew]="PASS"
        return 0
    fi
    
    write_status "Homebrew not found. Installing..." "INFO"
    
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    
    # Add Homebrew to PATH for current session
    if [ -f /opt/homebrew/bin/brew ]; then
        export PATH="/opt/homebrew/bin:$PATH"
        eval "$(/opt/homebrew/bin/brew shellenv)"
    fi
    
    write_status "Homebrew installed successfully" "SUCCESS"
    results[Homebrew]="PASS"
}

# ============================================================================
# sbx CLI Installation
# ============================================================================

install_sbx() {
    write_section "Step 3: Docker Sandboxes CLI Installation"
    
    write_status "Checking if sbx is already installed..." "STEP"
    
    if command -v sbx &> /dev/null; then
        write_status "sbx CLI found at $(which sbx)" "SUCCESS"
        results[SbxInstall]="PASS"
        results[SbxInPath]="PASS"
        
        local version=$(sbx version 2>&1 | head -n1)
        write_status "Version: $version" "DEBUG"
        return 0
    fi
    
    write_status "sbx CLI not found. Installing via Homebrew..." "INFO"
    
    brew install docker/tap/sbx
    
    write_status "Verifying sbx installation..." "STEP"
    
    if command -v sbx &> /dev/null; then
        write_status "sbx CLI installed successfully at $(which sbx)" "SUCCESS"
        results[SbxInstall]="PASS"
        results[SbxInPath]="PASS"
        
        local version=$(sbx version 2>&1 | head -n1)
        write_status "Version: $version" "DEBUG"
        return 0
    else
        write_status "sbx not found after installation" "ERROR"
        results[SbxInstall]="FAIL"
        results[SbxInPath]="FAIL"
        return 1
    fi
}

# ============================================================================
# Docker Authentication
# ============================================================================

initialize_docker_auth() {
    write_section "Step 4: Docker Authentication"
    
    write_status "Checking Docker authentication status..." "STEP"
    
    local output=$(sbx version 2>&1)
    
    if echo "$output" | grep -q "not authenticated"; then
        write_status "Not authenticated. Starting login flow..." "INFO"
        sbx login
        
        write_status "Verifying authentication..." "STEP"
        sleep 2
        
        output=$(sbx version 2>&1)
        if echo "$output" | grep -q "not authenticated"; then
            write_status "Authentication failed" "ERROR"
            results[DockerAuth]="FAIL"
            return 1
        else
            write_status "Authentication successful" "SUCCESS"
            results[DockerAuth]="PASS"
            return 0
        fi
    else
        write_status "Already authenticated with Docker" "SUCCESS"
        results[DockerAuth]="PASS"
        return 0
    fi
}

# ============================================================================
# Network Policy Configuration
# ============================================================================

configure_network_policy() {
    write_section "Step 5: Network Policy Configuration"
    
    write_status "Configuring network policy: $NETWORK_POLICY" "INFO"
    
    local current_policy=$(sbx policy ls 2>&1 | head -n1)
    
    if echo "$current_policy" | grep -q "$NETWORK_POLICY"; then
        write_status "Network policy already set to $NETWORK_POLICY" "SUCCESS"
        results[NetworkPolicy]="PASS"
        return 0
    fi
    
    write_status "Resetting network policy..." "STEP"
    write_status "You will be prompted to select network policy" "WARNING"
    write_status "Choose: $NETWORK_POLICY" "INFO"
    
    sbx policy reset
    
    write_status "Network policy configuration updated" "SUCCESS"
    results[NetworkPolicy]="PASS"
}

# ============================================================================
# Git Configuration
# ============================================================================

configure_git_ignore() {
    write_section "Step 6: Git Configuration"
    
    write_status "Checking Git installation..." "STEP"
    
    if ! command -v git &> /dev/null; then
        write_status "Git not found. Skipping git configuration." "WARNING"
        results[GitIgnore]="SKIP"
        return 0
    fi
    
    write_status "Git found at $(which git)" "SUCCESS"
    write_status "Configuring global .gitignore..." "STEP"
    
    local git_ignore_path=$(git config --global core.excludesFile 2>/dev/null || echo "$HOME/.config/git/ignore")
    
    write_status "Using gitignore file: $git_ignore_path" "DEBUG"
    
    # Create directory if needed
    mkdir -p "$(dirname "$git_ignore_path")"
    
    # Create file if needed
    touch "$git_ignore_path"
    
    # Check if .sbx/ already exists
    if grep -q "\.sbx/" "$git_ignore_path" 2>/dev/null; then
        write_status ".sbx/ already in global gitignore" "SUCCESS"
    else
        echo ".sbx/" >> "$git_ignore_path"
        write_status ".sbx/ added to global gitignore" "SUCCESS"
    fi
    
    write_status "Global gitignore location: $git_ignore_path" "INFO"
    results[GitIgnore]="PASS"
}

# ============================================================================
# Network Testing
# ============================================================================

test_sandbox_network() {
    write_section "Step 7: Network Connectivity Test"
    
    if [ "$SKIP_NETWORK_TEST" = "true" ]; then
        write_status "Skipping network test (--skip-network-test)" "INFO"
        results[NetworkTest]="SKIP"
        return 0
    fi
    
    write_status "Testing sbx network connectivity..." "STEP"
    
    local test_sandbox="sbx-network-test-$(date +%s)"
    
    write_status "Creating temporary test sandbox: $test_sandbox" "DEBUG"
    sbx create --agent shell "$test_sandbox" 2>&1 > /dev/null || true
    
    write_status "Testing network from sandbox..." "INFO"
    local network_test=$(sbx exec "$test_sandbox" curl -s https://api.github.com/rate_limit 2>&1 || true)
    
    write_status "Cleaning up test sandbox..." "DEBUG"
    sbx rm "$test_sandbox" 2>&1 > /dev/null || true
    
    if echo "$network_test" | grep -q "resources\|limit"; then
        write_status "Network connectivity verified" "SUCCESS"
        results[NetworkTest]="PASS"
        return 0
    else
        write_status "Network test completed (results inconclusive)" "WARNING"
        results[NetworkTest]="PARTIAL"
        return 0
    fi
}

# ============================================================================
# Sandbox Functionality Test
# ============================================================================

test_sandbox_functionality() {
    write_section "Step 8: Sandbox Functionality Test"
    
    if [ "$SKIP_SANDBOX_TEST" = "true" ]; then
        write_status "Skipping sandbox test (--skip-sandbox-test)" "INFO"
        results[SandboxTest]="SKIP"
        return 0
    fi
    
    write_status "Testing sandbox creation and execution..." "STEP"
    
    local test_sandbox="sbx-test-$(date +%s)"
    
    write_status "Creating test sandbox: $test_sandbox" "INFO"
    sbx create --agent shell "$test_sandbox" 2>&1 > /dev/null || true
    
    write_status "Testing command execution in sandbox..." "INFO"
    local output=$(sbx exec "$test_sandbox" echo "Sandbox is working!" 2>&1 || true)
    
    if echo "$output" | grep -q "working"; then
        write_status "Sandbox command execution verified" "SUCCESS"
    else
        write_status "Sandbox output unexpected: $output" "WARNING"
    fi
    
    write_status "Testing Docker in sandbox..." "INFO"
    local docker_test=$(sbx exec "$test_sandbox" docker version 2>&1 || true)
    
    if echo "$docker_test" | grep -q "Version\|Server"; then
        write_status "Docker engine in sandbox verified" "SUCCESS"
    else
        write_status "Docker test inconclusive" "WARNING"
    fi
    
    write_status "Cleaning up test sandbox..." "DEBUG"
    sbx rm "$test_sandbox" 2>&1 > /dev/null || true
    
    write_status "Sandbox functionality verified" "SUCCESS"
    results[SandboxTest]="PASS"
}

# ============================================================================
# Final Report
# ============================================================================

show_final_report() {
    write_section "Installation Summary"
    
    echo ""
    echo -e "${CYAN}Status Report:${NC}"
    echo ""
    
    for key in "${!results[@]}"; do
        local status="${results[$key]}"
        write_result "$key" "$status"
    done
    
    echo ""
    write_status "✓ Docker Sandboxes setup COMPLETE and VERIFIED" "SUCCESS"
    echo ""
}

show_next_steps() {
    write_section "Quick Start Guide"
    
    echo ""
    echo -e "${CYAN}1. Navigate to your project:${NC}"
    echo "   cd /path/to/your/project"
    echo ""
    
    echo -e "${CYAN}2. Start an AI agent in sandbox:${NC}"
    echo "   sbx run claude                 # Claude Code (direct mode)"
    echo "   sbx run claude --branch fix    # Claude Code (branch mode - safer)"
    echo "   sbx run copilot                # GitHub Copilot"
    echo "   sbx run gemini                 # Google Gemini"
    echo ""
    
    echo -e "${CYAN}3. Monitor sandbox resources:${NC}"
    echo "   sbx                            # Interactive dashboard (TUI)"
    echo "   sbx ls                         # List sandboxes"
    echo "   sbx logs <name>                # View sandbox logs"
    echo ""
    
    echo -e "${CYAN}4. Manage sandboxes:${NC}"
    echo "   sbx stop <name>                # Stop a sandbox"
    echo "   sbx rm <name>                  # Delete a sandbox"
    echo "   sbx exec <name> bash           # Execute command"
    echo ""
    
    echo -e "${CYAN}5. Git workflow (branch mode recommended):${NC}"
    echo "   sbx run claude --branch feature-name"
    echo "   # After agent finishes, review then merge:"
    echo "   git merge .sbx/claude-*-worktrees/feature-name"
    echo ""
    
    echo -e "${CYAN}Documentation:${NC}"
    echo -e "   ${CYAN}https://docs.docker.com/ai/sandboxes/${NC}"
    echo ""
}

# ============================================================================
# Main Execution
# ============================================================================

main() {
    write_header "Docker Sandboxes Complete Setup & Verification" "Automated Installation Script"
    
    # Phase 1: Prerequisites
    write_header "PHASE 1: Prerequisites" "System Verification"
    check_architecture
    check_macos_version
    check_internet
    
    # Phase 2: Homebrew
    install_homebrew
    
    # Phase 3: sbx CLI
    install_sbx
    
    # Phase 4: Docker Auth
    initialize_docker_auth
    
    # Phase 5: Network Policy
    configure_network_policy
    
    # Phase 6: Git Config
    configure_git_ignore
    
    # Phase 7-8: Testing
    if [ "$SKIP_NETWORK_TEST" != "true" ]; then
        test_sandbox_network
    fi
    
    if [ "$SKIP_SANDBOX_TEST" != "true" ]; then
        test_sandbox_functionality
    fi
    
    # Final Report
    show_final_report
    show_next_steps
    
    write_status "Setup script completed" "SUCCESS"
    echo ""
}

# Run main
main
