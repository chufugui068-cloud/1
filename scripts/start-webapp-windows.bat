@echo off
setlocal

echo [1/4] Checking Node.js ...
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js not found. Please install Node.js LTS from https://nodejs.org
  pause
  exit /b 1
)

echo [2/4] Node version:
node -v

echo [3/4] Starting web app ...
cd /d "%~dp0..\webapp"
if "%PORT%"=="" set PORT=8787

echo Web app will run at: http://localhost:%PORT%
node server.js

endlocal
