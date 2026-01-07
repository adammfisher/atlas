#!/bin/bash

# ===========================================
# Ally AI Platform - Cleanup
# ===========================================

echo "
╔═══════════════════════════════════════════════════════════╗
║  ALLY AI PLATFORM - CLEANUP                               ║
╚═══════════════════════════════════════════════════════════╝
"

echo "🛑 Stopping all services..."
docker-compose down

echo ""
read -p "Remove all data volumes? (y/N) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🗑️  Removing volumes..."
    docker-compose down -v
    echo "✅ All data removed"
else
    echo "📦 Volumes preserved (can restart with existing data)"
fi

echo ""
echo "✅ Cleanup complete"
