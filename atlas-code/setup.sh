#!/bin/bash

# ===========================================
# Ally AI Platform - Local Demo Setup
# ===========================================

set -e

echo "
╔═══════════════════════════════════════════════════════════╗
║  ALLY AI PLATFORM - LOCAL DEMO SETUP                      ║
╚═══════════════════════════════════════════════════════════╝
"

# Check Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop."
    exit 1
fi

echo "✅ Docker is running"

# Build and start services
echo ""
echo "📦 Building and starting services..."
docker-compose up -d --build

# Wait for Neo4j
echo ""
echo "⏳ Waiting for Neo4j to be ready..."
sleep 10

until docker exec ally-neo4j cypher-shell -u neo4j -p allyfinancial "RETURN 1" > /dev/null 2>&1; do
    echo "   Waiting for Neo4j..."
    sleep 5
done

echo "✅ Neo4j is ready"

# Load Knowledge Core data
echo ""
echo "📊 Loading Knowledge Core data..."
docker exec -i ally-neo4j cypher-shell -u neo4j -p allyfinancial < data/neo4j-init.cypher

echo "✅ Knowledge Core loaded"

# Check all services
echo ""
echo "🔍 Checking services..."
echo ""

check_service() {
    if curl -s -o /dev/null -w "%{http_code}" "$1" | grep -q "200\|302"; then
        echo "   ✅ $2"
    else
        echo "   ⚠️  $2 (may still be starting)"
    fi
}

check_service "http://localhost:8080" "code-server (VS Code)"
check_service "http://localhost:7474" "Neo4j Browser"
check_service "http://localhost:3001/health" "Knowledge Core MCP"
check_service "http://localhost:3002/health" "GitLab Mock MCP"
check_service "http://localhost:3003" "Webhook Simulator"

echo ""
echo "
╔═══════════════════════════════════════════════════════════╗
║  🎉 SETUP COMPLETE!                                       ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║  Open these URLs in your browser:                         ║
║                                                           ║
║  VS Code:      http://localhost:8080  (pass: demo123)    ║
║  Neo4j:        http://localhost:7474  (neo4j/allyfinancial)║
║  Webhooks:     http://localhost:3003                      ║
║                                                           ║
║  Next: Run 'claude' in VS Code terminal to authenticate   ║
║                                                           ║
║  Full demo guide: DEMO_GUIDE.md                           ║
╚═══════════════════════════════════════════════════════════╝
"
