@echo off
cd /d "%~dp0backend"
py -m pip install -r requirements.txt
echo.
echo Open http://127.0.0.1:5000/   (UI + API)
py -m flask --app app.server run --port 5000
