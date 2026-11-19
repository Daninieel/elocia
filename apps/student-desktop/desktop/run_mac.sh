#!/bin/bash
# Move to the script's directory
cd "$(dirname "$0")"

echo "=========================================================="
echo "           Starting ELOCIA Student for macOS              "
echo "=========================================================="
echo ""

# 1. Check Python 3
if ! command -v python3 &> /dev/null; then
    echo "[ERROR] Python 3 is not installed on your Mac."
    echo "Please download and install it from: https://www.python.org/downloads/mac-osx/"
    exit 1
fi

echo "[INFO] Python detected: $(python3 --version)"

# 2. Check and install dependencies
echo "[1/2] Checking required AI & UI packages..."
pip3 install -r requirements.txt pyobjc-framework-WebKit --quiet

# 3. Launch ELOCIA
echo "[2/2] Launching ELOCIA Student native Mac window..."
python3 main.py
