#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/backend"
python3 -m pip install -r requirements.txt
echo "Open http://127.0.0.1:5000/   (UI + API)"
python3 -m flask --app app.server run --port 5000
