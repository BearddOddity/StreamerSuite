#!/bin/bash
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR/mcp-planner"

if [ ! -d node_modules ]; then
  npm install
fi

if [ ! -d dist ] || [ ! -f dist/index.js ]; then
  npm run build
fi
