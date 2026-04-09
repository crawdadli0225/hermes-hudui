#!/usr/bin/env bash
# Hermes HUD Web UI — installer
# Works on macOS and Linux/WSL
set -e

echo "☤ Hermes HUD Web UI — Install"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check Python
PYTHON=""
for cmd in python3.11 python3.12 python3.13 python3; do
    if command -v "$cmd" &>/dev/null; then
        version=$("$cmd" -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
        major=$(echo "$version" | cut -d. -f1)
        minor=$(echo "$version" | cut -d. -f2)
        if [ "$major" -ge 3 ] && [ "$minor" -ge 11 ]; then
            PYTHON="$cmd"
            break
        fi
    fi
done

if [ -z "$PYTHON" ]; then
    echo "✗ Python 3.11+ required but not found"
    echo "  Install: https://www.python.org/downloads/"
    exit 1
fi
echo "✔ Python: $($PYTHON --version)"

# Check Node
if ! command -v node &>/dev/null; then
    echo "✗ Node.js required but not found"
    echo "  Install: https://nodejs.org/"
    exit 1
fi
echo "✔ Node: $(node --version)"

# Check npm
if ! command -v npm &>/dev/null; then
    echo "✗ npm required but not found"
    exit 1
fi

# Check hermes-hud
if ! $PYTHON -c "import hermes_hud" 2>/dev/null; then
    echo "→ Installing hermes-hud..."
    if [ -d "../hermes-hud" ]; then
        $PYTHON -m pip install -e ../hermes-hud -q
    else
        $PYTHON -m pip install hermes-hud -q
    fi
fi
echo "✔ hermes-hud available"

# Install backend
echo "→ Installing backend..."
$PYTHON -m pip install -e . -q
echo "✔ Backend installed"

# Build frontend
echo "→ Building frontend..."
cd frontend
npm install --silent 2>/dev/null
npm run build 2>/dev/null
cd ..

# Copy to static
echo "→ Copying frontend build to backend/static..."
mkdir -p backend/static/assets
cp frontend/dist/index.html backend/static/
cp frontend/dist/assets/* backend/static/assets/
echo "✔ Frontend built"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✔ Ready. Run:"
echo ""
echo "  hermes-hudui"
echo ""
echo "  Then open http://localhost:3001"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
