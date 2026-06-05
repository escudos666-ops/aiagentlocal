#!/bin/bash
# Docker Sandboxes Setup Script for macOS
# Installs sbx CLI and configures Docker Sandboxes for AI agents

set -e

NETWORK_POLICY="${1:-Open}"
SKIP_INSTALL="${SKIP_INSTALL:-false}"

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

write_status() {
    local message="$1"
    local status="${2:-INFO}"
    local color="$CYAN"
    
    case "$status" in
        SUCCESS) color="$GREEN" ;;
        WARNING) color="$YELLOW" ;;
        ERROR) color="$RED" ;;
    esac
    
    echo -e "${color}[$status]${NC} $message"
}

check_architecture() {
    write_status "Checking system architecture..." "INFO"
    
    ARCH=$(uname -m)
    if [ "$ARCH" != "arm64" ]; then
        write_status "sbx on macOS requires arm64 (Apple Silicon). Your system is $ARCH" "ERROR"
        exit 1
    fi
    write_status "System architecture: $ARCH (supported)" "SUCCESS"
}

install_brew() {
    if ! command -v brew &> /dev/null; then
        write_status "Homebrew not found. Installing..." "INFO"
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        write_status "Homebrew installed" "SUCCESS"
    else
        write_status "Homebrew is already installed" "SUCCESS"
    fi
}

install_sbx_cli() {
    if command -v sbx &> /dev/null; then
        write_status "sbx CLI is already installed" "SUCCESS"
        sbx version
        return
    fi
    
    write_status "Installing Docker Sandboxes CLI (sbx)..." "INFO"
    brew install docker/tap/sbx
    write_status "Docker Sandboxes CLI installed successfully" "SUCCESS"
}

initialize_sbx_auth() {
    write_status "Checking sbx authentication..." "INFO"
    
    if sbx version 2>&1 | grep -q "not authenticated"; then
        write_status "Starting sbx authentication..." "INFO"
        sbx login
        write_status "Authentication complete" "SUCCESS"
    else
        write_status "Already authenticated with Docker" "SUCCESS"
    fi
}

set_network_policy() {
    local policy="$1"
    write_status "Network policy will be configured to: $policy" "INFO"
    echo "  • Open: All network traffic allowed (development friendly)"
    echo "  • Balanced: Common dev sites allowed, others blocked"
    echo "  • Locked: All traffic blocked unless explicitly allowed"
}

configure_gitignore() {
    write_status "Configuring global .gitignore for .sbx/ folder..." "INFO"
    
    local git_ignore_path
    git_ignore_path=$(git config --global core.excludesFile 2>/dev/null || echo "$HOME/.config/git/ignore")
    
    mkdir -p "$(dirname "$git_ignore_path")"
    
    if ! grep -q "\.sbx/" "$git_ignore_path" 2>/dev/null; then
        echo ".sbx/" >> "$git_ignore_path"
        write_status ".sbx/ added to global gitignore at $git_ignore_path" "SUCCESS"
    else
        write_status ".sbx/ already in gitignore" "SUCCESS"
    fi
}

show_quickstart() {
    echo ""
    write_status "Setup Complete!" "SUCCESS"
    echo ""
    echo "Quick start guide:"
    echo "  1. Navigate to your project directory:"
    echo "     cd your-project"
    echo ""
    echo "  2. Start Claude Code in a sandbox (direct mode):"
    echo "     sbx run claude"
    echo ""
    echo "  3. Or start in branch mode (safer for git):"
    echo "     sbx run claude --branch my-feature-name"
    echo ""
    echo "  4. View running sandboxes and resources:"
    echo "     sbx"
    echo ""
    echo "Other agents available:"
    echo "     sbx run codex, sbx run copilot, sbx run gemini, sbx run cursor"
    echo ""
    echo "Useful commands:"
    echo "     sbx ls              - List all sandboxes"
    echo "     sbx rm <name>       - Remove a sandbox"
    echo "     sbx stop <name>     - Stop a sandbox"
    echo "     sbx policy ls       - View network policies"
    echo ""
    echo "Documentation:"
    echo "     https://docs.docker.com/ai/sandboxes/"
    echo ""
}

# Main execution
echo ""
echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║     Docker Sandboxes Setup for macOS                       ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

check_architecture
echo ""

install_brew
echo ""

install_sbx_cli
echo ""

initialize_sbx_auth
echo ""

set_network_policy "$NETWORK_POLICY"
echo ""

configure_gitignore
echo ""

show_quickstart
