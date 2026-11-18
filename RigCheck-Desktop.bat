@echo off
title GameCheck — Pure C++17 Native Desktop Application (Win32/GDI+)
cd /d "%~dp0"
if exist "bin\GameCheck.exe" (
  start "" "bin\GameCheck.exe" %*
) else (
  call "%~dp0GameCheck-Desktop.bat" %*
)
exit
