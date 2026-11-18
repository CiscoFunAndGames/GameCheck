#!/usr/bin/env bash
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

mkdir -p bin
if [ ! -x "./bin/gamecheck-desktop" ]; then
  if command -v g++ >/dev/null 2>&1; then
    if pkg-config --exists gtk+-3.0 2>/dev/null; then
      g++ -O2 -std=c++17 native/gamecheck_desktop.cpp -o bin/gamecheck-desktop $(pkg-config --cflags --libs gtk+-3.0) -DUSE_GTK3
    else
      g++ -O2 -std=c++17 native/gamecheck_desktop.cpp -o bin/gamecheck-desktop
    fi
    chmod +x ./bin/gamecheck-desktop
  fi
fi

if [ -x "./bin/gamecheck-desktop" ]; then
  exec "./bin/gamecheck-desktop" "$@"
else
  exec node "./src/cli.js" "$@"
fi
