@echo off
title GameCheck — Pure C++17 Native Desktop Application (Win32/GDI+)
cd /d "%~dp0"
if exist "bin\GameCheck.exe" (
  start "" "bin\GameCheck.exe" %*
) else (
  echo [GameCheck] Compiling native C++17 desktop binary...
  if exist "C:\mingw64\bin\g++.exe" (
    "C:\mingw64\bin\g++.exe" -O2 -std=c++17 -mwindows native/gamecheck_desktop.cpp -o bin/GameCheck.exe -lgdiplus -luxtheme -lcomctl32 -lcomdlg32 -lshell32 -luser32 -lgdi32 -ladvapi32 -lole32 -luuid -static -s
    start "" "bin\GameCheck.exe" %*
  ) else (
    g++ -O2 -std=c++17 -mwindows native/gamecheck_desktop.cpp -o bin/GameCheck.exe -lgdiplus -luxtheme -lcomctl32 -lcomdlg32 -lshell32 -luser32 -lgdi32 -ladvapi32 -lole32 -luuid -static -s
    start "" "bin\GameCheck.exe" %*
  )
)
exit
