#!/usr/bin/env node
const path = require('path');
const { getVersionInfo } = require('../src/version');
const {
  createPatchBundle,
  applyPatchBundle,
  rollbackLastPatch,
  listAvailablePatches
} = require('../src/patcher');

function runPatchCli() {
  const args = process.argv.slice(2);

  if (args.includes('--rollback')) {
    const res = rollbackLastPatch();
    console.log(`[Patch] Rolled back from ${res.previousVersion} -> ${res.restoredVersion} (${res.restoredFilesCount} files restored).`);
    return res;
  }

  const applyIdx = args.indexOf('--apply');
  if (applyIdx !== -1) {
    let targetPatch = args[applyIdx + 1];
    if (!targetPatch || targetPatch.startsWith('--')) {
      const available = listAvailablePatches();
      if (available.length === 0) {
        console.error('[Patch] No .rigpatch.json files found in dist/patches/');
        process.exit(1);
      }
      targetPatch = available[0].filePath;
    } else if (!path.isAbsolute(targetPatch)) {
      targetPatch = path.resolve(process.cwd(), targetPatch);
    }
    const res = applyPatchBundle(targetPatch);
    console.log(`[Patch] Applied ${path.basename(targetPatch)}: ${res.previousVersion} -> ${res.newVersion} (${res.filesUpdatedCount} files updated).`);
    console.log(`[Patch] Backup saved to: ${res.backupFile}`);
    return res;
  }

  // Default: build a sample/live CalVer patch bundle in dist/patches/
  const vInfo = getVersionInfo();
  const nextPatchLevel = (vInfo.patchLevel || 0) + 1;
  const targetVersion = `${vInfo.calver}.${nextPatchLevel}`;
  const customNotes = args.filter((a) => !a.startsWith('--')).join(' ')
    || `CalVer ${targetVersion} Hotfix Patch (SHA-256 verified delta bundle)`;

  const res = createPatchBundle({
    targetVersion,
    notes: customNotes
  });

  console.log('==============================================================');
  console.log('   RIGCHECK OPTIMIZER — PATCH BUNDLE CREATED');
  console.log('==============================================================');
  console.log(`Base Version  : ${res.baseVersion}`);
  console.log(`Target CalVer : ${res.targetVersion}`);
  console.log(`Files Packed  : ${res.fileCount}`);
  console.log(`Bundle SHA256 : ${res.bundleSha256}`);
  console.log(`Patch Path    : dist/patches/${path.basename(res.patchPath)}`);
  console.log('==============================================================');
  return res;
}

if (require.main === module) {
  runPatchCli();
}

module.exports = { runPatchCli };
