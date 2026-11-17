const { detectSystemSpecs } = require('./hardware');
const { getAllGames } = require('./games-db');
const { analyzeGameCompatibility } = require('./analyzer');
const { scanInstalledGames } = require('./installed-scanner');
const { getPerSettingImpact } = require('./config-exporter');

function formatTierBadge(overallTier) {
  return overallTier === 'EXCEEDS_RECOMMENDED'
    ? '[ULTRA / HIGH READY]'
    : overallTier === 'MEETS_RECOMMENDED'
      ? '[RECOMMENDED READY]'
      : overallTier === 'MEETS_MINIMUM'
        ? '[MINIMUM READY]'
        : '[BELOW MINIMUM]';
}

function runCli() {
  const specs = detectSystemSpecs();
  const games = getAllGames();
  const installedGames = scanInstalledGames();

  console.log('==============================================================');
  console.log('   PC HARDWARE & GAME CONFIGURATION CHECKER (CLI)');
  console.log('==============================================================');
  console.log(`OS        : ${specs.os}`);
  console.log(`CPU       : ${specs.cpu.name} (${specs.cpu.cores}C/${specs.cpu.threads}T @ ${specs.cpu.speedGHz} GHz) [Score: ${specs.cpu.score}/100]`);
  console.log(`GPU       : ${specs.gpu.name} (${specs.gpu.vramGB} GB VRAM, Driver ${specs.gpu.driverVersion}) [Score: ${specs.gpu.score}/100]`);
  console.log(`RAM       : ${specs.ram.totalGB} GB Total (${specs.ram.freeGB} GB Free)`);
  console.log(`Disk      : ${specs.storage.freeGB} GB Free on ${specs.storage.drive} (${specs.storage.totalGB} GB Total)`);
  console.log(`Installed : ${installedGames.length} PC game(s) detected on local drives`);
  console.log('==============================================================\n');

  const rawArgs = process.argv.slice(2);
  const installedFlag = rawArgs.includes('--installed') || rawArgs.includes('-i');
  const query = rawArgs
    .filter((a) => a !== '--installed' && a !== '-i')
    .join(' ')
    .toLowerCase();

  if (installedFlag || (!query && installedGames.length > 0)) {
    console.log(`--- LOCALLY INSTALLED PC GAMES (${installedGames.length}) ---`);
    for (const inst of installedGames) {
      const res = analyzeGameCompatibility(specs, inst);
      console.log(`${formatTierBadge(res.overallTier)} ${inst.title} [${inst.launcher} • ${inst.drive} • ${inst.sizeOnDiskGB} GB]`);
      console.log(`  • Optimal Target : ${res.optimalConfig.targetResolution} @ ${res.optimalConfig.preset} Preset`);
      console.log(`  • Est. FPS       : 1080p: ${res.optimalConfig.estimatedFps['1080p'].range} | 1440p: ${res.optimalConfig.estimatedFps['1440p'].range}\n`);
    }
    if (installedFlag) return;
    console.log(`--- CATALOG GAMES (${games.length}) ---`);
  }

  let targetGames = query
    ? games.filter((g) => g.title.toLowerCase().includes(query) || g.id.includes(query))
    : games;

  if (query && targetGames.length === 0) {
    targetGames = installedGames.filter(
      (g) => g.title.toLowerCase().includes(query) || g.id.includes(query)
    );
  }

  for (const game of targetGames) {
    const res = analyzeGameCompatibility(specs, game);
    const badge = formatTierBadge(res.overallTier);

    console.log(`${badge} ${game.title} (${game.genre})`);
    console.log(`  • Optimal Target : ${res.optimalConfig.targetResolution} @ ${res.optimalConfig.preset} Preset`);
    console.log(`  • Upscaling      : ${res.optimalConfig.upscalingMode} | Frame Gen: ${res.optimalConfig.frameGen}`);
    console.log(`  • Est. FPS       : 1080p: ${res.optimalConfig.estimatedFps['1080p'].range} | 1440p: ${res.optimalConfig.estimatedFps['1440p'].range}`);
    console.log(`  • Bottleneck     : ${res.bottleneck.note}`);

    if (query) {
      const impacts = getPerSettingImpact(specs, game, res);
      console.log(`  • Per-Setting FPS Gain & VRAM Impact:`);
      for (const item of impacts) {
        console.log(
          `      - ${item.setting.padEnd(24)}: ${item.recommendedValue.padEnd(24)} (+${item.fpsGainPercent}% FPS | ~${item.vramImpactMB} MB VRAM | Visual Cost: ${item.visualCost})`
        );
      }
    }
    console.log('');
  }
}

runCli();
