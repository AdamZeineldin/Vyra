#!/usr/bin/env bash
# Installs Python and Node.js runtimes into the self-hosted Piston instance.
# Run this once after `docker compose up -d`.

set -euo pipefail

PISTON_URL="${PISTON_URL:-http://localhost:2000}"
MAX_WAIT=60

echo "Waiting for Piston to be ready at $PISTON_URL..."
for i in $(seq 1 $MAX_WAIT); do
  if curl -sf "$PISTON_URL/api/v2/runtimes" > /dev/null 2>&1; then
    echo "Piston is up."
    break
  fi
  if [ "$i" -eq "$MAX_WAIT" ]; then
    echo "ERROR: Piston did not become ready after ${MAX_WAIT}s. Is the container running?"
    exit 1
  fi
  sleep 1
done

install_runtime() {
  local lang="$1"
  local version="$2"
  echo "Installing $lang $version..."
  response=$(curl -sf --request POST \
    --url "$PISTON_URL/api/v2/packages" \
    --header "Content-Type: application/json" \
    --data "{\"language\":\"$lang\",\"version\":\"$version\"}" 2>&1) || {
    echo "  WARNING: failed to install $lang $version — $response"
    return
  }
  echo "  Done: $response"
}

install_runtime "python"     "3.10.0"
install_runtime "javascript" "18.15.0"
install_runtime "typescript" "5.0.3"
install_runtime "java"       "15.0.2"
install_runtime "go"         "1.16.2"

echo ""
echo "Installed runtimes:"
curl -sf "$PISTON_URL/api/v2/runtimes" | python3 -c "
import json, sys
for r in json.load(sys.stdin):
    print(f\"  {r['language']} {r['version']}\")
" 2>/dev/null || curl -sf "$PISTON_URL/api/v2/runtimes"

echo ""
echo "Done. Piston is ready."
