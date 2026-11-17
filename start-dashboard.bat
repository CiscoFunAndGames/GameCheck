@echo off
title RigCheck Optimizer Dashboard
echo Starting RigCheck Optimizer on http://localhost:3040 ...
start http://localhost:3040
node "%~dp0src\server.js"
pause
