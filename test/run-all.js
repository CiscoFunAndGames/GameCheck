#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT_DIR, 'src');
const SCRIPTS_DIR = path.join(ROOT_DIR, 'scripts');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');

let passedSuites = 0;
let failedSuites = 0;
const failures = [];

function logHeader(title) {
  console.log(`\n================================================================`);
  console.log(`  ${title}`);
  console.log(`================================================================`);
}

async function runSuite(name, fn) {
  try {
    await fn();
    passedSuites++;
    console.log(`[PASS] ${name}`);
  } catch (err) {
    failedSuites++;
    failures.push({ name, error: err });
    console.error(`[FAIL] ${name}`);
    console.error(`       ${err && err.stack ? err.stack : err}`);
  }
}

async function main() {
  console.log(`RigCheck Optimizer — Full Verification & Integration Suite`);
  console.log(`Platform: ${process.platform} (${process.arch}) | Node: ${process.version}`);

  // 1. Syntax Validation across all src/*.js, scripts/*.js, and public/app.js
  logHeader('1. Syntax Validation (node --check)');
  await runSuite('Syntax check all src/*.js, scripts/*.js, and public/app.js', () => {
    const srcFiles = fs
      .readdirSync(SRC_DIR)
      .filter((f) => f.endsWith('.js'))
      .map((f) => path.join(SRC_DIR, f));
    const scriptFiles = fs.existsSync(SCRIPTS_DIR)
      ? fs
          .readdirSync(SCRIPTS_DIR)
          .filter((f) => f.endsWith('.js'))
          .map((f) => path.join(SCRIPTS_DIR, f))
      : [];
    const filesToCheck = [...srcFiles, ...scriptFiles, path.join(PUBLIC_DIR, 'app.js')];

    for (const filePath of filesToCheck) {
      const rel = path.relative(ROOT_DIR, filePath);
      assert.ok(fs.existsSync(filePath), `Expected file to exist: ${rel}`);
      execFileSync(process.execPath, ['--check', filePath], {
        cwd: ROOT_DIR,
        stdio: 'pipe',
        encoding: 'utf8'
      });
      console.log(`  ✓ node --check ${rel}`);
    }
  });

  // 2. Hardware Detection & Cross-Platform Linux/Windows Parser Suite
  logHeader('2. Hardware Detection Suite (test/hardware.test.js)');
  await runSuite('test/hardware.test.js', () => {
    const hwTestPath = path.join(__dirname, 'hardware.test.js');
    assert.ok(fs.existsSync(hwTestPath), 'test/hardware.test.js is missing');
    const out = execFileSync(process.execPath, [hwTestPath], {
      cwd: ROOT_DIR,
      stdio: 'pipe',
      encoding: 'utf8'
    });
    if (out && out.trim()) {
      console.log(out.trim().split('\n').map((l) => `  ${l}`).join('\n'));
    }
  });

  // 3. Cross-Platform Installed Game Scanner Suite
  logHeader('3. Installed Scanner Suite (test/scanner.test.js)');
  await runSuite('test/scanner.test.js', () => {
    const scannerTestPath = path.join(__dirname, 'scanner.test.js');
    assert.ok(fs.existsSync(scannerTestPath), 'test/scanner.test.js is missing');
    const out = execFileSync(process.execPath, [scannerTestPath], {
      cwd: ROOT_DIR,
      stdio: 'pipe',
      encoding: 'utf8'
    });
    if (out && out.trim()) {
      console.log(out.trim().split('\n').map((l) => `  ${l}`).join('\n'));
    }
  });

  // 4. CalVer Versioning, SHA-256 Patch Engine & Native Installer Suite
  logHeader('4. CalVer, Patch Engine & Installer Suite (test/version-patch.test.js)');
  await runSuite('test/version-patch.test.js', () => {
    const vpTestPath = path.join(__dirname, 'version-patch.test.js');
    assert.ok(fs.existsSync(vpTestPath), 'test/version-patch.test.js is missing');
    const out = execFileSync(process.execPath, [vpTestPath], {
      cwd: ROOT_DIR,
      stdio: 'pipe',
      encoding: 'utf8'
    });
    if (out && out.trim()) {
      console.log(out.trim().split('\n').map((l) => `  ${l}`).join('\n'));
    }
  });

  // 5. IPC Handler Integration Tests against src/ipc-handlers.js
  logHeader('5. Electron IPC Handler Integration Tests (src/ipc-handlers.js)');
  await runSuite('IPC Handlers Registration & Channel Invocations', async () => {
    const ipcHandlersPath = path.join(SRC_DIR, 'ipc-handlers.js');
    assert.ok(fs.existsSync(ipcHandlersPath), 'src/ipc-handlers.js is missing');
    const ipcModule = require(ipcHandlersPath);

    assert.strictEqual(
      typeof ipcModule.registerIpcHandlers,
      'function',
      'Expected registerIpcHandlers function export in src/ipc-handlers.js'
    );

    const registeredChannels = new Map();
    const mockIpcMain = {
      handle(channel, handler) {
        registeredChannels.set(channel, handler);
      }
    };

    const tempSaveFile = path.join(os.tmpdir(), `rigcheck-ipc-test-${Date.now()}.ini`);
    let lastOpenedPath = null;

    const mockDialog = {
      async showSaveDialog(_winOrOpts, maybeOpts) {
        const opts = maybeOpts || _winOrOpts || {};
        return {
          canceled: false,
          filePath: tempSaveFile,
          _opts: opts
        };
      },
      async showOpenDialog() {
        return { canceled: true, filePaths: [] };
      }
    };

    const mockShell = {
      async openPath(targetPath) {
        lastOpenedPath = targetPath;
        return '';
      }
    };

    const mockApp = {
      getName: () => 'RigCheck Optimizer',
      getVersion: () => '2026.11.17'
    };

    ipcModule.registerIpcHandlers(mockIpcMain, mockDialog, mockShell, mockApp);

    const expectedChannels = [
      'rigcheck:get-specs',
      'rigcheck:get-games',
      'rigcheck:get-installed',
      'rigcheck:analyze',
      'rigcheck:parse-reqs',
      'rigcheck:save-config',
      'rigcheck:open-path',
      'rigcheck:get-app-info',
      'rigcheck:get-patch-status',
      'rigcheck:apply-patch',
      'rigcheck:create-patch',
      'rigcheck:rollback-patch',
      'rigcheck:get-firewall-status',
      'rigcheck:request-firewall-access',
      'rigcheck:revoke-firewall-access',
      'rigcheck:search-component-deals',
      'rigcheck:open-external-url'
    ];

    for (const ch of expectedChannels) {
      assert.ok(registeredChannels.has(ch), `Missing IPC channel handler: ${ch}`);
      console.log(`  ✓ Registered IPC channel: ${ch}`);
    }

    const invoke = async (channel, payload) => {
      const fn = registeredChannels.get(channel);
      return await fn({ sender: {} }, payload);
    };

    // 5a. rigcheck:get-app-info (with CalVer + Native Probe metadata)
    const appInfo = await invoke('rigcheck:get-app-info');
    assert.ok(appInfo && typeof appInfo === 'object', 'get-app-info should return an object');
    assert.strictEqual(appInfo.name, 'RigCheck Optimizer');
    assert.strictEqual(appInfo.platform, process.platform);
    assert.strictEqual(appInfo.runtime, 'electron-ipc');
    assert.ok(appInfo.calver && /^\d{4}\.\d{2}\.\d{2}/.test(appInfo.calver), 'appInfo.calver should be a valid CalVer string');
    assert.ok(appInfo.fullVersion, 'appInfo.fullVersion should be present');
    assert.strictEqual(appInfo.nativeProbeAvailable, true, 'appInfo.nativeProbeAvailable should be true');
    console.log(
      `  ✓ rigcheck:get-app-info -> ${appInfo.name} CalVer ${appInfo.fullVersion} [probe=${appInfo.probeArchitecture}] (${appInfo.platform}/${appInfo.arch})`
    );

    // 5b. rigcheck:get-specs (including primary display & connected displays)
    const specs = await invoke('rigcheck:get-specs', { refresh: false });
    assert.ok(specs && specs.cpu && specs.gpu && specs.ram && specs.storage, 'get-specs should return cpu, gpu, ram, storage');
    assert.ok(typeof specs.cpu.score === 'number', 'cpu.score should be a number');
    assert.ok(typeof specs.gpu.score === 'number', 'gpu.score should be a number');
    assert.ok(Array.isArray(specs.storage.allDrives), 'specs.storage.allDrives should be an array');
    assert.ok(specs.display && typeof specs.display.width === 'number' && typeof specs.display.refreshRateHz === 'number', 'specs.display should include width, height, refreshRateHz');
    assert.ok(Array.isArray(specs.displays) && specs.displays.length >= 1, 'specs.displays should be a non-empty array');
    console.log(
      `  ✓ rigcheck:get-specs -> CPU: ${specs.cpu.name} (${specs.cpu.score}) | GPU: ${specs.gpu.name} (${specs.gpu.score}) | Display: ${specs.display.name} (${specs.display.width}x${specs.display.height} @ ${specs.display.refreshRateHz}Hz)`
    );

    // 5c. rigcheck:get-games
    const gamesRes = await invoke('rigcheck:get-games', { q: 'cyberpunk', genre: '', tier: '', sort: '' });
    assert.ok(gamesRes && Array.isArray(gamesRes.games), 'get-games should return games array');
    assert.ok(Array.isArray(gamesRes.genres) && gamesRes.genres.length > 0, 'get-games should return genres');
    assert.ok(gamesRes.games.length >= 1, 'get-games filter for "cyberpunk" should return at least 1 match');
    assert.ok(gamesRes.games[0].analysis, 'each game in get-games should include compatibility analysis');
    assert.ok(gamesRes.games[0].bannerUrl, 'each game in get-games should include bannerUrl');
    assert.ok(gamesRes.games[0].logoUrl, 'each game in get-games should include logoUrl');
    assert.ok(gamesRes.games[0].fallbackBannerSvg && gamesRes.games[0].fallbackBannerSvg.startsWith('data:image/svg+xml'), 'each game should include fallbackBannerSvg');
    assert.ok(gamesRes.games[0].playStatus && gamesRes.games[0].playStatusLabel, 'each game should include playStatus and playStatusLabel');
    console.log(`  ✓ rigcheck:get-games -> matched ${gamesRes.games.length} game(s) for query "cyberpunk" [banner=${Boolean(gamesRes.games[0].bannerUrl)}, status=${gamesRes.games[0].playStatus}]`);

    // 5d. rigcheck:get-installed
    const installedRes = await invoke('rigcheck:get-installed', { refresh: false });
    assert.ok(installedRes && Array.isArray(installedRes.games), 'get-installed should return games array');
    assert.strictEqual(installedRes.count, installedRes.games.length, 'count should match games.length');
    if (installedRes.games.length > 0) {
      assert.ok(installedRes.games[0].bannerUrl, 'installed game should include bannerUrl');
      assert.ok(installedRes.games[0].fallbackBannerSvg, 'installed game should include fallbackBannerSvg');
      assert.ok(installedRes.games[0].playStatus, 'installed game should include playStatus');
    }
    console.log(`  ✓ rigcheck:get-installed -> ${installedRes.count} installed game(s) detected`);

    // 5e. rigcheck:analyze (catalog game + custom hardware & display override + all 4 optimizationModes)
    const modesToTest = ['optimal', 'full_fps', 'balanced', 'quality_30_60'];
    let analyzeRes = null;
    for (const mode of modesToTest) {
      const res = await invoke('rigcheck:analyze', {
        gameId: 'cyberpunk-2077',
        optimizationMode: mode,
        customHardware: {
          cpuName: 'AMD Ryzen 7 7800X3D',
          gpuName: 'NVIDIA GeForce RTX 4070 Super',
          vramGB: 12,
          ramGB: 32,
          displayWidth: 2560,
          displayHeight: 1440,
          displayHz: 165,
          displayName: 'Simulated 1440p 165Hz Display'
        }
      });
      assert.ok(res && res.game && res.analysis, `analyze (${mode}) should return game and analysis`);
      assert.strictEqual(res.analysis.optimalConfig.activeMode, mode, `activeMode should match requested mode ${mode}`);
      assert.ok(res.analysis.optimalConfig.displayTarget, `analyze (${mode}) should include optimalConfig.displayTarget`);
      assert.ok(res.analysis.optimalConfig.modeProfiles && res.analysis.optimalConfig.modeProfiles[mode], `modeProfiles.${mode} should exist`);
      if (mode === 'optimal') analyzeRes = res;
    }
    assert.strictEqual(analyzeRes.game.id, 'cyberpunk-2077');
    assert.ok(Array.isArray(analyzeRes.perSettingImpact), 'analyze should include perSettingImpact array');
    assert.ok(
      analyzeRes.exportedConfigs && analyzeRes.exportedConfigs.iniContent && analyzeRes.exportedConfigs.jsonContent,
      'analyze should include exportedConfigs (iniContent, jsonContent, markdownGuide)'
    );
    console.log(
      `  ✓ rigcheck:analyze (4 modes verified) -> ${analyzeRes.game.title}: ${analyzeRes.analysis.overallTier} (${analyzeRes.analysis.optimalConfig.targetResolution} ${analyzeRes.analysis.optimalConfig.preset} @ ${analyzeRes.analysis.optimalConfig.displayTarget.refreshRateHz}Hz)`
    );

    // 5f. rigcheck:parse-reqs (raw Steam system requirements text)
    const rawSteamText = `
      Minimum:
      OS: Windows 10 64-bit
      Processor: Intel Core i5-8400 or AMD Ryzen 3 3300X
      Memory: 12 GB RAM
      Graphics: NVIDIA GeForce GTX 1060 6GB or AMD Radeon RX 580 8GB
      Storage: 60 GB available space
      Recommended:
      Processor: Intel Core i7-8700K or AMD Ryzen 5 3600X
      Memory: 16 GB RAM
      Graphics: NVIDIA GeForce RTX 2070 SUPER or AMD Radeon RX 5700 XT
    `;
    const parseRes = await invoke('rigcheck:parse-reqs', {
      title: 'Elden Ring Test Spec',
      text: rawSteamText
    });
    assert.ok(parseRes && parseRes.game && parseRes.analysis, 'parse-reqs should return parsed game and analysis');
    assert.strictEqual(parseRes.game.title, 'Elden Ring Test Spec');
    assert.ok(parseRes.exportedConfigs && parseRes.exportedConfigs.markdownGuide, 'parse-reqs should include exportedConfigs');
    console.log(`  ✓ rigcheck:parse-reqs -> Parsed "${parseRes.game.title}" (Min RAM: ${parseRes.game.minimum.ramGB}GB, Rec RAM: ${parseRes.game.recommended.ramGB}GB)`);

    // 5g. rigcheck:save-config
    const saveRes = await invoke('rigcheck:save-config', {
      defaultFilename: 'cyberpunk-settings.ini',
      content: analyzeRes.exportedConfigs.iniContent,
      format: 'ini'
    });
    assert.ok(saveRes && !saveRes.canceled, 'save-config should succeed with mock dialog');
    assert.strictEqual(saveRes.filePath, tempSaveFile);
    assert.ok(fs.existsSync(tempSaveFile), 'save-config should write file to disk');
    fs.unlinkSync(tempSaveFile);
    console.log(`  ✓ rigcheck:save-config -> wrote ${saveRes.bytesWritten} bytes via native dialog`);

    // 5h. rigcheck:open-path
    const openRes = await invoke('rigcheck:open-path', { targetPath: ROOT_DIR });
    assert.ok(openRes && openRes.ok === true, 'open-path should return { ok: true } for existing directory');
    assert.strictEqual(path.resolve(lastOpenedPath), ROOT_DIR);
    console.log(`  ✓ rigcheck:open-path -> verified shell.openPath(${lastOpenedPath})`);

    // 5i. rigcheck:get-patch-status
    const patchStatus = await invoke('rigcheck:get-patch-status');
    assert.ok(patchStatus && patchStatus.versionInfo, 'get-patch-status should return versionInfo');
    assert.ok(Array.isArray(patchStatus.availablePatches), 'get-patch-status should return availablePatches array');
    assert.ok(Array.isArray(patchStatus.patchHistory), 'get-patch-status should return patchHistory array');
    assert.ok(patchStatus.installerArtifacts, 'get-patch-status should return installerArtifacts');
    console.log(
      `  ✓ rigcheck:get-patch-status -> version=${patchStatus.versionInfo.fullVersion}, patches=${patchStatus.availablePatches.length}`
    );

    // 5j. rigcheck:create-patch, rigcheck:apply-patch & rigcheck:rollback-patch round-trip in isolated temp root
    const tempPatchWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), 'rigcheck-ipc-patch-'));
    try {
      fs.mkdirSync(path.join(tempPatchWorkspace, 'src'), { recursive: true });
      fs.mkdirSync(path.join(tempPatchWorkspace, 'public'), { recursive: true });
      fs.copyFileSync(path.join(ROOT_DIR, 'version.json'), path.join(tempPatchWorkspace, 'version.json'));
      fs.copyFileSync(path.join(ROOT_DIR, 'package.json'), path.join(tempPatchWorkspace, 'package.json'));
      fs.copyFileSync(path.join(SRC_DIR, 'version.js'), path.join(tempPatchWorkspace, 'src', 'version.js'));
      fs.copyFileSync(path.join(PUBLIC_DIR, 'index.html'), path.join(tempPatchWorkspace, 'public', 'index.html'));

      const tempPatchOut = path.join(tempPatchWorkspace, 'ipc-test-patch.rigpatch.json');
      const tempBackupDir = path.join(tempPatchWorkspace, 'backups');

      const liveVer = require('../src/version').getVersionInfo(ROOT_DIR);
      const nextTestVersion = `${liveVer.calver}.${(liveVer.patchLevel || 0) + 1}`;

      const createPatchRes = await invoke('rigcheck:create-patch', {
        targetDir: tempPatchWorkspace,
        outputPath: tempPatchOut,
        targetVersion: nextTestVersion,
        notes: 'Automated IPC integration test patch',
        files: ['version.json', 'src/version.js', 'public/index.html']
      });
      assert.ok(createPatchRes && createPatchRes.ok, 'create-patch should return { ok: true }');
      assert.ok(createPatchRes.patchPath && fs.existsSync(createPatchRes.patchPath), 'created patch file should exist on disk');
      console.log(
        `  ✓ rigcheck:create-patch -> ${path.basename(createPatchRes.patchPath)} (target=${createPatchRes.targetVersion}, files=${createPatchRes.fileCount})`
      );

      const applyPatchRes = await invoke('rigcheck:apply-patch', {
        patchPath: createPatchRes.patchPath,
        appRootDir: tempPatchWorkspace,
        backupDir: tempBackupDir
      });
      assert.ok(applyPatchRes && applyPatchRes.ok, 'apply-patch should succeed');
      assert.strictEqual(applyPatchRes.newVersion, nextTestVersion);
      console.log(
        `  ✓ rigcheck:apply-patch -> upgraded ${applyPatchRes.previousVersion} -> ${applyPatchRes.newVersion} (${applyPatchRes.filesUpdated} files)`
      );

      const rollbackRes = await invoke('rigcheck:rollback-patch', {
        appRootDir: tempPatchWorkspace,
        backupDir: tempBackupDir
      });
      assert.ok(rollbackRes && rollbackRes.ok, 'rollback-patch should succeed and restore previous version');
      assert.strictEqual(rollbackRes.restoredVersion, liveVer.fullVersion);
      console.log(`  ✓ rigcheck:rollback-patch -> restored version ${rollbackRes.restoredVersion}`);
    } finally {
      fs.rmSync(tempPatchWorkspace, { recursive: true, force: true });
    }

    // 5k. Firewall Gate & Country-Aware Price/Deals IPC Channels
    await invoke('rigcheck:revoke-firewall-access');
    const fwStatusInitial = await invoke('rigcheck:get-firewall-status');
    assert.strictEqual(fwStatusInitial.granted, false, 'Firewall status should be false after revoke');
    assert.ok(Array.isArray(fwStatusInitial.countries) && fwStatusInitial.countries.some((c) => c.code === 'AR'));

    const blockedDeals = await invoke('rigcheck:search-component-deals', {
      query: 'AMD Radeon RX 7600',
      country: 'AR'
    });
    assert.strictEqual(blockedDeals.error, 'FIREWALL_PERMISSION_REQUIRED');

    const fwGrantRes = await invoke('rigcheck:request-firewall-access', {
      country: 'AR',
      query: 'AMD Radeon RX 7600',
      autoApprove: true
    });
    assert.strictEqual(fwGrantRes.granted, true);

    const arDeals = await invoke('rigcheck:search-component-deals', {
      query: 'AMD Radeon RX 7600',
      country: 'AR',
      strictReputation: true,
      skipLiveNetwork: true
    });
    assert.strictEqual(arDeals.status, 'OK');
    assert.strictEqual(arDeals.country, 'AR');
    assert.ok(arDeals.deals.length >= 7);

    const openUrlRes = await invoke('rigcheck:open-external-url', {
      url: arDeals.deals[0].url
    });
    assert.strictEqual(openUrlRes.ok, true);
    await invoke('rigcheck:revoke-firewall-access');
    console.log(
      `  ✓ rigcheck:search-component-deals (AR) -> ${arDeals.deals.length} verified stores, ${arDeals.reputationAudit.blockedBadReputationCount} untrusted sellers blocked`
    );
  });

  // 6. Country-Aware Component Price & Verified Deals Finder Suite
  logHeader('6. Country-Aware Component Price & Verified Deals Suite (test/price-finder.test.js)');
  await runSuite('test/price-finder.test.js', () => {
    const pfTestPath = path.join(__dirname, 'price-finder.test.js');
    assert.ok(fs.existsSync(pfTestPath), 'test/price-finder.test.js is missing');
    const out = execFileSync(process.execPath, [pfTestPath], {
      cwd: ROOT_DIR,
      stdio: 'pipe',
      encoding: 'utf8'
    });
    if (out && out.trim()) {
      console.log(out.trim().split('\n').map((l) => `  ${l}`).join('\n'));
    }
  });

  // 7. Pure C++17 Native Desktop GUI (bin/GameCheck.exe) & Core Engine (bin/test-gamecheck-core.exe) Suite
  logHeader('7. Pure C++17 Native Desktop GUI & Core Engine Suite (GameCheck.exe)');
  await runSuite('C++17 Core Engine (test-gamecheck-core.exe) & Native Win32/GDI+ GUI (GameCheck.exe --smoke-test)', () => {
    if (process.platform === 'win32') {
      const coreTestExe = path.join(ROOT_DIR, 'bin', 'test-gamecheck-core.exe');
      assert.ok(fs.existsSync(coreTestExe), 'Expected bin/test-gamecheck-core.exe to exist');
      const coreOut = execFileSync(coreTestExe, [], {
        cwd: ROOT_DIR,
        stdio: 'pipe',
        encoding: 'utf8',
        timeout: 15000
      });
      assert.ok(coreOut.includes('FAILED: 0'), 'Expected 0 failures in bin/test-gamecheck-core.exe');
      console.log(`  ✓ bin/test-gamecheck-core.exe passed all C++17 core unit tests`);

      const gameCheckExe = path.join(ROOT_DIR, 'bin', 'GameCheck.exe');
      assert.ok(fs.existsSync(gameCheckExe), 'Expected bin/GameCheck.exe to exist');
      const smokeOut = execFileSync(gameCheckExe, ['--smoke-test'], {
        cwd: ROOT_DIR,
        stdio: 'pipe',
        encoding: 'utf8',
        timeout: 15000
      });
      const smokeJson = JSON.parse(smokeOut.trim());
      assert.strictEqual(smokeJson.status, 'NATIVE_GUI_OK');
      assert.strictEqual(smokeJson.appName, 'GameCheck');
      assert.strictEqual(smokeJson.calver, '2026.11.17');
      assert.strictEqual(smokeJson.fullVersion, '2026.11.17.2');
      assert.strictEqual(smokeJson.runtime, 'native-cpp17-win32-gdiplus');
      assert.strictEqual(smokeJson.catalogGames, 24);
      assert.ok(smokeJson.cpuDetected && smokeJson.gpuDetected && smokeJson.displayDetected);
      console.log(
        `  ✓ bin/GameCheck.exe --smoke-test -> ${smokeJson.appName} v${smokeJson.fullVersion} [${smokeJson.runtime}] (${smokeJson.cpuDetected} | ${smokeJson.gpuDetected} | ${smokeJson.displayDetected})`
      );

      const gameCheckSetupExe = path.join(ROOT_DIR, 'dist', 'GameCheck-Setup-2026.11.17.exe');
      assert.ok(fs.existsSync(gameCheckSetupExe), 'Expected dist/GameCheck-Setup-2026.11.17.exe to exist');
      const setupVerifyOut = execFileSync(gameCheckSetupExe, ['--verify'], {
        cwd: ROOT_DIR,
        stdio: 'pipe',
        encoding: 'utf8',
        timeout: 10000
      });
      const setupVerifyJson = JSON.parse(setupVerifyOut.trim());
      assert.strictEqual(setupVerifyJson.status, 'INSTALLER_OK');
      assert.strictEqual(setupVerifyJson.appName, 'GameCheck');
      console.log(`  ✓ dist/GameCheck-Setup-2026.11.17.exe --verify -> ${setupVerifyJson.status} (${setupVerifyJson.fullVersion})`);
    }
  });

  logHeader('Summary');
  console.log(`Suites Passed: ${passedSuites}`);
  console.log(`Suites Failed: ${failedSuites}`);

  if (failedSuites > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
