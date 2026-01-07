#!/bin/bash

# =============================================================================
# ATLAS Platform Stop Script
# =============================================================================
# This script stops all Atlas services
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ATLAS_CODE_DIR="$SCRIPT_DIR/atlas-code"
LOG_DIR="$SCRIPT_DIR/logs"

log_info() {
    echo -e "${CYAN}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

kill_port() {
    local port=$1
    local name=$2
    local pids=$(lsof -ti ":$port" 2>/dev/null)
    if [ -n "$pids" ]; then
        echo "$pids" | xargs kill -9 2>/dev/null || true
        log_success "Stopped $name (port $port)"
    else
        log_info "$name not running (port $port)"
    fi
}

echo -e "${CYAN}"
echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║                  Stopping Atlas Platform                          ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Stop frontend
log_info "Stopping Frontend..."
kill_port 3000 "Frontend"

# Stop backend
log_info "Stopping Backend..."
kill_port 8000 "Backend"

# Stop Docker services (optional - uncomment if you want to stop Docker too)
if [ "$1" = "--all" ] || [ "$1" = "-a" ]; then
    log_info "Stopping Docker services..."
    if [ -f "$ATLAS_CODE_DIR/docker-compose.yml" ]; then
        cd "$ATLAS_CODE_DIR"
        docker compose down 2>/dev/null || true
        log_success "Docker services stopped"
    fi
fi

# Clean up PID files
rm -f "$LOG_DIR/backend.pid" "$LOG_DIR/frontend.pid" 2>/dev/null

echo ""
echo -e "${GREEN}Atlas Platform stopped.${NC}"
echo ""
if [ "$1" != "--all" ] && [ "$1" != "-a" ]; then
    echo -e "${YELLOW}Note: Docker services are still running.${NC}"
    echo -e "${YELLOW}Use './stop.sh --all' to stop Docker services too.${NC}"
fi
echo ""
