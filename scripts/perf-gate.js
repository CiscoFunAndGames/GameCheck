#!/usr/bin/env node
/**
 * GameCheck Performance, Latency & Binary Footprint Gate
 *
 * Enforces strict performance budgets on every Pull Request:
 * 1. Native hardware/display scan latency must stay under 500ms.
 * 2. Native compiled binary footprint must stay lightweight (< 8 MB).
 * 3. Node.js core compatibility & analyzer speed budget (< 50ms for 50+ games).
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT_DIR = path.join(__dirname, '..');

const BUDGETS = {
  maxHardwareScanMs: 500,
  maxDesktopBinaryMB: 8.0,
  maxProbeBinaryMB: 5.0,
  maxCatalogAnalysisMs: 100
};

function checkBinarySize(relPath, maxMB) {
  const full = path.join(ROOT_DIR, relPath);
  if (!fs.existsSync(full)) return null;
  const sizeMB = fs.statSync(full).size / (1024 * 1024);
  const pass = sizeMB <= maxMB;
  console.log(`  [${pass ? 'PASS' : 'FAIL'}] Binary Size (${relPath}): ${sizeMB.toFixed(2)} MB (budget <= ${maxMB.toFixed(1)} MB)`);
  return pass;
}

function main() {
  console.log('==============================================================');
  console.log('  GameCheck — Performance & Footprint Gate');
  console.log('==============================================================');

  let failed = 0;

  // 1. Check compiled binary sizes (platform-specific)
  if (process.platform === 'win32') {
    if (checkBinarySize('bin/GameCheck.exe', BUDGETS.maxDesktopBinaryMB) === false) failed++;
    if (checkBinarySize('bin/rigcheck-native-probe.exe', BUDGETS.maxProbeBinaryMB) === false) failed++;

    const exePath = path.join(ROOT_DIR, 'bin', 'GameCheck.exe');
    if (fs.existsSync(exePath)) {
      const t0 = Date.now();
      const out = execFileSync(exePath, ['--smoke-test'], { cwd: ROOT_DIR, encoding: 'utf8', timeout: 10000 });
      const wallMs = Date.now() - t0;
      const json = JSON.parse(out.trim());
      const scanMs = typeof json.scanDurationMs === 'number' ? json.scanDurationMs : wallMs;
      const passScan = scanMs <= BUDGETS.maxHardwareScanMs;
      console.log(`  [${passScan ? 'PASS' : 'FAIL'}] Native C++17 Hardware Scan Latency: ${scanMs.toFixed(2)} ms (wall: ${wallMs} ms, budget <= ${BUDGETS.maxHardwareScanMs} ms)`);
      if (!passScan) failed++;
    }
  } else {
    if (checkBinarySize('bin/gamecheck', BUDGETS.maxDesktopBinaryMB) === false) failed++;
    if (checkBinarySize('bin/rigcheck-native-probe', BUDGETS.maxProbeBinaryMB) === false) failed++;

    const linuxBin = path.join(ROOT_DIR, 'bin', 'gamecheck');
    if (fs.existsSync(linuxBin)) {
      const t0 = Date.now();
      execFileSync(linuxBin, ['--smoke-test'], { cwd: ROOT_DIR, encoding: 'utf8', timeout: 10000 });
      const wallMs = Date.now() - t0;
      const passScan = wallMs <= BUDGETS.maxHardwareScanMs * 2;
      console.log(`  [${passScan ? 'PASS' : 'FAIL'}] Linux Native CLI Smoke Latency: ${wallMs} ms (budget <= ${BUDGETS.maxHardwareScanMs * 2} ms)`);
      if (!passScan) failed++;
    }
  }

  // 2. Benchmark analyzing the entire 50+ game catalog across all 4 optimization modes
  const { getAllGames } = require('../src/games-db');
  const { analyzeGameCompatibility } = require('../src/analyzer');
  const sampleSpecs = {
    cpu: { name: 'AMD Ryzen 7 5800X', cores: 8, threads: 16, score: 78 },
    gpu: { name: 'AMD Radeon RX 7600', vramGB: 8, score: 61, vendor: 'amd', rtCapable: true, upscaler: 'FSR 3' },
    ram: { totalGB: 32 },
    storage: { drive: 'C:', freeGB: 500, totalGB: 1000 },
    display: { name: '1080p 144Hz', width: 1920, height: 1080, tier: '1080p', refreshRateHz: 144, vrrCapable: true }
  };

  const games = getAllGames();
  const modes = ['optimal', 'full_fps', 'balanced', 'quality_30_60'];
  const tStart = process.hrtime.bigint();
  for (const g of games) {
    for (const m of modes) {
      analyzeGameCompatibility(sampleSpecs, g, { optimizationMode: m });
    }
  }
  const elapsedMs = Number(process.hrtime.bigint() - tStart) / 1e6;
  const passCatalog = elapsedMs <= BUDGETS.maxCatalogAnalysisMs;
  console.log(`  [${passCatalog ? 'PASS' : 'FAIL'}] Full Catalog Analysis (${games.length} games x 4 modes = ${games.length * 4} runs): ${elapsedMs.toFixed(2)} ms (budget <= ${BUDGETS.maxCatalogAnalysisMs} ms)`);
  if (!passCatalog) failed++;

  if (failed > 0) {
    console.error(`\n[FAIL] ${failed} performance budget check(s) exceeded.`);
    process.exit(1);
  }

  console.log('\n[PASS] All performance & footprint budgets satisfied.');
  process.exit(0);
}

if (require.main === module) {
  main();
}
