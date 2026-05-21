@echo off
title Lotto Master
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed or is not available in PATH.
  echo Install Node.js, then run this file again.
  pause
  exit /b 1
)

where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo npm is not available in PATH.
  echo Reinstall Node.js, then run this file again.
  pause
  exit /b 1
)

echo Updating lotto data...
call npm.cmd run update:data
if errorlevel 1 (
  echo.
  echo Data update failed. Starting with the existing local data...
)

echo.
echo Starting Lotto Master...
echo If the browser does not open automatically, visit:
echo http://localhost:4173/
echo.
call npm.cmd start

echo.
echo Lotto Master stopped or failed to start.
pause
