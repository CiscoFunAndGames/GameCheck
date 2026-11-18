const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getVersionInfo, parseCalVer, compareCalVer } = require('./version');

const DEFAULT_ROOT = path.join(__dirname, '..');

function sha256Hex(bufferOrString) {
  return crypto.createHash('sha256').update(bufferOrString).digest('hex');
}

function computeBundleSignature(targetVersion, fileEntries) {
  const canonical = [
    `version:${targetVersion}`,
    ...fileEntries
      .slice()
      .sort((a, b) => a.relativePath.localeCompare(b.relativePath))
      .map((f) => `${f.relativePath}:${f.sha256}:${f.sizeBytes}`)
  ].join('\n');
  return sha256Hex(canonical);
}

function isSafeRelativePath(relPath) {
  if (!relPath || typeof relPath !== 'string') return false;
  const normalized = relPath.replace(/\\/g, '/');
  if (normalized.startsWith('/') || /^[a-zA-Z]:/.test(normalized)) return false;
  const parts = normalized.split('/');
  if (parts.some((p) => p === '..' || p === '')) return false;
  return true;
}

/**
 * Collects default patchable application files (`version.json`, `src/*.js`, `public/*`).
 */
function collectDefaultPatchFiles(appRootDir = DEFAULT_ROOT) {
  const relPaths = [];
  if (fs.existsSync(path.join(appRootDir, 'version.json'))) {
    relPaths.push('version.json');
  }

  for (const dirName of ['src', 'public', 'native']) {
    const absDir = path.join(appRootDir, dirName);
    if (!fs.existsSync(absDir)) continue;
    const entries = fs.readdirSync(absDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && /\.(js|html|css|json|svg|cpp)$/i.test(entry.name)) {
        relPaths.push(`${dirName}/${entry.name}`);
      }
    }
  }
  return relPaths;
}

/**
 * Creates a SHA-256 verified `.rigpatch.json` bundle in `dist/patches/` (or `outputPath`).
 */
function createPatchBundle(options = {}) {
  const appRootDir = options.targetDir || options.appRootDir || DEFAULT_ROOT;
  const currentInfo = getVersionInfo(appRootDir);

  let targetVersion = options.targetVersion;
  if (!targetVersion) {
    const nextPatchLevel = (currentInfo.patchLevel || 0) + 1;
    targetVersion = `${currentInfo.calver}.${nextPatchLevel}`;
  }

  const parsedTarget = parseCalVer(targetVersion);
  if (!parsedTarget.valid) {
    throw new Error(`Invalid target CalVer version for patch: "${targetVersion}"`);
  }

  const notes = options.notes || `CalVer ${parsedTarget.fullVersion} live patch bundle`;
  const relFileList = Array.isArray(options.files) && options.files.length > 0
    ? options.files.map((f) => f.replace(/\\/g, '/'))
    : collectDefaultPatchFiles(appRootDir);

  if (!relFileList.includes('version.json')) {
    relFileList.unshift('version.json');
  }

  const customFileMap = options.customFiles || {};
  const fileEntries = [];

  for (const relPath of relFileList) {
    if (!isSafeRelativePath(relPath)) {
      throw new Error(`Unsafe relative path in patch bundle: "${relPath}"`);
    }

    let contentStr;
    if (Object.prototype.hasOwnProperty.call(customFileMap, relPath)) {
      contentStr = String(customFileMap[relPath]);
    } else if (relPath === 'version.json') {
      const targetVersionObj = {
        calver: parsedTarget.calver,
        npmVersion: parsedTarget.calver,
        patchLevel: parsedTarget.patchLevel,
        fullVersion: parsedTarget.fullVersion,
        scheme: 'YYYY.MM.DD[.PATCH]',
        channel: currentInfo.channel || 'stable',
        releasedAt: new Date().toISOString(),
        notes
      };
      contentStr = JSON.stringify(targetVersionObj, null, 2) + '\n';
    } else {
      const absPath = path.join(appRootDir, relPath);
      if (!fs.existsSync(absPath)) continue;
      contentStr = fs.readFileSync(absPath, 'utf8');
    }

    const buf = Buffer.from(contentStr, 'utf8');
    fileEntries.push({
      relativePath: relPath,
      encoding: 'utf8',
      sizeBytes: buf.length,
      sha256: sha256Hex(buf),
      content: contentStr
    });
  }

  const bundleSha256 = computeBundleSignature(parsedTarget.fullVersion, fileEntries);
  const bundle = {
    format: 'rigcheck-patch-v1',
    appName: 'RigCheck Optimizer',
    scheme: 'CalVer (YYYY.MM.DD[.PATCH])',
    baseVersion: currentInfo.fullVersion,
    targetVersion: parsedTarget.fullVersion,
    calver: parsedTarget.calver,
    patchLevel: parsedTarget.patchLevel,
    createdAt: new Date().toISOString(),
    notes,
    fileCount: fileEntries.length,
    bundleSha256,
    files: fileEntries
  };

  const patchesDir = path.join(appRootDir, 'dist', 'patches');
  const outputPath = options.outputPath
    || path.join(patchesDir, `rigcheck-patch-${parsedTarget.fullVersion}.rigpatch.json`);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(bundle, null, 2) + '\n', 'utf8');

  return {
    ok: true,
    patchPath: outputPath,
    baseVersion: bundle.baseVersion,
    targetVersion: bundle.targetVersion,
    fileCount: bundle.fileCount,
    bundleSha256: bundle.bundleSha256,
    notes: bundle.notes,
    bundle
  };
}

/**
 * Validates a `.rigpatch.json` object or file path: checks schema, CalVer validity,
 * path safety, per-file SHA-256 hashes, and the overall `bundleSha256` signature.
 */
function validatePatchBundle(patchDataOrPath, options = {}) {
  let patchData = patchDataOrPath;
  try {
    if (typeof patchDataOrPath === 'string') {
      if (!fs.existsSync(patchDataOrPath)) {
        return { valid: false, error: `Patch file not found: ${patchDataOrPath}` };
      }
      patchData = JSON.parse(fs.readFileSync(patchDataOrPath, 'utf8'));
    }
  } catch (err) {
    return { valid: false, error: `Failed to parse patch JSON: ${err.message}` };
  }

  if (!patchData || typeof patchData !== 'object') {
    return { valid: false, error: 'Patch data must be a JSON object.' };
  }
  if (patchData.format !== 'rigcheck-patch-v1') {
    return { valid: false, error: `Unsupported patch format: "${patchData.format}".` };
  }

  const parsedTarget = parseCalVer(patchData.targetVersion);
  if (!parsedTarget.valid) {
    return { valid: false, error: `Invalid CalVer targetVersion: "${patchData.targetVersion}".` };
  }

  if (options.currentVersion && !options.allowDowngrade) {
    if (compareCalVer(patchData.targetVersion, options.currentVersion) < 0) {
      return {
        valid: false,
        error: `Target version ${patchData.targetVersion} is older than current version ${options.currentVersion}.`
      };
    }
  }

  if (!Array.isArray(patchData.files) || patchData.files.length === 0) {
    return { valid: false, error: 'Patch bundle contains no files.' };
  }

  for (const entry of patchData.files) {
    if (!entry || !isSafeRelativePath(entry.relativePath)) {
      return { valid: false, error: `Invalid or unsafe file path in patch: "${entry?.relativePath}".` };
    }
    if (typeof entry.content !== 'string' || typeof entry.sha256 !== 'string') {
      return { valid: false, error: `Missing content or sha256 for "${entry.relativePath}".` };
    }
    const buf = Buffer.from(entry.content, entry.encoding || 'utf8');
    const actualHash = sha256Hex(buf);
    if (actualHash !== entry.sha256.toLowerCase()) {
      return {
        valid: false,
        error: `SHA-256 checksum mismatch for "${entry.relativePath}" (expected ${entry.sha256}, got ${actualHash}).`
      };
    }
  }

  const expectedBundleHash = computeBundleSignature(patchData.targetVersion, patchData.files);
  if (!patchData.bundleSha256 || expectedBundleHash !== patchData.bundleSha256.toLowerCase()) {
    return {
      valid: false,
      error: `Bundle signature SHA-256 mismatch (expected ${patchData.bundleSha256}, computed ${expectedBundleHash}).`
    };
  }

  return {
    valid: true,
    error: null,
    targetVersion: parsedTarget.fullVersion,
    baseVersion: patchData.baseVersion || null,
    fileCount: patchData.files.length,
    bundleSha256: expectedBundleHash,
    notes: patchData.notes || ''
  };
}

function recordPatchHistoryEntry(backupDir, entry) {
  fs.mkdirSync(backupDir, { recursive: true });
  const historyPath = path.join(backupDir, 'patch-history.json');
  let history = [];
  if (fs.existsSync(historyPath)) {
    try {
      history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
      if (!Array.isArray(history)) history = [];
    } catch (e) {
      history = [];
    }
  }
  history.unshift(entry);
  fs.writeFileSync(historyPath, JSON.stringify(history, null, 2) + '\n', 'utf8');
  return history;
}

/**
 * Applies a `.rigpatch.json` bundle to `appRootDir`:
 * 1. Validates schema & SHA-256 hashes
 * 2. Saves a full rollback backup of affected files in `backupDir`
 * 3. Atomically writes updated files and `version.json`
 */
function applyPatchBundle(patchFilePathOrObject, options = {}) {
  const appRootDir = options.appRootDir || DEFAULT_ROOT;
  const backupDir = options.backupDir || path.join(appRootDir, 'dist', 'backups');

  let patchData = patchFilePathOrObject;
  if (typeof patchFilePathOrObject === 'string') {
    if (!fs.existsSync(patchFilePathOrObject)) {
      throw new Error(`Patch file not found: ${patchFilePathOrObject}`);
    }
    patchData = JSON.parse(fs.readFileSync(patchFilePathOrObject, 'utf8'));
  }

  const validation = validatePatchBundle(patchData, { allowDowngrade: Boolean(options.allowDowngrade) });
  if (!validation.valid) {
    throw new Error(`Patch verification failed: ${validation.error}`);
  }

  const beforeVersion = getVersionInfo(appRootDir);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFileName = `backup-${beforeVersion.fullVersion}-${timestamp}.json`;
  const backupFilePath = path.join(backupDir, backupFileName);

  // Build backup snapshot of all files touched by this patch + version.json
  const touchedPaths = new Set(patchData.files.map((f) => f.relativePath));
  touchedPaths.add('version.json');

  const backupFiles = [];
  for (const relPath of touchedPaths) {
    const absPath = path.join(appRootDir, relPath);
    if (fs.existsSync(absPath)) {
      const content = fs.readFileSync(absPath, 'utf8');
      backupFiles.push({
        relativePath: relPath,
        existed: true,
        sha256: sha256Hex(Buffer.from(content, 'utf8')),
        content
      });
    } else {
      backupFiles.push({
        relativePath: relPath,
        existed: false,
        sha256: null,
        content: null
      });
    }
  }

  fs.mkdirSync(backupDir, { recursive: true });
  const backupPayload = {
    format: 'rigcheck-backup-v1',
    createdAt: new Date().toISOString(),
    previousVersion: beforeVersion.fullVersion,
    previousVersionInfo: beforeVersion,
    targetVersion: validation.targetVersion,
    bundleSha256: validation.bundleSha256,
    rolledBack: false,
    files: backupFiles
  };
  fs.writeFileSync(backupFilePath, JSON.stringify(backupPayload, null, 2) + '\n', 'utf8');

  // Write patched files atomically via temp file rename
  const filesUpdated = [];
  for (const entry of patchData.files) {
    const destPath = path.join(appRootDir, entry.relativePath);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    const tmpPath = `${destPath}.rigpatch-tmp-${process.pid}`;
    fs.writeFileSync(tmpPath, entry.content, entry.encoding || 'utf8');
    fs.renameSync(tmpPath, destPath);
    filesUpdated.push(entry.relativePath);
  }

  // Ensure version.json reflects targetVersion even if patch didn't explicitly include version.json
  const parsedTarget = parseCalVer(validation.targetVersion);
  const versionPath = path.join(appRootDir, 'version.json');
  const updatedVersionObj = {
    calver: parsedTarget.calver,
    npmVersion: parsedTarget.calver,
    patchLevel: parsedTarget.patchLevel,
    fullVersion: parsedTarget.fullVersion,
    scheme: 'YYYY.MM.DD[.PATCH]',
    channel: beforeVersion.channel || 'stable',
    releasedAt: new Date().toISOString(),
    notes: patchData.notes || `Applied patch ${parsedTarget.fullVersion}`
  };
  fs.writeFileSync(versionPath, JSON.stringify(updatedVersionObj, null, 2) + '\n', 'utf8');

  const appliedAt = new Date().toISOString();
  recordPatchHistoryEntry(backupDir, {
    action: 'apply',
    previousVersion: beforeVersion.fullVersion,
    newVersion: parsedTarget.fullVersion,
    filesUpdatedCount: filesUpdated.length,
    bundleSha256: validation.bundleSha256,
    notes: patchData.notes || '',
    backupFile: backupFilePath,
    appliedAt
  });

  return {
    ok: true,
    previousVersion: beforeVersion.fullVersion,
    newVersion: parsedTarget.fullVersion,
    filesUpdated,
    filesUpdatedCount: filesUpdated.length,
    backupFile: backupFilePath,
    bundleSha256: validation.bundleSha256,
    appliedAt
  };
}

/**
 * Rolls back the most recent active backup snapshot in `backupDir`.
 */
function rollbackLastPatch(options = {}) {
  const appRootDir = options.appRootDir || DEFAULT_ROOT;
  const backupDir = options.backupDir || path.join(appRootDir, 'dist', 'backups');

  if (!fs.existsSync(backupDir)) {
    throw new Error('No patch backups directory found to roll back.');
  }

  const backupCandidates = fs.readdirSync(backupDir)
    .filter((f) => /^backup-.*\.json$/i.test(f))
    .map((f) => {
      const fullPath = path.join(backupDir, f);
      const stat = fs.statSync(fullPath);
      let data = null;
      try {
        data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
      } catch (e) {
        data = null;
      }
      return { name: f, fullPath, mtimeMs: stat.mtimeMs, data };
    })
    .filter((b) => b.data && b.data.format === 'rigcheck-backup-v1' && !b.data.rolledBack)
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  if (backupCandidates.length === 0) {
    throw new Error('No active patch backup snapshot available for rollback.');
  }

  const chosen = backupCandidates[0];
  const snapshot = chosen.data;
  const currentVersion = getVersionInfo(appRootDir).fullVersion;

  const restoredFiles = [];
  for (const item of snapshot.files) {
    if (!isSafeRelativePath(item.relativePath)) continue;
    const absPath = path.join(appRootDir, item.relativePath);
    if (item.existed && typeof item.content === 'string') {
      fs.mkdirSync(path.dirname(absPath), { recursive: true });
      fs.writeFileSync(absPath, item.content, 'utf8');
      restoredFiles.push(item.relativePath);
    } else if (!item.existed && fs.existsSync(absPath)) {
      fs.unlinkSync(absPath);
    }
  }

  // Mark backup as rolled back so subsequent rollbacks step further back
  snapshot.rolledBack = true;
  snapshot.rolledBackAt = new Date().toISOString();
  fs.writeFileSync(chosen.fullPath, JSON.stringify(snapshot, null, 2) + '\n', 'utf8');

  const restoredVersion = getVersionInfo(appRootDir).fullVersion;
  recordPatchHistoryEntry(backupDir, {
    action: 'rollback',
    previousVersion: currentVersion,
    newVersion: restoredVersion,
    restoredVersion,
    filesUpdatedCount: restoredFiles.length,
    backupFile: chosen.fullPath,
    appliedAt: snapshot.rolledBackAt
  });

  return {
    ok: true,
    previousVersion: currentVersion,
    restoredVersion,
    restoredFiles,
    restoredFilesCount: restoredFiles.length,
    backupFile: chosen.fullPath
  };
}

/**
 * Lists all available `.rigpatch.json` bundles in `dist/patches/`
 */
function listAvailablePatches(patchesDir = path.join(DEFAULT_ROOT, 'dist', 'patches')) {
  if (!fs.existsSync(patchesDir)) return [];
  const entries = fs.readdirSync(patchesDir).filter((f) => f.endsWith('.rigpatch.json'));
  const results = [];

  for (const fileName of entries) {
    const filePath = path.join(patchesDir, fileName);
    try {
      const stat = fs.statSync(filePath);
      const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const check = validatePatchBundle(raw);
      results.push({
        fileName,
        filePath,
        baseVersion: raw.baseVersion || '2026.11.17',
        targetVersion: raw.targetVersion || 'Unknown',
        calver: raw.calver || '2026.11.17',
        patchLevel: raw.patchLevel || 0,
        createdAt: raw.createdAt || stat.mtime.toISOString(),
        notes: raw.notes || '',
        fileCount: Array.isArray(raw.files) ? raw.files.length : 0,
        bundleSha256: raw.bundleSha256 || '',
        sizeBytes: stat.size,
        sizeKB: Number((stat.size / 1024).toFixed(1)),
        valid: check.valid,
        validationError: check.error
      });
    } catch (e) {
      // skip unreadable files
    }
  }

  return results.sort((a, b) => compareCalVer(b.targetVersion, a.targetVersion));
}

/**
 * Reads applied patch & rollback history from `dist/backups/patch-history.json`
 */
function getPatchHistory(backupDir = path.join(DEFAULT_ROOT, 'dist', 'backups')) {
  const historyPath = path.join(backupDir, 'patch-history.json');
  if (!fs.existsSync(historyPath)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
    return Array.isArray(data) ? data : [];
  } catch (e) {
    return [];
  }
}

/**
 * Lists built native installer artifacts in `dist/` (Windows `.exe`, payload `.zip`, Linux `.sh`)
 */
function getInstallerArtifacts(distDir = path.join(DEFAULT_ROOT, 'dist')) {
  if (!fs.existsSync(distDir)) return [];
  const entries = fs.readdirSync(distDir, { withFileTypes: true });
  const artifacts = [];

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!/\.(exe|sh|zip|deb|AppImage)$/i.test(entry.name)) continue;
    const filePath = path.join(distDir, entry.name);
    const stat = fs.statSync(filePath);
    const platform = /\.exe$/i.test(entry.name)
      ? 'win32'
      : /\.(sh|deb|AppImage)$/i.test(entry.name)
        ? 'linux'
        : 'cross-platform';

    artifacts.push({
      fileName: entry.name,
      filePath,
      platform,
      sizeBytes: stat.size,
      sizeKB: Number((stat.size / 1024).toFixed(1)),
      sizeMB: Number((stat.size / (1024 * 1024)).toFixed(2)),
      createdAt: stat.mtime.toISOString()
    });
  }

  return artifacts.sort((a, b) => a.fileName.localeCompare(b.fileName));
}

module.exports = {
  createPatchBundle,
  validatePatchBundle,
  applyPatchBundle,
  rollbackLastPatch,
  listAvailablePatches,
  getPatchHistory,
  getInstallerArtifacts,
  sha256Hex
};
