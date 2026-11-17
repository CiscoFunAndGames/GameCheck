const { detectSystemSpecs } = require('./hardware');
const { getAllGames } = require('./games-db');
const { analyzeGameCompatibility } = require('./analyzer');

function runCli() {
  const specs = detectSystemSpecs();
  const games = getAllGames();

  console.log('==============================================================');
  console.log('   PC HARDWARE & GAME CONFIGURATION CHECKER (CLI)');
  console.log('==============================================================');
  console.log(`OS     : ${specs.os}`);
  console.log(`CPU    : ${specs.cpu.name} (${specs.cpu.cores}C/${specs.cpu.threads}T @ ${specs.cpu.speedGHz} GHz) [Score: ${specs.cpu.score}/100]`);
  console.log(`GPU    : ${specs.gpu.name} (${specs.gpu.vramGB} GB VRAM, Driver ${specs.gpu.driverVersion}) [Score: ${specs.gpu.score}/100]`);
  console.log(`RAM    : ${specs.ram.totalGB} GB Total (${specs.ram.freeGB} GB Free)`);
  console.log(`Disk   : ${specs.storage.freeGB} GB Free on ${specs.storage.drive} (${specs.storage.totalGB} GB Total)`);
  console.log('==============================================================\n');

  const query = process.argv.slice(2).join(' ').toLowerCase();
  const targetGames = query
    ? games.filter((g) => g.title.toLowerCase().includes(query) || g.id.includes(query))
    : games;

  for (const game of targetGames) {
    const res = analyzeGameCompatibility(specs, game);
    const badge = res.overallTier === 'EXCEEDS_RECOMMENDED'
      ? '[ULTRA / HIGH READY]'
      : res.overallTier === 'MEETS_RECOMMENDED'
        ? '[RECOMMENDED READY]'
        : res.overallTier === 'MEETS_MINIMUM'
          ? '[MINIMUM READY]'
          : '[BELOW MINIMUM]';

    console.log(`${badge} ${game.title} (${game.genre})`);
    console.log(`  • Optimal Target : ${res.optimalConfig.targetResolution} @ ${res.optimalConfig.preset} Preset`);
    console.log(`  • Upscaling      : ${res.optimalConfig.upscalingMode} | Frame Gen: ${res.optimalConfig.frameGen}`);
    console.log(`  • Est. FPS       : 1080p: ${res.optimalConfig.estimatedFps['1080p'].range} | 1440p: ${res.optimalConfig.estimatedFps['1440p'].range}`);
    console.log(`  • Bottleneck     : ${res.bottleneck.note}\n`);
  }
}

runCli();
