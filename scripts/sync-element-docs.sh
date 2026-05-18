#!/usr/bin/env bash
# Refresh element-docs/ from weweb-ai's localFallbackDocumentation.
# Run after weweb-ai ships new element schemas.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI_DIR="$(dirname "$SCRIPT_DIR")"
SRC="$CLI_DIR/../weweb-docker/weweb-ai/src/core/data/elements/localFallbackDocumentation"
DEST="$CLI_DIR/element-docs"

if [ ! -d "$SRC" ]; then
    echo "Source dir not found: $SRC" >&2
    echo "This script expects weweb-cli and weweb-docker to be sibling dirs." >&2
    exit 1
fi

mkdir -p "$DEST"
cp "$SRC"/*.json "$DEST"/

echo "Synced $(ls "$DEST" | wc -l | tr -d ' ') files into $DEST"
echo ""
echo "Changes vs git HEAD:"
git -C "$CLI_DIR" diff --stat -- element-docs/ || true
