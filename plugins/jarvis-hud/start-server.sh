#!/bin/bash
# Serve the HUD statically on :8080 (ES modules require http://, not file://).
# The HUD talks to the OpenJarvis API on :8000 (start it with `jarvis serve`).
set -euo pipefail
cd "$(dirname "$0")/public"
exec python3 -m http.server "${1:-8080}"
