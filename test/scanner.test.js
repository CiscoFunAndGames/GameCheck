const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  scanInstalledGames,
  parseVdf,
  parseAcfFile,
  parseLibraryFoldersVdf,
  matchCatalogGame,
  buildFallbackGameSpec,
  scanSteamGames,
  scanHeroicGames,
  scanLutrisGames,
  parseLutrisYaml,
  detectSteamProtonInfo,
  getLinuxSteamLibraryFolders,
  extractDriveLetter
} = require('../src/installed-scanner');

function runScannerTests() {
  console.log('=== Running Cross-Platform Installed Game Scanner Tests ===');

  // 1. Test extractDriveLetter across Windows and Linux paths
  assert.strictEqual(extractDriveLetter('C:\\Program Files (x86)\\Steam\\steamapps\\common\\CS2'), 'C:');
  assert.strictEqual(extractDriveLetter('d:/Games/Cyberpunk 2077'), 'D:');
  assert.strictEqual(extractDriveLetter('/home/deck/.local/share/Steam/steamapps/common/Elden Ring'), '/home');
  assert.strictEqual(extractDriveLetter('/mnt/games/SteamLibrary/steamapps/common/Witcher 3'), '/mnt/games');
  assert.strictEqual(extractDriveLetter('/media/user/nvme0/SteamLibrary/steamapps/common/Baldur'), '/media/user/nvme0');
  assert.strictEqual(extractDriveLetter('/run/media/deck/SDCard/SteamLibrary/steamapps/common/Hades'), '/run/media/deck/SDCard');
  assert.strictEqual(extractDriveLetter('/opt/games/doom'), '/');
  assert.strictEqual(extractDriveLetter('/'), '/');
  console.log('  [PASS] extractDriveLetter (Windows drive letters & Linux mounts)');

  // 2. Test parseVdf / parseAcfFile / parseLibraryFoldersVdf
  const sampleAcf = `
"AppState"
{
  "appid"   "1091500"
  "Universe"    "1"
  "name"    "Cyberpunk 2077"
  "StateFlags"    "4"
  "installdir"    "Cyberpunk 2077"
  "SizeOnDisk"    "75161927680"
}
`;
  const parsedAcf = parseVdf(sampleAcf);
  assert.strictEqual(parsedAcf.appid, '1091500');
  assert.strictEqual(parsedAcf.name, 'Cyberpunk 2077');
  assert.strictEqual(parsedAcf.installdir, 'Cyberpunk 2077');
  assert.strictEqual(parsedAcf.sizeondisk, '75161927680');
  assert.strictEqual(typeof parseAcfFile, 'function');
  console.log('  [PASS] parseVdf / parseAcfFile');

  // 3. Fixture-based Linux Steam + Proton Compatibility + Heroic + Lutris in os.tmpdir()
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'rigcheck-scanner-test-'));

  try {
    const fakeHome = path.join(tmpRoot, 'home', 'gamer');
    const fakeMountRoot = path.join(tmpRoot, 'mnt');
    const externalSteamLib = path.join(fakeMountRoot, 'nvme_games', 'SteamLibrary');
    const externalSteamApps = path.join(externalSteamLib, 'steamapps');

    const localSteamApps = path.join(fakeHome, '.local', 'share', 'Steam', 'steamapps');
    const flatpakSteamApps = path.join(
      fakeHome,
      '.var',
      'app',
      'com.valvesoftware.Steam',
      '.local',
      'share',
      'Steam',
      'steamapps'
    );

    fs.mkdirSync(localSteamApps, { recursive: true });
    fs.mkdirSync(flatpakSteamApps, { recursive: true });
    fs.mkdirSync(externalSteamApps, { recursive: true });

    // Write libraryfolders.vdf in ~/.local/share/Steam/steamapps pointing to externalSteamLib
    const escapedExternal = externalSteamLib.replace(/\\/g, '\\\\');
    const escapedLocalRoot = path.dirname(localSteamApps).replace(/\\/g, '\\\\');
    const vdfContent = `
"libraryfolders"
{
  "0"
  {
    "path"    "${escapedLocalRoot}"
    "label"   ""
  }
  "1"
  {
    "path"    "${escapedExternal}"
    "label"   "NVMe_Games"
  }
}
`;
    fs.writeFileSync(path.join(localSteamApps, 'libraryfolders.vdf'), vdfContent, 'utf8');

    // Verify getLinuxSteamLibraryFolders discovers local, Flatpak, and VDF-referenced external libraries
    const discoveredLinuxDirs = getLinuxSteamLibraryFolders({
      homeDir: fakeHome,
      mountRoots: [fakeMountRoot]
    });
    assert(
      discoveredLinuxDirs.includes(path.normalize(localSteamApps)),
      'Should discover ~/.local/share/Steam/steamapps'
    );
    assert(
      discoveredLinuxDirs.includes(path.normalize(flatpakSteamApps)),
      'Should discover Flatpak Steam steamapps'
    );
    assert(
      discoveredLinuxDirs.includes(path.normalize(externalSteamApps)),
      'Should discover external library from libraryfolders.vdf and mount roots'
    );
    console.log('  [PASS] getLinuxSteamLibraryFolders (standard, Flatpak, VDF, and mount root discovery)');

    // Create Steam appmanifest_1091500.acf (Cyberpunk 2077) with Proton 9.0 compatdata
    fs.writeFileSync(path.join(localSteamApps, 'appmanifest_1091500.acf'), sampleAcf, 'utf8');
    const compatCyberpunk = path.join(localSteamApps, 'compatdata', '1091500');
    fs.mkdirSync(compatCyberpunk, { recursive: true });
    fs.writeFileSync(path.join(compatCyberpunk, 'version'), '9.0-3\n', 'utf8');

    // Create Steam appmanifest_1245620.acf (Elden Ring) in external library with Proton Experimental via config_info
    const eldenRingAcf = `
"AppState"
{
  "appid"   "1245620"
  "name"    "ELDEN RING"
  "installdir"    "ELDEN RING"
  "SizeOnDisk"    "68719476736"
}
`;
    fs.writeFileSync(path.join(externalSteamApps, 'appmanifest_1245620.acf'), eldenRingAcf, 'utf8');
    const compatElden = path.join(externalSteamApps, 'compatdata', '1245620');
    fs.mkdirSync(compatElden, { recursive: true });
    fs.writeFileSync(path.join(compatElden, 'config_info'), 'Proton Experimental\n/home/gamer/.steam\n', 'utf8');

    // Create Steam appmanifest_730.acf (Counter-Strike 2) as Native Linux (no compatdata)
    const cs2Acf = `
"AppState"
{
  "appid"   "730"
  "name"    "Counter-Strike 2"
  "installdir"    "Counter-Strike Global Offensive"
  "SizeOnDisk"    "38654705664"
}
`;
    fs.writeFileSync(path.join(flatpakSteamApps, 'appmanifest_730.acf'), cs2Acf, 'utf8');

    // Test detectSteamProtonInfo directly
    const protonCp = detectSteamProtonInfo(localSteamApps, '1091500', { platform: 'linux' });
    assert.strictEqual(protonCp.runtime, 'Proton');
    assert.strictEqual(protonCp.protonVersion, 'Proton 9.0-3');
    assert(protonCp.linuxCompatNote.includes('Proton 9.0-3'));

    const protonEr = detectSteamProtonInfo(externalSteamApps, '1245620', { platform: 'linux' });
    assert.strictEqual(protonEr.runtime, 'Proton');
    assert.strictEqual(protonEr.protonVersion, 'Proton Experimental');

    const nativeCs2 = detectSteamProtonInfo(flatpakSteamApps, '730', { platform: 'linux' });
    assert.strictEqual(nativeCs2.runtime, 'Native');
    assert.strictEqual(nativeCs2.protonVersion, null);
    console.log('  [PASS] detectSteamProtonInfo (Proton version file, config_info, and Native detection)');

    // Scan fixture Steam games
    const scannedSteam = scanSteamGames({
      steamAppsDirs: discoveredLinuxDirs,
      platform: 'linux'
    });
    assert.strictEqual(scannedSteam.length, 3);
    const cpGame = scannedSteam.find((g) => g.appId === '1091500');
    assert(cpGame, 'Should find Cyberpunk 2077 from ACF');
    assert.strictEqual(cpGame.matchedCatalogId, 'cyberpunk-2077');
    assert.strictEqual(cpGame.runtime, 'Proton');
    assert.strictEqual(cpGame.protonVersion, 'Proton 9.0-3');

    const erGame = scannedSteam.find((g) => g.appId === '1245620');
    assert(erGame, 'Should find Elden Ring from external library ACF');
    assert.strictEqual(erGame.matchedCatalogId, 'elden-ring');
    assert.strictEqual(erGame.runtime, 'Proton');
    assert.strictEqual(erGame.protonVersion, 'Proton Experimental');

    const cs2Game = scannedSteam.find((g) => g.appId === '730');
    assert(cs2Game, 'Should find Counter-Strike 2');
    assert.strictEqual(cs2Game.matchedCatalogId, 'counter-strike-2');
    assert.strictEqual(cs2Game.runtime, 'Native');
    console.log('  [PASS] Fixture Linux Steam ACF + Proton scanner');

    // 4. Test Heroic Games Launcher (Legendary object-map + GOG array format)
    const heroicLegendDir = path.join(fakeHome, '.config', 'heroic', 'legendaryConfig', 'legendary');
    const heroicGogDir = path.join(fakeHome, '.config', 'heroic', 'gog_store');
    fs.mkdirSync(heroicLegendDir, { recursive: true });
    fs.mkdirSync(heroicGogDir, { recursive: true });

    // Legendary object-map format
    const legendaryInstalled = {
      AlanWake2App: {
        app_name: 'AlanWake2App',
        title: 'Alan Wake 2',
        install_path: '/mnt/games/Heroic/AlanWake2',
        install_size: 96636764160,
        is_dlc: false,
        platform: 'Windows'
      }
    };
    fs.writeFileSync(
      path.join(heroicLegendDir, 'installed.json'),
      JSON.stringify(legendaryInstalled, null, 2),
      'utf8'
    );

    // GOG store array format
    const gogInstalled = [
      {
        appName: '1207664643',
        title: 'The Witcher 3: Wild Hunt',
        install_path: '/home/gamer/Games/Heroic/Witcher3',
        install_size: '58.0 GiB',
        platform: 'windows',
        runner: 'gog'
      }
    ];
    fs.writeFileSync(
      path.join(heroicGogDir, 'installed.json'),
      JSON.stringify(gogInstalled, null, 2),
      'utf8'
    );

    const heroicGames = scanHeroicGames({ homeDir: fakeHome });
    assert.strictEqual(heroicGames.length, 2, 'Should find 2 Heroic games (1 Epic, 1 GOG)');

    const aw2 = heroicGames.find((g) => g.matchedCatalogId === 'alan-wake-2');
    assert(aw2, 'Should match Alan Wake 2 against games-db');
    assert.strictEqual(aw2.launcher, 'Heroic (Epic)');
    assert.strictEqual(aw2.drive, '/mnt/games');
    assert.strictEqual(aw2.sizeOnDiskGB, 90);

    const witcher3 = heroicGames.find((g) => g.matchedCatalogId === 'witcher-3-next-gen');
    assert(witcher3, 'Should match The Witcher 3 against games-db');
    assert.strictEqual(witcher3.launcher, 'Heroic (GOG)');
    assert.strictEqual(witcher3.drive, '/home');
    assert.strictEqual(witcher3.sizeOnDiskGB, 58);
    console.log('  [PASS] Fixture Heroic Games Launcher (Epic object-map & GOG array formats)');

    // 5. Test Lutris YAML scanner
    const lutrisGamesDir = path.join(fakeHome, '.local', 'share', 'lutris', 'games');
    fs.mkdirSync(lutrisGamesDir, { recursive: true });

    const bg3Yaml = `
name: "Baldur's Gate 3"
slug: baldurs-gate-3
runner: wine
directory: /mnt/games/lutris/baldurs-gate-3
game:
  exe: /mnt/games/lutris/baldurs-gate-3/bin/bg3.exe
  prefix: /mnt/games/lutris/baldurs-gate-3
wine:
  version: GE-Proton9-11
`;
    fs.writeFileSync(path.join(lutrisGamesDir, 'baldurs-gate-3-1710000000.yml'), bg3Yaml, 'utf8');

    const parsedYaml = parseLutrisYaml(bg3Yaml);
    assert.strictEqual(parsedYaml.name, "Baldur's Gate 3");
    assert.strictEqual(parsedYaml.runner, 'wine');
    assert.strictEqual(parsedYaml.installDir, '/mnt/games/lutris/baldurs-gate-3');
    assert.strictEqual(parsedYaml.wineVersion, 'GE-Proton9-11');

    const lutrisScanned = scanLutrisGames({ homeDir: fakeHome });
    assert.strictEqual(lutrisScanned.length, 1, 'Should scan 1 Lutris YAML game');
    assert.strictEqual(lutrisScanned[0].launcher, 'Lutris');
    assert.strictEqual(lutrisScanned[0].matchedCatalogId, 'baldurs-gate-3');
    assert.strictEqual(lutrisScanned[0].drive, '/mnt/games');
    assert.strictEqual(lutrisScanned[0].runtime, 'Proton');
    assert.strictEqual(lutrisScanned[0].protonVersion, 'GE-Proton9-11');
    console.log('  [PASS] Fixture Lutris YAML game scanner');

    // 6. Test combined scanInstalledGames with fixture options
    const combinedGames = scanInstalledGames({
      homeDir: fakeHome,
      mountRoots: [fakeMountRoot],
      platform: 'linux',
      linuxOnly: true,
      skipStandalone: true
    });
    assert.strictEqual(combinedGames.length, 6, `Expected 6 combined fixture games, got ${combinedGames.length}`);
    console.log(`  [PASS] Combined fixture scanInstalledGames (${combinedGames.length} games across Steam, Heroic, Lutris)`);
  } finally {
    try {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    } catch (e) {
      // ignore cleanup error
    }
  }

  // 7. Live host scanInstalledGames() test
  const liveGames = scanInstalledGames();
  assert(Array.isArray(liveGames), 'scanInstalledGames() must return an array');
  for (const g of liveGames) {
    assert(g.title && g.name, 'Every scanned game must have title and name');
    assert(g.launcher, 'Every scanned game must have a launcher');
    assert(g.drive, 'Every scanned game must have a drive/mount label');
    assert(g.minimum && g.recommended, 'Every scanned game must have enriched minimum & recommended specs');
  }
  console.log(`  [PASS] Live host scanInstalledGames() (${liveGames.length} games detected on ${process.platform})`);
  console.log('=== All Scanner Tests Passed! ===');
}

if (require.main === module) {
  runScannerTests();
}

module.exports = { runScannerTests };
