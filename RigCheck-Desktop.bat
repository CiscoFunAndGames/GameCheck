@echo off
title RigCheck Desktop Launcher
cd /d "%~dp0"
powershell -NoProfile -WindowStyle Hidden -Command "Start-Process -FilePath 'node' -ArgumentList 'src/desktop.js' -WorkingDirectory '%~dp0' -WindowStyle Hidden"
exit
