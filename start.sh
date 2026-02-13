#!/bin/sh
# Rebuild better-sqlite3 on every start to match container architecture
echo "🔧 Rebuilding better-sqlite3..."
npm rebuild better-sqlite3 2>&1
echo "🚀 Starting server..."
node server.js
