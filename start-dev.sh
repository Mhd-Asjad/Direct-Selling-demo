#!/usr/bin/env bash

# Print commands and exit immediately if a command exits with a non-zero status
set -e

# Configuration
source .env
export PORT_API=8080
export PORT_WEB=5173

echo "============================================="
echo " Starting MLM Direct Selling Demo Services "
echo "============================================="
echo "Database URL: $DATABASE_URL"
echo "API Port:     $PORT_API"
echo "Frontend:     http://localhost:$PORT_WEB"
echo "============================================="

# Clean up background jobs on exit
cleanup() {
    echo ""
    echo "Stopping all services..."
    if [ -n "$API_PID" ]; then
        kill "$API_PID" 2>/dev/null || true
    fi
    if [ -n "$WEB_PID" ]; then
        kill "$WEB_PID" 2>/dev/null || true
    fi
}
trap cleanup EXIT INT TERM

# 1. Start the API Server
echo "Starting API Server..."
PORT=$PORT_API pnpm --filter @workspace/api-server run dev &
API_PID=$!

# 2. Start the Frontend Platform
echo "Starting Frontend Platform..."
PORT=$PORT_WEB BASE_PATH=/ pnpm --filter @workspace/mlm-platform run dev &
WEB_PID=$!

# Wait for both background processes
wait "$API_PID" "$WEB_PID"
