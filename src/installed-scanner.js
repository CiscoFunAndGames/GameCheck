const fs = require('fs');
const path = require('path');
const { getAllGames, enrichGameScores } = require('./games-db');

const DRIVES_TO_SCAN = ['C:', 'D:', 'E:', 'F:', 'G:'];

const NON_GAME_PATTERNS = [
  /steamworks\s*common\s*redistributables/i,
  /^proton\s/i,
  /^steam\s*linux\s*runtime/i,
  /^steamvr$/i,
  /^gog\s*galaxy$/i,
  /^epic\s*games\s*launcher$/i,
  /^ea\s*app$/i,
  /^ubisoft\s*connect$/i,
  /directx/i,
  /vcredist/i,
  /redistributable/i,
  /dedicated\s*server/i,
  /\bsdk\b/i,
  /benchmark\s*tool/i,
  /^soundtrack$/i
];

function isNonGameEntry(name = '') {
  if (!name || name.trim().length < 2) return true;
  return NON_GAME_PATTERNS.some((re) => re.test(name.trim()));
}

function slugify(text = '') {
  return text
    .toString()
    .toLowerCase()
    .replace(/[™®©]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeForMatch(title = '') {
  return title
    .toLowerCase()
    .replace(/[™®©]/g, '')
    .replace(/\biii\b/g, '3')
    .replace(/\bii\b/g, '2')
    .replace(/\biv\b/g, '4')
    .replace(/\bvi\b/g, '6')
    .replace(/\bv\b/g, '5')
    .replace(/\b(game of the year|goty|definitive|complete|director'?s cut|remastered|edition|next-gen|update|shadow of the erdtree|phantom liberty|wild hunt)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts key-value pairs from Valve's ACF / VDF text format
 */
function parseAcfFile(content) {
  const result = {};
  const pairRegex = /"([^"]+)"\s+"([^"]*)"/g;
  let match;
  while ((match = pairRegex.exec(content)) !== null) {
    const key = match[1].toLowerCase();
    const val = match[2];
    if (result[key] === undefined) {
      result[key] = val;
    }
  }
  return result;
}

/**
 * Extracts all Steam library paths from libraryfolders.vdf
 */
function parseLibraryFoldersVdf(vdfPath) {
  const paths = [];
  try {
    if (!fs.existsSync(vdfPath)) return paths;
    const content = fs.readFileSync(vdfPath, 'utf8');
    const pathRegex = /"path"\s+"([^"]+)"/gi;
    let match;
    while ((match = pathRegex.exec(content)) !== null) {
      const rawPath = match[1].replace(/\\\\/g, '\\');
      paths.push(path.join(rawPath, 'steamapps'));
    }
  } catch (e) {
    // ignore read errors
  }
  return paths;
}

/**
 * Discovers all candidate steamapps directories across drives C:..G:
 */
function discoverSteamAppsDirs() {
  const foundDirs = new Set();

  const candidateRelativePaths = [
    'Program Files (x86)\\Steam\\steamapps',
    'Program Files\\Steam\\steamapps',
    'Steam\\steamapps',
    'SteamLibrary\\steamapps',
    'Games\\Steam\\steamapps',
    'Games\\SteamLibrary\\steamapps',
    'Program Files (x86)\\SteamLibrary\\steamapps'
  ];

  for (const drive of DRIVES_TO_SCAN) {
    for (const rel of candidateRelativePaths) {
      const fullPath = `${drive}\\${rel}`;
      try {
        if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
          const normalized = path.normalize(fullPath);
          foundDirs.add(normalized);

          const vdfPath = path.join(normalized, 'libraryfolders.vdf');
          for (const extraSteamApps of parseLibraryFoldersVdf(vdfPath)) {
            try {
              if (fs.existsSync(extraSteamApps) && fs.statSync(extraSteamApps).isDirectory()) {
                foundDirs.add(path.normalize(extraSteamApps));
              }
            } catch (e) {
              // ignore inaccessible extra path
            }
          }
        }
      } catch (e) {
        // drive or folder inaccessible
      }
    }
  }

  return Array.from(foundDirs);
}

/**
 * Scans all discovered steamapps directories for appmanifest_*.acf files
 */
function scanSteamGames() {
  const results = [];
  const seenAppIds = new Set();
  const steamAppsDirs = discoverSteamAppsDirs();

  for (const steamAppsDir of steamAppsDirs) {
    try {
      const entries = fs.readdirSync(steamAppsDir);
      for (const file of entries) {
        if (!/^appmanifest_\d+\.acf$/i.test(file)) continue;
        const fullAcfPath = path.join(steamAppsDir, file);
        try {
          const content = fs.readFileSync(fullAcfPath, 'utf8');
          const parsed = parseAcfFile(content);
          const appId = parsed.appid || file.replace(/\D+/g, '');
          const name = parsed.name;
          if (!name || isNonGameEntry(name) || seenAppIds.has(appId)) continue;

          const sizeBytes = Number(parsed.sizeondisk) || 0;
          const installDirName = parsed.installdir || name;
          const installDir = path.join(steamAppsDir, 'common', installDirName);
          let sizeOnDiskGB = Math.max(1, Math.round((sizeBytes / (1024 ** 3)) * 10) / 10);
          if (sizeOnDiskGB <= 1.5 && fs.existsSync(installDir)) {
            sizeOnDiskGB = Math.max(sizeOnDiskGB, estimateDirectorySizeGB(installDir));
          }
          const drive = path.parse(steamAppsDir).root.replace(/[\\/]+$/, '') || 'C:';

          seenAppIds.add(appId);
          results.push({
            name: name.trim(),
            appId: String(appId),
            launcher: 'Steam',
            installDir,
            drive: drive.toUpperCase(),
            sizeOnDiskGB
          });
        } catch (e) {
          // ignore malformed manifest
        }
      }
    } catch (e) {
      // ignore unreadable directory
    }
  }

  return results;
}

/**
 * Scans Epic Games Launcher manifests (`C:\ProgramData\Epic\EpicGamesLauncher\Data\Manifests\*.item`)
 */
function scanEpicGames() {
  const results = [];
  const manifestDirs = DRIVES_TO_SCAN.map(
    (d) => `${d}\\ProgramData\\Epic\\EpicGamesLauncher\\Data\\Manifests`
  );

  const seenLocations = new Set();

  for (const dir of manifestDirs) {
    try {
      if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) continue;
      const files = fs.readdirSync(dir);
      for (const file of files) {
        if (!file.toLowerCase().endsWith('.item')) continue;
        try {
          const raw = fs.readFileSync(path.join(dir, file), 'utf8');
          const data = JSON.parse(raw);
          const name = data.DisplayName;
          const installLocation = data.InstallLocation;
          if (!name || isNonGameEntry(name)) continue;
          if (data.bIsIncompleteInstall) continue;

          // Verify install location if provided
          if (installLocation && seenLocations.has(installLocation.toLowerCase())) continue;
          if (installLocation) seenLocations.add(installLocation.toLowerCase());

          const sizeBytes = Number(data.InstallSize) || 0;
          const sizeOnDiskGB = Math.max(1, Math.round((sizeBytes / (1024 ** 3)) * 10) / 10);
          const drive = installLocation
            ? (path.parse(installLocation).root.replace(/[\\/]+$/, '') || 'C:')
            : 'C:';

          results.push({
            name: String(name).trim(),
            appId: data.AppName || data.CatalogItemId || null,
            launcher: 'Epic Games',
            installDir: installLocation || dir,
            drive: drive.toUpperCase(),
            sizeOnDiskGB
          });
        } catch (e) {
          // ignore invalid JSON manifest
        }
      }
    } catch (e) {
      // ignore missing Epic dir
    }
  }

  return results;
}

/**
 * Estimates folder size quickly (1-level deep + top subdirs) without blocking for minutes
 */
function estimateDirectorySizeGB(dirPath) {
  let totalBytes = 0;
  let filesChecked = 0;
  const maxFiles = 400;

  function walk(currentPath, depth) {
    if (depth > 3 || filesChecked >= maxFiles) return;
    try {
      const entries = fs.readdirSync(currentPath, { withFileTypes: true });
      for (const entry of entries) {
        if (filesChecked >= maxFiles) break;
        const full = path.join(currentPath, entry.name);
        if (entry.isFile()) {
          try {
            totalBytes += fs.statSync(full).size;
            filesChecked++;
          } catch (e) {
            // ignore
          }
        } else if (entry.isDirectory()) {
          walk(full, depth + 1);
        }
      }
    } catch (e) {
      // ignore permission errors
    }
  }

  walk(dirPath, 0);
  if (totalBytes <= 0) return 15;
  return Math.max(1, Math.round((totalBytes / (1024 ** 3)) * 10) / 10);
}

/**
 * Checks if a folder looks like an actual game installation (contains .exe or common game subdirs)
 */
function looksLikeGameFolder(dirPath) {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    if (entries.length === 0) return false;
    for (const entry of entries) {
      if (entry.isFile() && /\.exe$/i.test(entry.name)) {
        if (!/unins|setup|crash|redist|unitycrash/i.test(entry.name)) {
          return true;
        }
      }
      if (
        entry.isDirectory() &&
        /^(binaries|engine|content|data|gamedata|game|shipping|x64|win64)$/i.test(entry.name)
      ) {
        return true;
      }
    }
    // Check 1 level deeper for .exe
    for (const entry of entries) {
      if (entry.isDirectory()) {
        try {
          const sub = fs.readdirSync(path.join(dirPath, entry.name));
          if (sub.some((f) => /\.exe$/i.test(f))) return true;
        } catch (e) {
          // ignore
        }
      }
    }
  } catch (e) {
    return false;
  }
  return false;
}

/**
 * Scans standalone game folders (`Games`, `Program Files/Games`, `XboxGames`, `Riot Games`) across drives
 */
function scanStandaloneFolders(existingInstallDirs = new Set()) {
  const results = [];
  const standaloneRoots = [
    { rel: 'Games', launcher: 'Standalone' },
    { rel: 'Program Files\\Games', launcher: 'Standalone' },
    { rel: 'Program Files (x86)\\Games', launcher: 'Standalone' },
    { rel: 'XboxGames', launcher: 'Xbox / PC Game Pass' },
    { rel: 'Riot Games', launcher: 'Riot Games' },
    { rel: 'GOG Games', launcher: 'GOG Galaxy' },
    { rel: 'Program Files (x86)\\GOG Galaxy\\Games', launcher: 'GOG Galaxy' },
    { rel: 'Program Files\\EA Games', launcher: 'EA App' },
    { rel: 'Program Files (x86)\\Ubisoft\\Ubisoft Game Launcher\\games', launcher: 'Ubisoft Connect' }
  ];

  const skipFolderNames = new Set([
    'steam',
    'steamlibrary',
    'steamapps',
    'common',
    'riot client',
    'directx',
    'redist'
  ]);

  for (const drive of DRIVES_TO_SCAN) {
    for (const { rel, launcher } of standaloneRoots) {
      const rootDir = `${drive}\\${rel}`;
      try {
        if (!fs.existsSync(rootDir) || !fs.statSync(rootDir).isDirectory()) continue;
        const subdirs = fs.readdirSync(rootDir, { withFileTypes: true });
        for (const dirent of subdirs) {
          if (!dirent.isDirectory()) continue;
          const folderName = dirent.name.trim();
          if (skipFolderNames.has(folderName.toLowerCase()) || isNonGameEntry(folderName)) continue;

          const fullInstallDir = path.normalize(path.join(rootDir, folderName));
          if (existingInstallDirs.has(fullInstallDir.toLowerCase())) continue;
          if (!looksLikeGameFolder(fullInstallDir)) continue;

          existingInstallDirs.add(fullInstallDir.toLowerCase());
          const sizeOnDiskGB = estimateDirectorySizeGB(fullInstallDir);

          results.push({
            name: folderName,
            appId: null,
            launcher,
            installDir: fullInstallDir,
            drive: drive.toUpperCase(),
            sizeOnDiskGB
          });
        }
      } catch (e) {
        // ignore missing or restricted folder
      }
    }
  }

  return results;
}

/**
 * Fuzzy matches an installed game title against the catalog from games-db.js
 */
function matchCatalogGame(installedName, catalogGames) {
  const normInstalled = normalizeForMatch(installedName);
  const installedSlug = slugify(installedName);
  if (!normInstalled) return null;

  // 1. Direct normalized match or base title (before colon) match
  for (const game of catalogGames) {
    const normCatalog = normalizeForMatch(game.title);
    const baseCatalog = normalizeForMatch(game.title.split(':')[0]);
    const baseInstalled = normalizeForMatch(installedName.split(':')[0]);

    if (
      normInstalled === normCatalog ||
      installedSlug === game.id ||
      (baseCatalog.length >= 4 && normInstalled === baseCatalog) ||
      (baseInstalled.length >= 4 && baseInstalled === normCatalog) ||
      (baseCatalog.length >= 4 && baseInstalled === baseCatalog)
    ) {
      return game;
    }
  }

  // 2. Token overlap with number consistency check
  const installedTokens = normInstalled.split(' ').filter(Boolean);
  const installedNumbers = installedTokens.filter((t) => /^\d+$/.test(t));

  let bestMatch = null;
  let bestScore = 0;

  for (const game of catalogGames) {
    const normCatalog = normalizeForMatch(game.title);
    const catalogTokens = normCatalog.split(' ').filter(Boolean);
    const catalogNumbers = catalogTokens.filter((t) => /^\d+$/.test(t));

    // If both have numbers and they don't match, skip (e.g., Witcher 2 vs Witcher 3)
    if (
      installedNumbers.length > 0 &&
      catalogNumbers.length > 0 &&
      installedNumbers.join(',') !== catalogNumbers.join(',')
    ) {
      continue;
    }

    const common = installedTokens.filter((t) => catalogTokens.includes(t));
    const minLen = Math.min(installedTokens.length, catalogTokens.length);
    if (minLen === 0) continue;

    const overlapRatio = common.length / minLen;
    if (common.length >= 2 && overlapRatio >= 0.75 && overlapRatio > bestScore) {
      bestScore = overlapRatio;
      bestMatch = game;
    }
  }

  return bestMatch;
}

/**
 * Generates a playable fallback game spec object using enrichGameScores so ANY installed PC game can be analyzed
 */
function buildFallbackGameSpec(rawGame) {
  const sizeGB = Math.max(1, Math.round(rawGame.sizeOnDiskGB || 20));
  const title = rawGame.name;

  const isCompetitive = /valorant|league of legends|dota|counter-strike|cs2|overwatch|apex|rocket league|rainbow six|pubg|fortnite/i.test(
    title
  );
  const isHeavyAAA = sizeGB >= 60 || /unreal|cyber|witcher|red dead|call of duty|warzone|assassin|far cry|starfield|battlefield|halo|forza|horizon|spider-man|god of war|last of us|resident evil|final fantasy|baldur|elden|alan wake|stalker|wukong/i.test(title);
  const isMidTier = !isHeavyAAA && (sizeGB >= 20 || isCompetitive);

  let genre = 'Action / PC Game';
  if (/valorant|counter-strike|overwatch|apex|call of duty|battlefield|halo|doom|quake|rainbow six|pubg|shooter/i.test(title)) {
    genre = 'Shooter';
  } else if (/forza|assetto|dirt|f1|need for speed|crew|gran turismo|racing/i.test(title)) {
    genre = 'Racing';
  } else if (/witcher|elder scrolls|skyrim|fallout|baldur|divinity|diablo|path of exile|elden|souls|persona|final fantasy|dragon age|mass effect|rpg/i.test(title)) {
    genre = 'RPG';
  } else if (/civilization|total war|age of empires|starcraft|stellaris|crusader kings|hearts of iron|factorio|rimworld|cities/i.test(title)) {
    genre = 'Strategy / Simulation';
  } else if (/hollow knight|celeste|hades|dead cells|stardew|terraria|binding of isaac|slay the spire|undertale|balatro/i.test(title)) {
    genre = 'Indie';
  }

  let specTemplate;
  if (isHeavyAAA) {
    specTemplate = {
      supportsRT: sizeGB >= 70,
      supportsUpscaling: ['DLSS', 'FSR', 'XeSS'],
      ssdRequired: true,
      baseRecFps: 65,
      minimum: {
        cpu: 'Intel Core i5-8400 or AMD Ryzen 5 1600',
        gpu: 'NVIDIA GeForce GTX 1060 6GB or AMD Radeon RX 580 8GB',
        ramGB: 12,
        vramGB: 6
      },
      recommended: {
        cpu: 'Intel Core i7-10700 or AMD Ryzen 5 5600',
        gpu: 'NVIDIA GeForce RTX 2060 Super or AMD Radeon RX 6600 XT',
        ramGB: 16,
        vramGB: 8
      },
      tuningTips: [
        `Installed on ${rawGame.drive} (${sizeGB} GB via ${rawGame.launcher}).`,
        'Lower Shadow Quality and Volumetric Effects one step below Ultra for +15-20% FPS with minimal visual loss.',
        'Enable DLSS or FSR Quality mode when playing at 1440p or higher.'
      ]
    };
  } else if (isMidTier) {
    specTemplate = {
      supportsRT: false,
      supportsUpscaling: ['FSR', 'DLSS', 'Native'],
      ssdRequired: sizeGB >= 30,
      baseRecFps: isCompetitive ? 180 : 85,
      minimum: {
        cpu: 'Intel Core i5-6500 or AMD Ryzen 3 1200',
        gpu: 'NVIDIA GeForce GTX 1050 Ti or AMD Radeon RX 570',
        ramGB: 8,
        vramGB: 4
      },
      recommended: {
        cpu: 'Intel Core i5-10400 or AMD Ryzen 5 3600',
        gpu: 'NVIDIA GeForce GTX 1660 Super or AMD Radeon RX 5600 XT',
        ramGB: 16,
        vramGB: 6
      },
      tuningTips: [
        `Installed on ${rawGame.drive} (${sizeGB} GB via ${rawGame.launcher}).`,
        isCompetitive
          ? 'Use Native resolution with Low/Medium effects and Reflex/Anti-Lag enabled for minimum input latency.'
          : 'High preset at 1080p/1440p provides the best balance of visual fidelity and smooth frame pacing.'
      ]
    };
  } else {
    specTemplate = {
      supportsRT: false,
      supportsUpscaling: ['Native'],
      ssdRequired: false,
      baseRecFps: 120,
      minimum: {
        cpu: 'Intel Core i3-4130 or AMD Ryzen 3 1200',
        gpu: 'NVIDIA GeForce GTX 750 Ti or AMD Radeon RX 460',
        ramGB: 4,
        vramGB: 2
      },
      recommended: {
        cpu: 'Intel Core i5-8400 or AMD Ryzen 5 2600',
        gpu: 'NVIDIA GeForce GTX 1060 or AMD Radeon RX 580',
        ramGB: 8,
        vramGB: 4
      },
      tuningTips: [
        `Installed on ${rawGame.drive} (${sizeGB} GB via ${rawGame.launcher}).`,
        'Lightweight title: run at Native resolution with V-Sync or a frame rate cap matched to your monitor refresh rate.'
      ]
    };
  }

  return enrichGameScores({
    id: `installed-${slugify(title) || rawGame.appId || 'game'}`,
    title,
    genre,
    releaseYear: 2023,
    engine: `${rawGame.launcher} Installed Title`,
    supportsRT: specTemplate.supportsRT,
    supportsUpscaling: specTemplate.supportsUpscaling,
    storageGB: sizeGB,
    ssdRequired: specTemplate.ssdRequired,
    baseRecFps: specTemplate.baseRecFps,
    minimum: specTemplate.minimum,
    recommended: specTemplate.recommended,
    tuningTips: specTemplate.tuningTips
  });
}

/**
 * Scans C:..G: drives for Steam, Epic Games, and Standalone games, matching against games-db
 * or generating an enriched fallback spec object for every found game.
 */
function scanInstalledGames() {
  const catalogGames = getAllGames();

  const steamGames = scanSteamGames();
  const epicGames = scanEpicGames();

  const knownInstallDirs = new Set();
  for (const g of [...steamGames, ...epicGames]) {
    if (g.installDir) knownInstallDirs.add(path.normalize(g.installDir).toLowerCase());
  }

  const standaloneGames = scanStandaloneFolders(knownInstallDirs);
  const allRaw = [...steamGames, ...epicGames, ...standaloneGames];

  // Deduplicate by normalized name
  const seenNames = new Set();
  const uniqueInstalled = [];

  for (const raw of allRaw) {
    const key = normalizeForMatch(raw.name) || raw.name.toLowerCase();
    if (seenNames.has(key)) continue;
    seenNames.add(key);

    const matched = matchCatalogGame(raw.name, catalogGames);
    const baseGame = matched ? { ...matched } : buildFallbackGameSpec(raw);

    uniqueInstalled.push({
      ...baseGame,
      installed: true,
      installedTitle: raw.name,
      launcher: raw.launcher,
      appId: raw.appId,
      installDir: raw.installDir,
      drive: raw.drive,
      sizeOnDiskGB: raw.sizeOnDiskGB,
      storageGB: Math.max(1, Math.round(raw.sizeOnDiskGB || baseGame.storageGB || 20)),
      matchedCatalogId: matched ? matched.id : null
    });
  }

  uniqueInstalled.sort((a, b) => (b.sizeOnDiskGB || 0) - (a.sizeOnDiskGB || 0));
  return uniqueInstalled;
}

module.exports = {
  scanInstalledGames,
  matchCatalogGame,
  buildFallbackGameSpec
};
