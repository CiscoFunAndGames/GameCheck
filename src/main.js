const path = require('path');
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const { registerIpcHandlers } = require('./ipc-handlers');

const isSmokeTest = process.argv.includes('--smoke-test');
let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 680,
    minHeight: 560,
    show: !isSmokeTest,
    backgroundColor: '#0a0e17',
    autoHideMenuBar: true,
    title: 'RigCheck Optimizer — Native Desktop',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: true
    }
  });

  const indexHtmlPath = path.join(__dirname, '..', 'public', 'index.html');
  mainWindow.loadFile(indexHtmlPath);

  if (isSmokeTest) {
    mainWindow.webContents.once('did-finish-load', async () => {
      try {
        const smokeReport = await mainWindow.webContents.executeJavaScript(`
          (async () => {
            if (!window.rigcheckAPI || !window.rigcheckAPI.isNativeDesktop) {
              throw new Error('window.rigcheckAPI is not exposed in renderer');
            }
            const appInfo = await window.rigcheckAPI.getAppInfo();
            const specs = await window.rigcheckAPI.getSpecs({ refresh: false });
            const gamesRes = await window.rigcheckAPI.getGames({ q: 'cyberpunk' });
            const installedRes = await window.rigcheckAPI.getInstalled({ refresh: false });
            const analyzeRes = await window.rigcheckAPI.analyzeGame({ gameId: 'cyberpunk-2077', optimizationMode: 'full_fps' });
            const patchStatus = await window.rigcheckAPI.getPatchStatus();
            return {
              status: 'IPC_OK',
              calver: appInfo.calver,
              fullVersion: appInfo.fullVersion,
              scheme: appInfo.scheme,
              nativeProbeAvailable: appInfo.nativeProbeAvailable,
              probeArchitecture: appInfo.probeArchitecture,
              platform: appInfo.platform,
              arch: appInfo.arch,
              runtime: appInfo.runtime,
              electronVersion: appInfo.electronVersion,
              cpuDetected: specs && specs.cpu ? specs.cpu.name : null,
              gpuDetected: specs && specs.gpu ? specs.gpu.name : null,
              displayDetected: specs && specs.display ? (specs.display.resolutionLabel + ' @ ' + specs.display.refreshRateHz + 'Hz') : null,
              matchedGamesCount: gamesRes && Array.isArray(gamesRes.games) ? gamesRes.games.length : 0,
              installedCount: installedRes ? installedRes.count : 0,
              activeMode: analyzeRes && analyzeRes.analysis && analyzeRes.analysis.optimalConfig ? analyzeRes.analysis.optimalConfig.activeMode : analyzeRes.optimizationMode,
              availablePatches: patchStatus && Array.isArray(patchStatus.availablePatches) ? patchStatus.availablePatches.length : 0,
              installerCount: patchStatus && Array.isArray(patchStatus.installerArtifacts) ? patchStatus.installerArtifacts.length : 0
            };
          })()
        `);
        console.log(JSON.stringify(smokeReport));
        app.quit();
      } catch (err) {
        console.error(JSON.stringify({ status: 'IPC_ERROR', error: err.message }));
        app.exit(1);
      }
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  registerIpcHandlers(ipcMain, dialog, shell, app, () => mainWindow);
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
