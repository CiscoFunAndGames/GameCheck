const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const {
  getVersionInfo,
  formatCalVer,
  parseCalVer,
  compareCalVer,
  bumpCalVer
} = require('../src/version');

const {
  createPatchBundle,
  validatePatchBundle,
  applyPatchBundle,
  rollbackLastPatch,
  listAvailablePatches,
  getPatchHistory,
  getInstallerArtifacts
} = require('../src/patcher');

const ROOT_DIR = path.join(__dirname, '..');

function runVersionPatchTests() {
  console.log('--- Running CalVer Versioning, SHA-256 Patch & Native Installer Tests (test/version-patch.test.js) ---');

  // 1. Test CalVer parse, format, and compare
  const p1 = parseCalVer('2026.11.17');
  assert.strictEqual(p1.valid, true);
  assert.strictEqual(p1.year, 2026);
  assert.strictEqual(p1.month, 11);
  assert.strictEqual(p1.day, 17);
  assert.strictEqual(p1.patchLevel, 0);
  assert.strictEqual(p1.calver, '2026.11.17');
  assert.strictEqual(p1.fullVersion, '2026.11.17');

  const p2 = parseCalVer('v2026.11.17.2');
  assert.strictEqual(p2.valid, true);
  assert.strictEqual(p2.calver, '2026.11.17');
  assert.strictEqual(p2.patchLevel, 2);
  assert.strictEqual(p2.fullVersion, '2026.11.17.2');

  assert.strictEqual(parseCalVer('invalid-version').valid, false);
  assert.strictEqual(formatCalVer(new Date(2026, 10, 17), 0), '2026.11.17');
  assert.strictEqual(formatCalVer(new Date(2026, 10, 17), 3), '2026.11.17.3');

  assert.strictEqual(compareCalVer('2026.11.17', '2026.11.17'), 0);
  assert.strictEqual(compareCalVer('2026.11.17.1', '2026.11.17'), 1);
  assert.strictEqual(compareCalVer('2026.11.16', '2026.11.17'), -1);
  assert.strictEqual(compareCalVer('2026.12.01', '2026.11.17.5'), 1);

  const liveVersion = getVersionInfo(ROOT_DIR);
  assert.ok(/^\d{4}\.\d{2}\.\d{2}$/.test(liveVersion.calver), 'liveVersion.calver should be YYYY.MM.DD');
  assert.ok(liveVersion.patchLevel >= 0, 'patchLevel should be >= 0');
  const expectedFull = liveVersion.patchLevel > 0 ? `${liveVersion.calver}.${liveVersion.patchLevel}` : liveVersion.calver;
  assert.strictEqual(liveVersion.fullVersion, expectedFull);
  assert.strictEqual(liveVersion.gitTag, `v${expectedFull}`);
  assert.ok(Array.isArray(liveVersion.history) && liveVersion.history.length >= 2, 'version.json should include release history');
  assert.ok(liveVersion.scheme.includes('YYYY.MM.DD'));

  console.log('  [PASS] CalVer formatting, parsing, and version comparison');

  // 2. Test bumpCalVer, createPatchBundle, tamper detection, applyPatchBundle, and rollbackLastPatch in temp workspace
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'rigcheck-patch-test-'));
  try {
    fs.mkdirSync(path.join(tmpRoot, 'src'), { recursive: true });
    fs.mkdirSync(path.join(tmpRoot, 'public'), { recursive: true });

    fs.writeFileSync(
      path.join(tmpRoot, 'version.json'),
      JSON.stringify({
        calver: '2026.11.17',
        npmVersion: '2026.11.17',
        patchLevel: 0,
        fullVersion: '2026.11.17',
        scheme: 'YYYY.MM.DD[.PATCH]',
        channel: 'stable',
        releasedAt: '2026-11-17T20:22:00-03:00',
        notes: 'Base release'
      }, null, 2),
      'utf8'
    );
    fs.writeFileSync(
      path.join(tmpRoot, 'package.json'),
      JSON.stringify({ name: 'rigcheck-test', version: '2026.11.17' }, null, 2),
      'utf8'
    );
    fs.writeFileSync(path.join(tmpRoot, 'src', 'sample.js'), 'module.exports = { patched: false };\n', 'utf8');
    fs.writeFileSync(path.join(tmpRoot, 'public', 'index.html'), '<h1>v2026.11.17</h1>\n', 'utf8');

    // Test bumpCalVer on temp dir
    const bumpedPatch = bumpCalVer({ mode: 'patch', notes: 'Patch 1', appRootDir: tmpRoot });
    assert.strictEqual(bumpedPatch.fullVersion, '2026.11.17.1');
    assert.strictEqual(bumpedPatch.patchLevel, 1);

    const bumpedDate = bumpCalVer({ mode: 'set', targetCalVer: '2026.11.18', notes: 'Next day', appRootDir: tmpRoot });
    assert.strictEqual(bumpedDate.calver, '2026.11.18');
    assert.strictEqual(bumpedDate.patchLevel, 0);

    // Reset back to 2026.11.17 for patch lifecycle test
    bumpCalVer({ mode: 'set', targetCalVer: '2026.11.17', notes: 'Base release', appRootDir: tmpRoot });

    // Create a patch bundle targeting 2026.11.17.1 with modified src/sample.js
    const patchOutPath = path.join(tmpRoot, 'dist', 'patches', 'rigcheck-patch-2026.11.17.1.rigpatch.json');
    const created = createPatchBundle({
      targetDir: tmpRoot,
      outputPath: patchOutPath,
      targetVersion: '2026.11.17.1',
      notes: 'Hotfix 2026.11.17.1',
      customFiles: {
        'src/sample.js': 'module.exports = { patched: true, version: "2026.11.17.1" };\n'
      }
    });

    assert.strictEqual(created.ok, true);
    assert.strictEqual(created.targetVersion, '2026.11.17.1');
    assert.ok(fs.existsSync(patchOutPath), 'Patch bundle file should exist on disk');

    const validation = validatePatchBundle(patchOutPath);
    assert.strictEqual(validation.valid, true, 'Created patch bundle should pass SHA-256 validation');

    console.log('  [PASS] bumpCalVer & createPatchBundle with SHA-256 signature verification');

    // 3. Test Tampering Detection (SHA-256 mismatch rejection)
    const tamperedBundle = JSON.parse(fs.readFileSync(patchOutPath, 'utf8'));
    const sampleEntry = tamperedBundle.files.find((f) => f.relativePath === 'src/sample.js');
    sampleEntry.content = 'module.exports = { malicious: true };\n';

    const tamperedCheck = validatePatchBundle(tamperedBundle);
    assert.strictEqual(tamperedCheck.valid, false, 'Tampered patch must fail validation');
    assert.ok(/SHA-256 checksum mismatch/i.test(tamperedCheck.error));

    assert.throws(
      () => applyPatchBundle(tamperedBundle, { appRootDir: tmpRoot }),
      /SHA-256 checksum mismatch/i,
      'applyPatchBundle must throw on SHA-256 mismatch'
    );

    console.log('  [PASS] Tampering detection (SHA-256 mismatch rejected before touching disk)');

    // 4. Test Applying Valid Patch Bundle
    const applyRes = applyPatchBundle(patchOutPath, { appRootDir: tmpRoot });
    assert.strictEqual(applyRes.ok, true);
    assert.strictEqual(applyRes.previousVersion, '2026.11.17');
    assert.strictEqual(applyRes.newVersion, '2026.11.17.1');
    assert.ok(fs.existsSync(applyRes.backupFile), 'Backup snapshot file must be created');

    const updatedSample = fs.readFileSync(path.join(tmpRoot, 'src', 'sample.js'), 'utf8');
    assert.ok(updatedSample.includes('patched: true'), 'Patched file content should be written to disk');
    assert.strictEqual(getVersionInfo(tmpRoot).fullVersion, '2026.11.17.1');

    // 5. Test Rolling Back Patch Snapshot
    const rollbackRes = rollbackLastPatch({ appRootDir: tmpRoot });
    assert.strictEqual(rollbackRes.ok, true);
    assert.strictEqual(rollbackRes.restoredVersion, '2026.11.17');

    const restoredSample = fs.readFileSync(path.join(tmpRoot, 'src', 'sample.js'), 'utf8');
    assert.strictEqual(restoredSample, 'module.exports = { patched: false };\n');
    assert.strictEqual(getVersionInfo(tmpRoot).fullVersion, '2026.11.17');

    const history = getPatchHistory(path.join(tmpRoot, 'dist', 'backups'));
    assert.strictEqual(history.length, 2, 'History should contain apply and rollback entries');
    assert.strictEqual(history[0].action, 'rollback');
    assert.strictEqual(history[1].action, 'apply');

    console.log('  [PASS] applyPatchBundle & rollbackLastPatch end-to-end with backup history');
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }

  // 6. Verify real `dist/` patch and installer artifacts
  const distPatches = listAvailablePatches(path.join(ROOT_DIR, 'dist', 'patches'));
  assert.ok(distPatches.length >= 1, 'At least one .rigpatch.json bundle should exist in dist/patches/');
  assert.strictEqual(distPatches[0].valid, true, 'Sample patch in dist/patches/ must be valid');

  const liveVer = getVersionInfo(ROOT_DIR);
  const installerArtifacts = getInstallerArtifacts(path.join(ROOT_DIR, 'dist'));
  assert.ok(installerArtifacts.some((a) => a.fileName === `gamecheck-installer-${liveVer.calver}.sh`), 'Linux installer .sh should exist in dist/');
  assert.ok(installerArtifacts.some((a) => a.fileName === `rigcheck-installer-${liveVer.calver}.sh`), 'Legacy Linux installer .sh should exist in dist/');
  assert.ok(installerArtifacts.some((a) => a.fileName === `GameCheck-App-Payload-${liveVer.calver}.zip`), 'GameCheck payload .zip should exist in dist/');
  assert.ok(fs.existsSync(path.join(ROOT_DIR, 'dist', 'SHA256SUMS.txt')), 'SHA256SUMS.txt should exist in dist/');
  assert.ok(fs.existsSync(path.join(ROOT_DIR, 'dist', 'release-manifest.json')), 'release-manifest.json should exist in dist/');

  // Verify Linux installer script content for permissions, dependency installation, and uninstaller
  const linuxShContent = fs.readFileSync(path.join(ROOT_DIR, 'dist', `gamecheck-installer-${liveVer.calver}.sh`), 'utf8');
  assert.ok(linuxShContent.includes('--check-deps'), 'Linux installer must support --check-deps');
  assert.ok(linuxShContent.includes('Grant permission to install missing system dependencies via sudo'), 'Linux installer must ask for sudo permission');
  assert.ok(linuxShContent.includes('rigcheck_probe.cpp'), 'Linux installer must compile native C++17 probe');
  assert.ok(linuxShContent.includes('.local/share/gamecheck'), 'Linux installer must target ~/.local/share/gamecheck');
  assert.ok(linuxShContent.includes('gamecheck-uninstall'), 'Linux installer must create gamecheck-uninstall command');
  assert.ok(linuxShContent.includes('gamecheck.desktop'), 'Linux installer must create gamecheck.desktop');
  assert.ok(linuxShContent.includes('gamecheck-uninstall.desktop'), 'Linux installer must create gamecheck-uninstall.desktop');

  if (process.platform === 'win32') {
    const exePath = path.join(ROOT_DIR, 'dist', `GameCheck-Setup-${liveVer.calver}.exe`);
    assert.ok(fs.existsSync(exePath), 'Windows native C++ .exe installer must exist in dist/');

    const verifyOut = execFileSync(exePath, ['--verify'], { encoding: 'utf8', timeout: 8000 });
    const verifyJson = JSON.parse(verifyOut.trim());
    assert.strictEqual(verifyJson.status, 'INSTALLER_OK');
    assert.strictEqual(verifyJson.appName, 'GameCheck');
    assert.strictEqual(verifyJson.calver, liveVer.calver);
    assert.strictEqual(verifyJson.installerType, 'win32-native-cpp-exe');
    assert.ok(Array.isArray(verifyJson.dependenciesManaged) && verifyJson.dependenciesManaged.includes('Electron'));
    assert.ok(verifyJson.embeddedPayloadBytes > 10000);

    const depsOut = execFileSync(exePath, ['--check-deps'], { encoding: 'utf8', timeout: 10000 });
    const depsJson = JSON.parse(depsOut.trim());
    assert.strictEqual(depsJson.status, 'DEPS_CHECK');
    assert.strictEqual(depsJson.platform, 'win32');
    assert.strictEqual(depsJson.dependencies.gameCheckExe.installed, true);
    assert.strictEqual(depsJson.dependencies.node.installed, true);
    assert.strictEqual(depsJson.dependencies.electron.installed, true);
    assert.strictEqual(depsJson.dependencies.nativeProbe.installed, true);

    // Also test real silent extraction + self-contained Uninstall-GameCheck.exe in a temporary folder
    const tmpInstallDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gamecheck-exe-install-'));
    try {
      const installOut = execFileSync(
        exePath,
        [`--install-dir=${tmpInstallDir}`, '--silent', '--no-shortcuts'],
        { encoding: 'utf8', timeout: 15000 }
      );
      const installJson = JSON.parse(installOut.trim().split(/\r?\n/).pop());
      assert.strictEqual(installJson.status, 'INSTALLED');
      assert.strictEqual(installJson.installerType, 'win32-native-cpp-exe');
      assert.strictEqual(installJson.dependencies.node, true);
      assert.strictEqual(installJson.dependencies.electron, true);
      assert.strictEqual(installJson.dependencies.nativeProbe, true);
      assert.ok(fs.existsSync(path.join(tmpInstallDir, 'version.json')));
      assert.ok(fs.existsSync(path.join(tmpInstallDir, 'src', 'main.js')));
      assert.ok(fs.existsSync(path.join(tmpInstallDir, 'public', 'index.html')));
      assert.ok(fs.existsSync(path.join(tmpInstallDir, 'bin', 'rigcheck-native-probe.exe')));
      assert.ok(fs.existsSync(path.join(tmpInstallDir, 'bin', 'GameCheck.exe')));

      const uninstallerExe = path.join(tmpInstallDir, 'Uninstall-GameCheck.exe');
      assert.ok(fs.existsSync(uninstallerExe), 'Uninstall-GameCheck.exe must be created in installDir');

      // Test silent self-uninstall via Uninstall-GameCheck.exe (auto-detects uninstall mode from filename)
      const uninstallOut = execFileSync(
        uninstallerExe,
        ['--silent', '--no-shortcuts'],
        { encoding: 'utf8', timeout: 10000 }
      );
      const uninstallJson = JSON.parse(uninstallOut.trim().split(/\r?\n/).pop());
      assert.strictEqual(uninstallJson.status, 'UNINSTALLED');

      // Wait briefly for detached cmd.exe self-delete to remove tmpInstallDir
      const deadline = Date.now() + 6000;
      while (fs.existsSync(tmpInstallDir) && Date.now() < deadline) {
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 150);
      }
      assert.strictEqual(fs.existsSync(tmpInstallDir), false, 'Uninstall-GameCheck.exe must remove the entire install folder');
    } finally {
      if (fs.existsSync(tmpInstallDir)) {
        fs.rmSync(tmpInstallDir, { recursive: true, force: true });
      }
    }

    // Also test --uninstall --silent --install-dir=... from Setup.exe directly
    const tmpInstallDir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'gamecheck-exe-uninstall-'));
    try {
      execFileSync(exePath, [`--install-dir=${tmpInstallDir2}`, '--silent', '--no-shortcuts'], { encoding: 'utf8', timeout: 15000 });
      assert.ok(fs.existsSync(path.join(tmpInstallDir2, 'Uninstall-GameCheck.exe')));
      const uninstallOut2 = execFileSync(
        exePath,
        ['--uninstall', '--silent', '--no-shortcuts', `--install-dir=${tmpInstallDir2}`],
        { encoding: 'utf8', timeout: 10000 }
      );
      const uninstallJson2 = JSON.parse(uninstallOut2.trim().split(/\r?\n/).pop());
      assert.strictEqual(uninstallJson2.status, 'UNINSTALLED');
      assert.strictEqual(fs.existsSync(tmpInstallDir2), false, '--uninstall --silent must remove the install folder');
    } finally {
      if (fs.existsSync(tmpInstallDir2)) {
        fs.rmSync(tmpInstallDir2, { recursive: true, force: true });
      }
    }

    console.log(`  [PASS] Windows Native C++ Installer & Uninstaller (GameCheck-Setup-${liveVer.calver}.exe --verify, --check-deps, silent install & Uninstall-GameCheck.exe)`);
  }

  console.log('--- All CalVer, Patch & Installer Tests Passed! ---\n');
}

if (require.main === module) {
  runVersionPatchTests();
}

module.exports = { runVersionPatchTests };
