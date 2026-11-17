# RigCheck Optimizer (`pc-game-checker`)

A zero-dependency Node.js application that scans your Windows PC components (CPU, GPU, VRAM, System RAM, Storage Drives, OS), evaluates whether your rig can run popular or custom games, detects hardware bottlenecks, and recommends optimal in-game graphics settings and target FPS.

## Features
- **Real-Time PC Hardware Scanner**: Automatically detects your CPU, cores/threads, GPU model, VRAM, driver version, RAM, and all local storage drives (`C:`, `D:`, `E:`, `F:`, etc.).
- **"Can I Run It?" Compatibility Engine**: Evaluates your hardware on a normalized 0–100 tier scale against game Minimum & Recommended requirements.
- **Optimal Graphics Settings Advisor**: Recommends Target Resolution (`1080p`, `1440p`, `4K`), Preset (`Low`, `Medium`, `High`, `Ultra`), Upscaling (`FSR` / `DLSS`), Frame Generation, Texture/Shadow quality, Ray Tracing, and estimated FPS ranges.
- **Hardware Upgrade Simulator ("What-If" Mode)**: Test how any game would perform if you upgraded your CPU, GPU, or RAM.
- **Custom Game Analyzer**: Check any game by entering its Minimum and Recommended specs.

## Quick Start

### 1. Run the Web Dashboard
```powershell
npm start
```
Then open **http://localhost:3040** in your browser.
*(Or double-click `start-dashboard.bat` on Windows).*

### 2. Run the CLI Checker
```powershell
npm run check
```
To check a specific game from the terminal:
```powershell
node src/cli.js cyberpunk
```

## Project Structure
- `src/hardware.js` — Hardware detection and CPU/GPU benchmark scoring table
- `src/games-db.js` — Game requirements catalog and engine tuning tips
- `src/analyzer.js` — Compatibility & optimal settings calculator
- `src/server.js` — Local HTTP server and REST API (`/api/specs`, `/api/games`, `/api/analyze`)
- `src/cli.js` — Command-line interface
- `public/` — Web UI (`index.html`, `styles.css`, `app.js`)
