#!/bin/bash

# =============================================================================
# ATLAS Platform Startup Script
# =============================================================================
# This script starts all Atlas services:
# - Docker containers (Neo4j, OpenSearch, MCP servers, etc.)
# - Atlas Web backend (local-server.js)
# - Atlas Web frontend (Vite dev server)
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ATLAS_CODE_DIR="$SCRIPT_DIR/atlas-code"
ATLAS_WEB_DIR="$SCRIPT_DIR/atlas-web"
LOG_DIR="$SCRIPT_DIR/logs"

# Create logs directory
mkdir -p "$LOG_DIR"

# =============================================================================
# Helper Functions
# =============================================================================

print_banner() {
    echo -e "${CYAN}"
    echo "╔═══════════════════════════════════════════════════════════════════╗"
    echo "║                                                                   ║"
    echo "║     █████╗ ████████╗██╗      █████╗ ███████╗                     ║"
    echo "║    ██╔══██╗╚══██╔══╝██║     ██╔══██╗██╔════╝                     ║"
    echo "║    ███████║   ██║   ██║     ███████║███████╗                     ║"
    echo "║    ██╔══██║   ██║   ██║     ██╔══██║╚════██║                     ║"
    echo "║    ██║  ██║   ██║   ███████╗██║  ██║███████║                     ║"
    echo "║    ╚═╝  ╚═╝   ╚═╝   ╚══════╝╚═╝  ╚═╝╚══════╝                     ║"
    echo "║                                                                   ║"
    echo "║           Enterprise AI Research Platform                         ║"
    echo "║                                                                   ║"
    echo "╚═══════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
}

log_step() {
    echo -e "\n${CYAN}═══════════════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}  $1${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════════${NC}\n"
}

check_command() {
    if command -v "$1" &> /dev/null; then
        log_success "$1 is installed"
        return 0
    else
        log_error "$1 is not installed"
        return 1
    fi
}

wait_for_port() {
    local port=$1
    local name=$2
    local max_attempts=${3:-30}
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        if nc -z localhost "$port" 2>/dev/null; then
            log_success "$name is ready on port $port"
            return 0
        fi
        echo -n "."
        sleep 1
        ((attempt++))
    done

    log_error "$name failed to start on port $port"
    return 1
}

kill_port() {
    local port=$1
    local pids=$(lsof -ti ":$port" 2>/dev/null)
    if [ -n "$pids" ]; then
        echo "$pids" | xargs kill -9 2>/dev/null || true
        sleep 1
    fi
}

# =============================================================================
# Prerequisite Checks
# =============================================================================

check_prerequisites() {
    log_step "Checking Prerequisites"

    local all_ok=true

    # Check Docker
    if check_command "docker"; then
        if docker info &> /dev/null; then
            log_success "Docker daemon is running"
        else
            log_error "Docker daemon is not running. Please start Docker Desktop."
            all_ok=false
        fi
    else
        log_error "Docker is required. Please install Docker Desktop."
        all_ok=false
    fi

    # Check Docker Compose
    if docker compose version &> /dev/null; then
        log_success "Docker Compose is available"
    elif check_command "docker-compose"; then
        log_success "docker-compose is available"
    else
        log_error "Docker Compose is required"
        all_ok=false
    fi

    # Check Node.js
    if check_command "node"; then
        local node_version=$(node -v)
        log_info "Node.js version: $node_version"
    else
        log_error "Node.js is required. Please install Node.js 18+."
        all_ok=false
    fi

    # Check npm
    check_command "npm" || all_ok=false

    # Check AWS CLI (optional but recommended)
    if check_command "aws"; then
        if aws sts get-caller-identity &> /dev/null; then
            log_success "AWS credentials are configured"
        else
            log_warning "AWS credentials not configured (Bedrock calls may fail)"
        fi
    else
        log_warning "AWS CLI not installed (Bedrock calls may fail)"
    fi

    if [ "$all_ok" = false ]; then
        log_error "Please install missing prerequisites and try again."
        exit 1
    fi
}

# =============================================================================
# Install Dependencies
# =============================================================================

install_dependencies() {
    log_step "Installing Dependencies"

    # Atlas Web root dependencies
    if [ -f "$ATLAS_WEB_DIR/package.json" ]; then
        log_info "Installing atlas-web dependencies..."
        cd "$ATLAS_WEB_DIR"
        npm install --silent
        log_success "atlas-web dependencies installed"
    fi

    # Atlas Web frontend dependencies
    if [ -f "$ATLAS_WEB_DIR/frontend/package.json" ]; then
        log_info "Installing frontend dependencies..."
        cd "$ATLAS_WEB_DIR/frontend"
        npm install --silent
        log_success "Frontend dependencies installed"
    fi

    cd "$SCRIPT_DIR"
}

# =============================================================================
# Docker Services
# =============================================================================

start_docker_services() {
    log_step "Starting Docker Services (Knowledge Core Infrastructure)"

    if [ ! -f "$ATLAS_CODE_DIR/docker-compose.yml" ]; then
        log_warning "docker-compose.yml not found in atlas-code, skipping Docker services"
        return 0
    fi

    cd "$ATLAS_CODE_DIR"

    # Check if containers are already running
    if docker compose ps --quiet 2>/dev/null | grep -q .; then
        log_info "Docker containers already running, checking health..."
    else
        log_info "Starting Docker containers..."
        docker compose up -d --build 2>&1 | tee "$LOG_DIR/docker-compose.log"
    fi

    # Wait for services
    log_info "Waiting for services to be ready..."

    echo -n "  Neo4j (7687): "
    wait_for_port 7687 "Neo4j" 60

    echo -n "  Neo4j Browser (7474): "
    wait_for_port 7474 "Neo4j Browser" 30

    echo -n "  OpenSearch (9200): "
    wait_for_port 9200 "OpenSearch" 60

    echo -n "  MCP Knowledge Core (3001): "
    wait_for_port 3001 "MCP Knowledge Core" 30

    cd "$SCRIPT_DIR"
}

# =============================================================================
# Atlas Web Backend
# =============================================================================

start_backend() {
    log_step "Starting Atlas Web Backend (Port 8000)"

    # Kill any existing process on port 8000
    kill_port 8000

    cd "$ATLAS_WEB_DIR"

    log_info "Starting local-server.js..."
    nohup node local-server.js > "$LOG_DIR/backend.log" 2>&1 &
    echo $! > "$LOG_DIR/backend.pid"

    echo -n "  Backend (8000): "
    wait_for_port 8000 "Backend" 30

    cd "$SCRIPT_DIR"
}

# =============================================================================
# Atlas Web Frontend
# =============================================================================

start_frontend() {
    log_step "Starting Atlas Web Frontend (Port 3000)"

    # Kill any existing process on port 3000
    kill_port 3000

    cd "$ATLAS_WEB_DIR/frontend"

    log_info "Starting Vite dev server..."
    nohup npm run dev > "$LOG_DIR/frontend.log" 2>&1 &
    echo $! > "$LOG_DIR/frontend.pid"

    echo -n "  Frontend (3000): "
    wait_for_port 3000 "Frontend" 30

    cd "$SCRIPT_DIR"
}

# =============================================================================
# Status Summary
# =============================================================================

print_status() {
    log_step "Atlas Platform Status"

    echo -e "${GREEN}All services are running!${NC}\n"

    echo "┌─────────────────────────────────────────────────────────────────┐"
    echo "│  Service                    │  URL                              │"
    echo "├─────────────────────────────┼───────────────────────────────────┤"
    echo "│  Atlas Web UI               │  http://localhost:3000            │"
    echo "│  Atlas Backend API          │  http://localhost:8000            │"
    echo "├─────────────────────────────┼───────────────────────────────────┤"
    echo "│  Neo4j Browser              │  http://localhost:7474            │"
    echo "│  Neo4j Bolt                 │  bolt://localhost:7687            │"
    echo "│  OpenSearch                 │  http://localhost:9200            │"
    echo "│  MCP Knowledge Core         │  http://localhost:3001            │"
    echo "├─────────────────────────────┼───────────────────────────────────┤"
    echo "│  Code Server (if running)   │  http://localhost:8080            │"
    echo "└─────────────────────────────┴───────────────────────────────────┘"

    echo ""
    echo -e "${YELLOW}Credentials:${NC}"
    echo "  Neo4j: neo4j / localdev123"
    echo "  Code Server: demo123"
    echo ""
    echo -e "${YELLOW}Logs:${NC}"
    echo "  Backend: $LOG_DIR/backend.log"
    echo "  Frontend: $LOG_DIR/frontend.log"
    echo "  Docker: $LOG_DIR/docker-compose.log"
    echo "  Requests: $ATLAS_WEB_DIR/logs/requests.log"
    echo ""
    echo -e "${CYAN}To stop all services, run: ./stop.sh${NC}"
    echo ""
}

# =============================================================================
# Main
# =============================================================================

main() {
    print_banner
    check_prerequisites
    install_dependencies
    start_docker_services
    start_backend
    start_frontend
    print_status
}

# Run main function
main "$@"
