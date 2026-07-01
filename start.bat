@echo off
title LMS Portal Launcher

echo ============================================================
echo   AI-Powered LMS Portal — Starting Servers
echo ============================================================
echo.

:: Kill any existing processes on ports 8000 and 5173 first
echo Clearing ports 8000 and 5173...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000 " 2^>nul') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173 " 2^>nul') do taskkill /F /PID %%a >nul 2>&1
timeout /t 2 /nobreak >nul

echo [1/2] Starting Backend on port 8000...
start "LMS Backend — keep this open" cmd /k "title LMS Backend && cd /d "%~dp0backend" && python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload && pause"

timeout /t 4 /nobreak >nul

echo [2/2] Starting Frontend on port 5173...
start "LMS Frontend — keep this open" cmd /k "title LMS Frontend && cd /d "%~dp0frontend" && node node_modules\vite\bin\vite.js && pause"

timeout /t 5 /nobreak >nul

echo.
echo ============================================================
echo   App is running at: http://localhost:5173
echo.
echo   IMPORTANT: Keep BOTH terminal windows open.
echo   Closing them will stop the app.
echo ============================================================
echo.

start "" "http://localhost:5173"
pause
