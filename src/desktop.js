/**
 * Native Windows Desktop App Launcher for RigCheck (PC Game Compatibility & Optimal Settings)
 *
 * 1. Starts the local Node.js backend (`src/server.js`) on port 3040 (or reuses it if already running).
 * 2. Waits until `http://localhost:3040/api/specs` responds Ready.
 * 3. Launches a standalone chromeless Windows desktop window using Microsoft Edge or Google Chrome
 *    in `--app` mode with an isolated `--user-data-dir` so window lifecycle is tracked accurately.
 * 4. Automatically shuts down the Node.js server when the user closes the desktop app window.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const { spawn } = require('child_process');

const PORT = Number(process.env.PORT) || 3040;
const APP_URL = `http://localhost:${PORT}`;

function findDesktopBrowserBinary() {
  const localAppData = process.env.LOCALAPPDATA || '';
  const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
  const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';

  const candidates = [
    path.join(programFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(programFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    localAppData ? path.join(localAppData, 'Microsoft', 'Edge', 'Application', 'msedge.exe') : '',
    path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    localAppData ? path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe') : '',
    path.join(programFiles, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),
    localAppData ? path.join(localAppData, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe') : ''
  ].filter(Boolean);

  for (const binPath of candidates) {
    try {
      if (fs.existsSync(binPath)) {
        return binPath;
      }
    } catch (e) {
      // ignore inaccessible paths
    }
  }
  return null;
}

function probeServerReady(timeoutMs = 1200) {
  return new Promise((resolve) => {
    const req = http.get(`${APP_URL}/api/specs`, { timeout: timeoutMs }, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForServer(maxAttempts = 30, intervalMs = 250) {
  for (let i = 0; i < maxAttempts; i++) {
    const ready = await probeServerReady();
    if (ready) return true;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

async function launchDesktopApp() {
  const isCheckOnly = process.argv.includes('--check');
  const browserBin = findDesktopBrowserBinary();

  const alreadyRunning = await probeServerReady();
  if (!alreadyRunning) {
    require('./server');
  }

  const ready = await waitForServer();
  if (!ready) {
    console.error(`[RigCheck Desktop] Failed to reach backend at ${APP_URL}`);
    process.exit(1);
  }

  if (isCheckOnly) {
    console.log(JSON.stringify({
      status: 'READY',
      url: APP_URL,
      browserBin: browserBin || 'fallback-start',
      alreadyRunning
    }));
    process.exit(0);
  }

  const profileDir = path.join(os.tmpdir(), 'rigcheck-desktop-window-profile');
  try {
    fs.mkdirSync(profileDir, { recursive: true });
  } catch (e) {
    // ignore if exists
  }

  if (browserBin) {
    const args = [
      `--app=${APP_URL}`,
      '--window-size=1420,920',
      `--user-data-dir=${profileDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-features=Translate,msEdgeSidebarV2'
    ];

    console.log(`[RigCheck Desktop] Launching native window via: ${path.basename(browserBin)}`);
    const child = spawn(browserBin, args, {
      stdio: 'ignore',
      detached: false
    });

    child.on('exit', () => {
      console.log('[RigCheck Desktop] Window closed. Shutting down RigCheck server.');
      process.exit(0);
    });

    child.on('error', (err) => {
      console.error(`[RigCheck Desktop] Error launching window: ${err.message}`);
      process.exit(1);
    });
  } else {
    console.log(`[RigCheck Desktop] Opening ${APP_URL} in default browser...`);
    spawn('cmd.exe', ['/c', 'start', '', APP_URL], { stdio: 'ignore' });
  }
}

if (require.main === module) {
  launchDesktopApp();
}

module.exports = {
  findDesktopBrowserBinary,
  probeServerReady,
  launchDesktopApp
};
