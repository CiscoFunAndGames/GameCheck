const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');
const {
  STEAM_APP_ID_MAP,
  getAllGames,
  enrichGameScores,
  buildFallbackBannerSvg,
  buildFallbackLogoSvg,
  getGameMonogram
} = require('./games-db');

const DRIVES_TO_SCAN = ['C:', 'D:', 'E:', 'F:', 'G:'];

const KNOWN_GAME_EXECUTABLES = {
  'cyberpunk-2077': ['cyberpunk2077.exe', 'cyberpunk2077'],
  'black-myth-wukong': ['b1-win64-shipping.exe', 'b1.exe'],
  'elden-ring': ['eldenring.exe', 'start_protected_game.exe'],
  'baldurs-gate-3': ['bg3.exe', 'bg3_dx11.exe'],
  'red-dead-redemption-2': ['rdr2.exe', 'playrdr2.exe'],
  'helldivers-2': ['helldivers2.exe'],
  'counter-strike-2': ['cs2.exe', 'cs2'],
  'alan-wake-2': ['alanwake2.exe'],
  'forza-horizon-5': ['forzahorizon5.exe'],
  'monster-hunter-wilds': ['monsterhunterwilds.exe'],
  'gta-v': ['gta5.exe', 'gtav.exe', 'playgtav.exe'],
  'witcher-3-next-gen': ['witcher3.exe'],
  'valorant': ['valorant-win64-shipping.exe', 'valorant.exe'],
  'apex-legends': ['r5apex.exe', 'r5apex_dx12.exe'],
  'cod-black-ops-6-warzone': ['cod.exe', 'sp24-cod.exe'],
  'hogwarts-legacy': ['hogwartslegacy.exe'],
  'starfield': ['starfield.exe'],
  'spider-man-remastered': ['spider-man.exe'],
  'god-of-war-ragnarok': ['gowr.exe'],
  'ghost-of-tsushima': ['ghostoftsushima.exe'],
  'minecraft-shaders': ['javaw.exe', 'minecraft.exe'],
  'path-of-exile-2': ['pathofexile.exe', 'pathofexile2.exe', 'pathofexilesteam.exe'],
  'stalker-2': ['stalker2-win64-shipping.exe', 'stalker2.exe'],
  'resident-evil-4-remake': ['re4.exe']
};

const SYSTEM_PROCESS_IGNORE = new Set([
  'system', 'idle', 'svchost.exe', 'explorer.exe', 'steam.exe', 'steamwebhelper.exe',
  'steamservice.exe', 'epicgameslauncher.exe', 'epicwebhelper.exe', 'galaxyclient.exe',
  'electron.exe', 'node.exe', 'code.exe', 'chrome.exe', 'msedge.exe', 'firefox.exe',
  'conhost.exe', 'powershell.exe', 'cmd.exe', 'tasklist.exe', 'dwm.exe', 'csrss.exe',
  'runtimebroker.exe', 'searchhost.exe', 'applicationframehost.exe', 'bash', 'sh', 'ps'
]);

let cachedProcessSnapshot = { timestamp: 0, names: new Set() };

/**
 * 100% Non-Invasive Read-Only Process Name Snapshot.
 * Never hooks, inspects memory, or touches any process—only reads process table names once per scan.
 */
function getRunningProcessNames(options = {}) {
  if (Array.isArray(options.runningProcesses)) {
    return new Set(options.runningProcesses.map((p) => String(p).toLowerCase().trim()));
  }
  const now = Date.now();
  if (now - cachedProcessSnapshot.timestamp < 4000 && cachedProcessSnapshot.names.size > 0) {
    return cachedProcessSnapshot.names;
  }

  const names = new Set();
  try {
    if (process.platform === 'win32') {
      const out = execSync('tasklist /FO CSV /NH', {
        encoding: 'utf8',
        timeout: 1500,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'ignore']
      });
      const lines = out.split(/\r?\n/);
      for (const line of lines) {
        const m = line.match(/^"([^"]+)"/);
        if (m && m[1]) {
          const proc = m[1].toLowerCase().trim();
          if (!SYSTEM_PROCESS_IGNORE.has(proc)) {
            names.add(proc);
            names.add(proc.replace(/\.exe$/i, ''));
          }
        }
      }
    } else {
      const out = execSync('ps -eo comm', {
        encoding: 'utf8',
        timeout: 1500,
        stdio: ['ignore', 'pipe', 'ignore']
      });
      const lines = out.split(/\r?\n/);
      for (const line of lines) {
        const proc = line.toLowerCase().trim();
        if (proc && !SYSTEM_PROCESS_IGNORE.has(proc)) {
          names.add(proc);
        }
      }
    }
  } catch (_e) {
    // Non-invasive fallback: if tasklist/ps is unavailable, return empty set
  }

  cachedProcessSnapshot = { timestamp: now, names };
  return names;
}

function getSafeMtimeMs(targetPath) {
  if (!targetPath || typeof targetPath !== 'string') return 0;
  try {
    if (fs.existsSync(targetPath)) {
      const st = fs.statSync(targetPath);
      return Number(st.mtimeMs) || 0;
    }
  } catch (_e) {
    // ignore
  }
  return 0;
}

function isGameProcessRunning(game, runningProcs) {
  if (!runningProcs || runningProcs.size === 0) return false;
  const catalogId = game.matchedCatalogId || game.id || '';
  const knownExes = KNOWN_GAME_EXECUTABLES[catalogId] || [];
  for (const exe of knownExes) {
    const clean = exe.toLowerCase();
    if (runningProcs.has(clean) || runningProcs.has(clean.replace(/\.exe$/i, ''))) {
      return true;
    }
  }

  const compactSlug = String(game.installedTitle || game.name || game.title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
  if (compactSlug.length >= 5) {
    for (const proc of runningProcs) {
      const cleanProc = proc.replace(/\.exe$/i, '').replace(/[^a-z0-9]+/g, '');
      if (cleanProc.length >= 5 && (cleanProc === compactSlug || cleanProc.includes(compactSlug))) {
        return true;
      }
    }
  }
  return false;
}

function attachPlayStatusAndVisuals(game, runningProcs = new Set()) {
  const catalogId = game.matchedCatalogId || game.id || '';
  const numericAppId =
    game.steamAppId ||
    (game.launcher === 'Steam' && game.appId && /^\d+$/.test(String(game.appId).trim())
      ? String(game.appId).trim()
      : null) ||
    STEAM_APP_ID_MAP[catalogId] ||
    STEAM_APP_ID_MAP[game.id] ||
    null;

  const steamAppId = numericAppId ? String(numericAppId) : null;
  const fallbackBannerSvg = game.fallbackBannerSvg || buildFallbackBannerSvg(game);
  const fallbackLogoSvg = game.fallbackLogoSvg || buildFallbackLogoSvg(game);
  const bannerUrl =
    game.bannerUrl && !String(game.bannerUrl).startsWith('data:')
      ? game.bannerUrl
      : steamAppId
      ? `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${steamAppId}/header.jpg`
      : fallbackBannerSvg;
  const logoUrl =
    game.logoUrl && !String(game.logoUrl).startsWith('data:')
      ? game.logoUrl
      : steamAppId
      ? `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${steamAppId}/logo.png`
      : fallbackLogoSvg;

  let lastPlayedTimestamp = Number(game.lastPlayedTimestamp) || 0;
  if (!lastPlayedTimestamp && game.installDir) {
    lastPlayedTimestamp = getSafeMtimeMs(game.installDir);
  }

  const isRunning = Boolean(game.isRunning || isGameProcessRunning(game, runningProcs));
  // Mark as recently played if running, or has a valid lastPlayedTimestamp from Steam ACF / recent folder modification
  const thirtyDaysAgoMs = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const wasRecentlyPlayed = Boolean(
    isRunning ||
      game.wasRecentlyPlayed ||
      (lastPlayedTimestamp > 0 && (lastPlayedTimestamp >= thirtyDaysAgoMs || game.hasAcfLastPlayed))
  );

  const playStatus = isRunning
    ? 'PLAYING_NOW'
    : wasRecentlyPlayed
    ? 'RECENTLY_PLAYED'
    : 'INSTALLED';

  const playStatusLabel = isRunning
    ? '🟢 Playing Now'
    : wasRecentlyPlayed
    ? '🕒 Recently Played'
    : '💾 Installed';

  return {
    ...game,
    steamAppId,
    bannerUrl,
    logoUrl,
    fallbackBannerSvg,
    fallbackLogoSvg,
    monogram: game.monogram || getGameMonogram(game.title || game.name || 'Game'),
    lastPlayedTimestamp,
    isRunning,
    wasRecentlyPlayed,
    playStatus,
    playStatusLabel
  };
}

const NON_GAME_PATTERNS = [
  /steamworks\s*common\s*redistributables/i,
  /^proton\s/i,
  /^proton\s*experimental/i,
  /^proton\s*hotfix/i,
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
    .replace(
      /\b(game of the year|goty|definitive|complete|director'?s cut|remastered|edition|next-gen|update|shadow of the erdtree|phantom liberty|wild hunt)\b/g,
      ' '
    )
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Cross-platform drive or mount label extractor.
 * Returns Windows drive letters ('C:', 'D:') on Windows paths,
 * and Linux mount prefixes ('/home', '/mnt/games', '/media/user/nvme', '/') on POSIX paths.
 */
function extractDriveLetter(installPath) {
  if (!installPath || typeof installPath !== 'string') {
    return process.platform === 'linux' ? '/' : 'C:';
  }

  const trimmed = installPath.trim();
  if (!trimmed) {
    return process.platform === 'linux' ? '/' : 'C:';
  }

  // Windows drive letter (e.g. C:\..., D:/..., E:)
  const winDriveMatch = trimmed.match(/^([a-zA-Z]):/);
  if (winDriveMatch) {
    return `${winDriveMatch[1].toUpperCase()}:`;
  }

  // Expand ~ if present
  if (trimmed.startsWith('~')) {
    return '/home';
  }

  // POSIX path handling
  const clean = trimmed.replace(/\\/g, '/');
  if (clean.startsWith('/')) {
    const parts = clean.split('/').filter(Boolean);
    if (parts.length === 0) return '/';

    if (parts[0] === 'home') {
      return '/home';
    }

    if (parts[0] === 'mnt') {
      return parts.length >= 2 ? `/mnt/${parts[1]}` : '/mnt';
    }

    if (parts[0] === 'run' && parts[1] === 'media') {
      if (parts.length >= 4) return `/run/media/${parts[2]}/${parts[3]}`;
      if (parts.length === 3) return `/run/media/${parts[2]}`;
      return '/run/media';
    }

    if (parts[0] === 'media') {
      if (
        parts.length >= 3 &&
        !/^(steamlibrary|steam|steamapps|games|common)$/i.test(parts[2])
      ) {
        return `/media/${parts[1]}/${parts[2]}`;
      }
      return parts.length >= 2 ? `/media/${parts[1]}` : '/media';
    }

    return '/';
  }

  const parsedRoot = path.parse(trimmed).root.replace(/[\\/]+$/, '');
  if (parsedRoot) {
    return parsedRoot.toUpperCase();
  }

  return process.platform === 'linux' ? '/' : 'C:';
}

/**
 * Extracts key-value pairs from Valve's ACF / VDF text format.
 * Also attaches a `paths` array when multiple `"path"` entries are present (e.g. libraryfolders.vdf).
 */
function parseAcfFile(content) {
  const result = {};
  if (!content || typeof content !== 'string') return result;

  const pairRegex = /"([^"]+)"\s+"([^"]*)"/g;
  const paths = [];
  let match;
  while ((match = pairRegex.exec(content)) !== null) {
    const key = match[1].toLowerCase();
    const val = match[2];
    if (key === 'path') {
      paths.push(val.replace(/\\\\/g, '\\'));
    }
    if (result[key] === undefined) {
      result[key] = val;
    }
  }
  if (paths.length > 0 && !result.paths) {
    Object.defineProperty(result, 'paths', {
      value: paths,
      enumerable: false,
      configurable: true
    });
  }
  return result;
}

/**
 * Alias for parseAcfFile supporting both ACF manifests and VDF files.
 */
function parseVdf(contentOrPath) {
  if (!contentOrPath || typeof contentOrPath !== 'string') return {};
  let text = contentOrPath;
  if (!contentOrPath.includes('\n') && !contentOrPath.includes('"') && fs.existsSync(contentOrPath)) {
    try {
      text = fs.readFileSync(contentOrPath, 'utf8');
    } catch (e) {
      return {};
    }
  }
  return parseAcfFile(text);
}

/**
 * Joins a base path and sub-segment while preserving POSIX slashes for Linux paths even when run on Windows.
 */
function joinCrossPlatform(basePath, ...segments) {
  if (typeof basePath === 'string' && basePath.startsWith('/') && !/^[a-zA-Z]:/.test(basePath)) {
    return path.posix.join(basePath.replace(/\\/g, '/'), ...segments.map((s) => String(s).replace(/\\/g, '/')));
  }
  return path.join(basePath, ...segments);
}

/**
 * Extracts all Steam library steamapps paths from libraryfolders.vdf (file path or raw VDF content)
 */
function parseLibraryFoldersVdf(vdfPathOrContent) {
  const paths = [];
  if (!vdfPathOrContent || typeof vdfPathOrContent !== 'string') return paths;

  try {
    let content = vdfPathOrContent;
    const looksLikeContent = content.includes('\n') || content.includes('"path"') || content.includes('"libraryfolders"');
    if (!looksLikeContent) {
      if (!fs.existsSync(vdfPathOrContent)) return paths;
      content = fs.readFileSync(vdfPathOrContent, 'utf8');
    }

    const pathRegex = /"path"\s+"([^"]+)"/gi;
    let match;
    while ((match = pathRegex.exec(content)) !== null) {
      const rawPath = match[1].replace(/\\\\/g, '\\').trim();
      if (!rawPath) continue;
      if (/[/\\]steamapps$/i.test(rawPath)) {
        paths.push(rawPath);
      } else {
        paths.push(joinCrossPlatform(rawPath, 'steamapps'));
      }
    }
  } catch (e) {
    // ignore read errors
  }
  return paths;
}

/**
 * Discovers Linux Steam library (`steamapps`) folders across standard Linux Steam locations:
 * - ~/.steam/steam/steamapps/libraryfolders.vdf
 * - ~/.local/share/Steam/steamapps/libraryfolders.vdf
 * - ~/.steam/root/steamapps/libraryfolders.vdf
 * - Flatpak: ~/.var/app/com.valvesoftware.Steam/.local/share/Steam/steamapps/libraryfolders.vdf
 * - Snap: ~/snap/steam/common/.local/share/Steam/steamapps/libraryfolders.vdf
 * - Common Linux mount roots (/mnt/<drive>, /media/<user>/<drive>, /run/media/<user>/<drive>)
 */
function getLinuxSteamLibraryFolders(options = {}) {
  const opts = typeof options === 'string' ? { homeDir: options } : options || {};
  const homeDir = opts.homeDir || os.homedir();
  const mountRoots = opts.mountRoots || ['/mnt', '/media', '/run/media'];
  const foundDirs = new Set();

  const addSteamAppsCandidate = (steamAppsDir, vdfFilePath) => {
    const vdfToRead = vdfFilePath || joinCrossPlatform(steamAppsDir, 'libraryfolders.vdf');
    let dirExists = false;
    let vdfExists = false;
    try {
      dirExists = Boolean(steamAppsDir && fs.existsSync(steamAppsDir) && fs.statSync(steamAppsDir).isDirectory());
    } catch (e) {
      dirExists = false;
    }
    try {
      vdfExists = Boolean(vdfToRead && fs.existsSync(vdfToRead) && fs.statSync(vdfToRead).isFile());
    } catch (e) {
      vdfExists = false;
    }

    if (dirExists && steamAppsDir) {
      foundDirs.add(steamAppsDir.startsWith('/') ? path.posix.normalize(steamAppsDir) : path.normalize(steamAppsDir));
    } else if (vdfExists && steamAppsDir) {
      foundDirs.add(steamAppsDir.startsWith('/') ? path.posix.normalize(steamAppsDir) : path.normalize(steamAppsDir));
    }

    if (vdfExists) {
      const extraPaths = parseLibraryFoldersVdf(vdfToRead);
      for (const extra of extraPaths) {
        const normExtra = extra.startsWith('/') ? path.posix.normalize(extra) : path.normalize(extra);
        foundDirs.add(normExtra);
      }
    }
  };

  // If homeDir itself is a direct fixture directory containing libraryfolders.vdf or steamapps
  if (homeDir) {
    if (/libraryfolders\.vdf$/i.test(homeDir)) {
      addSteamAppsCandidate(path.dirname(homeDir), homeDir);
    } else {
      addSteamAppsCandidate(homeDir, path.join(homeDir, 'libraryfolders.vdf'));
      addSteamAppsCandidate(path.join(homeDir, 'steamapps'), path.join(homeDir, 'steamapps', 'libraryfolders.vdf'));
    }
  }

  // Standard Linux Steam locations relative to homeDir
  const homeRelativeSteamApps = [
    ['.steam', 'steam', 'steamapps'],
    ['.local', 'share', 'Steam', 'steamapps'],
    ['.steam', 'root', 'steamapps'],
    ['.var', 'app', 'com.valvesoftware.Steam', '.local', 'share', 'Steam', 'steamapps'],
    ['snap', 'steam', 'common', '.local', 'share', 'Steam', 'steamapps']
  ];

  if (homeDir) {
    for (const segments of homeRelativeSteamApps) {
      const candidateDir = joinCrossPlatform(homeDir, ...segments);
      addSteamAppsCandidate(candidateDir);
    }
  }

  // Scan common Linux mount roots (/mnt/*, /media/*/*, /run/media/*/*)
  const inspectMountPoint = (mountPoint) => {
    const mountCandidates = [
      joinCrossPlatform(mountPoint, 'SteamLibrary', 'steamapps'),
      joinCrossPlatform(mountPoint, 'Steam', 'steamapps'),
      joinCrossPlatform(mountPoint, 'steamapps')
    ];
    for (const cand of mountCandidates) {
      addSteamAppsCandidate(cand);
    }
  };

  for (const root of mountRoots) {
    try {
      if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) continue;
      const level1 = fs.readdirSync(root, { withFileTypes: true });
      for (const entry1 of level1) {
        if (!entry1.isDirectory()) continue;
        const path1 = joinCrossPlatform(root, entry1.name);
        inspectMountPoint(path1);

        // 2 levels deep for /media/<user>/<drive> and /run/media/<user>/<drive>
        try {
          const level2 = fs.readdirSync(path1, { withFileTypes: true });
          for (const entry2 of level2) {
            if (!entry2.isDirectory()) continue;
            const path2 = joinCrossPlatform(path1, entry2.name);
            inspectMountPoint(path2);
          }
        } catch (e) {
          // ignore unreadable subdir
        }
      }
    } catch (e) {
      // ignore missing mount root
    }
  }

  if (Array.isArray(opts.vdfPaths)) {
    for (const vdfPath of opts.vdfPaths) {
      addSteamAppsCandidate(path.dirname(vdfPath), vdfPath);
    }
  }

  if (Array.isArray(opts.extraSteamAppsDirs)) {
    for (const dir of opts.extraSteamAppsDirs) {
      addSteamAppsCandidate(dir);
    }
  }

  return Array.from(foundDirs);
}

/**
 * Inspects Steam Play / Proton compatibility metadata for a given Steam appId.
 * Checks `steamapps/compatdata/<appId>/version` and `config_info`.
 */
function detectSteamProtonInfo(steamAppsDir, appId, options = {}) {
  const isLinuxContext =
    (options && options.platform === 'linux') ||
    process.platform === 'linux' ||
    (typeof steamAppsDir === 'string' && steamAppsDir.startsWith('/'));

  if (!steamAppsDir || typeof steamAppsDir !== 'string') {
    return {
      runtime: 'Native',
      protonVersion: null,
      linuxCompatNote: isLinuxContext ? 'Native Linux Runtime' : null
    };
  }

  const candidateCompatDirs = [];
  if (appId !== undefined && appId !== null && typeof appId !== 'object') {
    const idStr = String(appId).trim();
    candidateCompatDirs.push(path.join(steamAppsDir, 'compatdata', idStr));
    candidateCompatDirs.push(path.join(steamAppsDir, idStr));
  } else {
    candidateCompatDirs.push(steamAppsDir);
  }

  let compatDir = null;
  for (const cand of candidateCompatDirs) {
    try {
      if (fs.existsSync(cand) && fs.statSync(cand).isDirectory()) {
        compatDir = cand;
        break;
      }
    } catch (e) {
      // ignore
    }
  }

  if (!compatDir) {
    return {
      runtime: 'Native',
      protonVersion: null,
      linuxCompatNote: isLinuxContext ? 'Native Linux Runtime' : null
    };
  }

  let rawVersion = '';
  const versionFile = path.join(compatDir, 'version');
  const configInfoFile = path.join(compatDir, 'config_info');

  try {
    if (fs.existsSync(versionFile)) {
      rawVersion = fs.readFileSync(versionFile, 'utf8').split(/\r?\n/)[0].trim();
    }
  } catch (e) {
    // ignore
  }

  if (!rawVersion) {
    try {
      if (fs.existsSync(configInfoFile)) {
        const lines = fs
          .readFileSync(configInfoFile, 'utf8')
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean);
        if (lines.length > 0) {
          rawVersion = lines[0];
        }
      }
    } catch (e) {
      // ignore
    }
  }

  let protonVersion = 'Proton (Steam Play)';
  if (rawVersion) {
    if (/^(ge-proton|proton)/i.test(rawVersion)) {
      protonVersion = rawVersion.replace(/^proton/i, 'Proton');
    } else if (/^experimental$/i.test(rawVersion)) {
      protonVersion = 'Proton Experimental';
    } else if (/^hotfix$/i.test(rawVersion)) {
      protonVersion = 'Proton Hotfix';
    } else {
      // Check if version string like "9.0-3" can be normalized cleanly (e.g. "Proton 9.0-3" or "Proton 9.0")
      protonVersion = `Proton ${rawVersion}`;
    }
  }

  return {
    runtime: 'Proton',
    protonVersion,
    linuxCompatNote: `Steam Play (${protonVersion})`
  };
}

/**
 * Discovers all candidate steamapps directories across Windows drives C:..G: and/or Linux paths
 */
function discoverSteamAppsDirs(options = {}) {
  const foundDirs = new Set();
  const platform = options.platform || process.platform;

  if (platform === 'win32' && !options.linuxOnly) {
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
  }

  if (platform === 'linux' || options.homeDir || options.mountRoots || options.includeLinux) {
    for (const linuxDir of getLinuxSteamLibraryFolders(options)) {
      foundDirs.add(linuxDir);
    }
  }

  return Array.from(foundDirs);
}

/**
 * Scans all discovered steamapps directories for appmanifest_*.acf files
 */
function scanSteamGames(options = {}) {
  const results = [];
  const seenAppIds = new Set();
  let steamAppsDirs = [];

  if (typeof options === 'string') {
    steamAppsDirs = getLinuxSteamLibraryFolders({ homeDir: options });
  } else if (Array.isArray(options)) {
    steamAppsDirs = options;
  } else if (options && Array.isArray(options.steamAppsDirs)) {
    steamAppsDirs = options.steamAppsDirs;
  } else {
    steamAppsDirs = discoverSteamAppsDirs(options);
  }

  const catalogGames = getAllGames();
  const runningProcs = getRunningProcessNames(options);

  for (const steamAppsDir of steamAppsDirs) {
    try {
      if (!fs.existsSync(steamAppsDir) || !fs.statSync(steamAppsDir).isDirectory()) continue;
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
          const installDir = joinCrossPlatform(steamAppsDir, 'common', installDirName);
          let sizeOnDiskGB = Math.max(1, Math.round((sizeBytes / (1024 ** 3)) * 10) / 10);
          if (sizeOnDiskGB <= 1.5 && fs.existsSync(installDir)) {
            sizeOnDiskGB = Math.max(sizeOnDiskGB, estimateDirectorySizeGB(installDir));
          }
          const drive = extractDriveLetter(installDir || steamAppsDir);
          const protonInfo = detectSteamProtonInfo(steamAppsDir, appId, options);
          const matched = matchCatalogGame(name.trim(), catalogGames);

          const rawEpoch = Number(parsed.lastplayed || parsed.lastupdated || 0);
          const lastPlayedTimestamp =
            rawEpoch > 1e11 ? rawEpoch : rawEpoch > 0 ? rawEpoch * 1000 : getSafeMtimeMs(installDir);

          seenAppIds.add(appId);
          results.push(
            attachPlayStatusAndVisuals(
              {
                name: name.trim(),
                title: matched ? matched.title : name.trim(),
                genre: matched ? matched.genre : 'PC Game',
                engine: matched ? matched.engine : 'Steam Installed Title',
                appId: String(appId),
                steamAppId: String(appId),
                launcher: 'Steam',
                installDir,
                drive,
                sizeOnDiskGB,
                runtime: protonInfo.runtime,
                protonVersion: protonInfo.protonVersion,
                linuxCompatNote: protonInfo.linuxCompatNote,
                matchedCatalogId: matched ? matched.id : null,
                lastPlayedTimestamp,
                hasAcfLastPlayed: rawEpoch > 0
              },
              runningProcs
            )
          );
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
function scanEpicGames(options = {}) {
  const results = [];
  const opts = options || {};
  const platform = opts.platform || process.platform;
  if (opts.linuxOnly || (platform !== 'win32' && !opts.epicManifestDirs)) return results;

  const manifestDirs = Array.isArray(opts.epicManifestDirs)
    ? opts.epicManifestDirs
    : opts.homeDir
    ? []
    : DRIVES_TO_SCAN.map((d) => `${d}\\ProgramData\\Epic\\EpicGamesLauncher\\Data\\Manifests`);

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

          if (installLocation && seenLocations.has(installLocation.toLowerCase())) continue;
          if (installLocation) seenLocations.add(installLocation.toLowerCase());

          const sizeBytes = Number(data.InstallSize) || 0;
          const sizeOnDiskGB = Math.max(1, Math.round((sizeBytes / (1024 ** 3)) * 10) / 10);
          const drive = extractDriveLetter(installLocation || dir);

          results.push({
            name: String(name).trim(),
            appId: data.AppName || data.CatalogItemId || null,
            launcher: 'Epic Games',
            installDir: installLocation || dir,
            drive,
            sizeOnDiskGB,
            runtime: 'Native',
            protonVersion: null,
            linuxCompatNote: null
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
 * Helper to parse various size representations (bytes, GiB/GB strings, MiB/MB strings) into GB
 */
function parseSizeToGB(rawSize, installDir) {
  if (typeof rawSize === 'number' && Number.isFinite(rawSize) && rawSize > 0) {
    if (rawSize > 100000) {
      return Math.max(1, Math.round((rawSize / (1024 ** 3)) * 10) / 10);
    }
    return Math.max(1, Math.round(rawSize * 10) / 10);
  }

  if (typeof rawSize === 'string' && rawSize.trim()) {
    const str = rawSize.trim();
    const gbMatch = str.match(/([\d.]+)\s*(?:gib|gb|g)\b/i);
    if (gbMatch) {
      return Math.max(1, Math.round( parseFloat(gbMatch[1]) * 10 ) / 10);
    }
    const mbMatch = str.match(/([\d.]+)\s*(?:mib|mb|m)\b/i);
    if (mbMatch) {
      return Math.max(1, Math.round((parseFloat(mbMatch[1]) / 1024) * 10) / 10);
    }
    const num = Number(str);
    if (Number.isFinite(num) && num > 0) {
      if (num > 100000) {
        return Math.max(1, Math.round((num / (1024 ** 3)) * 10) / 10);
      }
      return Math.max(1, Math.round(num * 10) / 10);
    }
  }

  if (installDir && fs.existsSync(installDir)) {
    return estimateDirectorySizeGB(installDir);
  }
  return 20;
}

/**
 * Scans Heroic Games Launcher installed games across Linux & Windows (Epic / Legendary + GOG).
 * Supports both array and object-map formats in `installed.json`.
 */
function scanHeroicGames(options = {}) {
  const opts = typeof options === 'string' ? { customPath: options } : options || {};
  const homeDir = opts.homeDir || os.homedir();
  const appDataDir = opts.appDataDir || process.env.APPDATA || (homeDir ? path.join(homeDir, 'AppData', 'Roaming') : '');

  const candidateFiles = [];
  const addCandidate = (filePath, defaultStore) => {
    if (filePath) candidateFiles.push({ filePath, defaultStore });
  };

  if (opts.customPath) {
    try {
      if (fs.existsSync(opts.customPath) && fs.statSync(opts.customPath).isFile()) {
        const isGog = /gog/i.test(opts.customPath);
        addCandidate(opts.customPath, isGog ? 'gog' : 'epic');
      } else {
        const base = opts.customPath;
        addCandidate(path.join(base, 'installed.json'), 'epic');
        addCandidate(path.join(base, 'gog_store', 'installed.json'), 'gog');
        addCandidate(path.join(base, 'legendaryConfig', 'legendary', 'installed.json'), 'epic');
        addCandidate(path.join(base, 'heroic', 'installed.json'), 'epic');
        addCandidate(path.join(base, 'heroic', 'gog_store', 'installed.json'), 'gog');
        addCandidate(path.join(base, 'heroic', 'legendaryConfig', 'legendary', 'installed.json'), 'epic');
        addCandidate(path.join(base, '.config', 'heroic', 'installed.json'), 'epic');
        addCandidate(path.join(base, '.config', 'heroic', 'gog_store', 'installed.json'), 'gog');
        addCandidate(path.join(base, '.config', 'heroic', 'legendaryConfig', 'legendary', 'installed.json'), 'epic');
        addCandidate(
          path.join(base, '.var', 'app', 'com.heroicgameslauncher.hgl', 'config', 'heroic', 'installed.json'),
          'epic'
        );
        addCandidate(
          path.join(base, '.var', 'app', 'com.heroicgameslauncher.hgl', 'config', 'heroic', 'gog_store', 'installed.json'),
          'gog'
        );
        addCandidate(
          path.join(
            base,
            '.var',
            'app',
            'com.heroicgameslauncher.hgl',
            'config',
            'heroic',
            'legendaryConfig',
            'legendary',
            'installed.json'
          ),
          'epic'
        );
      }
    } catch (e) {
      // ignore
    }
  } else {
    if (homeDir) {
      // Standard Linux Heroic paths
      addCandidate(path.join(homeDir, '.config', 'heroic', 'installed.json'), 'epic');
      addCandidate(path.join(homeDir, '.config', 'heroic', 'gog_store', 'installed.json'), 'gog');
      addCandidate(path.join(homeDir, '.config', 'heroic', 'legendaryConfig', 'legendary', 'installed.json'), 'epic');

      // Flatpak Heroic paths
      const flatpakHeroic = path.join(homeDir, '.var', 'app', 'com.heroicgameslauncher.hgl', 'config', 'heroic');
      addCandidate(path.join(flatpakHeroic, 'installed.json'), 'epic');
      addCandidate(path.join(flatpakHeroic, 'gog_store', 'installed.json'), 'gog');
      addCandidate(path.join(flatpakHeroic, 'legendaryConfig', 'legendary', 'installed.json'), 'epic');
    }

    if (appDataDir) {
      // Windows %APPDATA%/heroic paths
      addCandidate(path.join(appDataDir, 'heroic', 'installed.json'), 'epic');
      addCandidate(path.join(appDataDir, 'heroic', 'gog_store', 'installed.json'), 'gog');
      addCandidate(path.join(appDataDir, 'heroic', 'legendaryConfig', 'legendary', 'installed.json'), 'epic');
    }
  }

  if (Array.isArray(opts.files)) {
    for (const f of opts.files) {
      addCandidate(f, /gog/i.test(f) ? 'gog' : 'epic');
    }
  }

  const catalogGames = getAllGames();
  const results = [];
  const seenKeys = new Set();

  for (const { filePath, defaultStore } of candidateFiles) {
    try {
      if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) continue;
      const rawContent = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(rawContent);
      if (!parsed) continue;

      let entries = [];
      if (Array.isArray(parsed)) {
        entries = parsed;
      } else if (Array.isArray(parsed.installed)) {
        entries = parsed.installed;
      } else if (Array.isArray(parsed.games)) {
        entries = parsed.games;
      } else if (typeof parsed === 'object') {
        entries = Object.entries(parsed).map(([key, val]) => {
          if (val && typeof val === 'object') {
            return { _mapKey: key, ...val };
          }
          return null;
        }).filter(Boolean);
      }

      for (const entry of entries) {
        if (!entry || typeof entry !== 'object') continue;
        if (entry.is_dlc === true || entry.isDlc === true) continue;

        const installDir =
          entry.install_path ||
          entry.installPath ||
          entry.path ||
          entry.directory ||
          entry.folder_name ||
          '';

        const rawTitle =
          entry.title ||
          entry.app_title ||
          entry.name ||
          entry.displayName ||
          (installDir ? path.basename(installDir.replace(/[\\/]+$/, '')) : '') ||
          entry.appName ||
          entry.app_name ||
          entry._mapKey ||
          '';

        const name = String(rawTitle).trim();
        if (!name || isNonGameEntry(name)) continue;

        const appId = String(entry.appName || entry.app_name || entry.appId || entry._mapKey || slugify(name));
        const storeHint = String(entry.runner || entry.store || entry.launcher || defaultStore || '').toLowerCase();
        const isGog = storeHint.includes('gog') || /gog_store/i.test(filePath);
        const launcher = isGog ? 'Heroic (GOG)' : 'Heroic (Epic)';

        const dedupeKey = `${launcher}:${normalizeForMatch(name) || appId}`;
        if (seenKeys.has(dedupeKey)) continue;
        seenKeys.add(dedupeKey);

        const sizeOnDiskGB = parseSizeToGB(
          entry.install_size || entry.installSize || entry.size,
          installDir
        );
        const drive = extractDriveLetter(installDir || filePath);
        const matched = matchCatalogGame(name, catalogGames);
        const baseGame = matched ? { ...matched } : buildFallbackGameSpec({ name, appId, launcher, drive, sizeOnDiskGB });

        const isLinuxTarget =
          process.platform === 'linux' ||
          (typeof installDir === 'string' && installDir.startsWith('/'));
        const isNativeLinuxPlatform =
          entry.platform && /^(linux|native)$/i.test(String(entry.platform).trim());

        const runtime = isLinuxTarget && !isNativeLinuxPlatform ? 'Proton' : 'Native';
        const protonVersion =
          runtime === 'Proton'
            ? (entry.wineVersion && entry.wineVersion.name) || entry.protonVersion || 'Proton / Wine (Heroic)'
            : null;
        const linuxCompatNote = isLinuxTarget
          ? runtime === 'Proton'
            ? `Heroic Compatibility (${protonVersion})`
            : 'Native Linux (Heroic)'
          : null;

        results.push(
          attachPlayStatusAndVisuals(
            {
              ...baseGame,
              name,
              title: matched ? matched.title : baseGame.title,
              installed: true,
              installedTitle: name,
              launcher,
              appId,
              installDir: installDir || path.dirname(filePath),
              drive,
              sizeOnDiskGB,
              storageGB: Math.max(1, Math.round(sizeOnDiskGB || baseGame.storageGB || 20)),
              runtime,
              protonVersion,
              linuxCompatNote,
              matchedCatalogId: matched ? matched.id : null
            },
            getRunningProcessNames(opts)
          )
        );
      }
    } catch (e) {
      // ignore unreadable or invalid JSON file
    }
  }

  return results;
}

/**
 * Parses a Lutris game YAML configuration file (`*.yml` / `*.yaml`) without external dependencies.
 */
function parseLutrisYaml(content, filePath = '') {
  if (!content || typeof content !== 'string') return null;

  const lines = content.split(/\r?\n/);
  let currentSection = '';
  const topLevel = {};
  const sections = {};

  for (const rawLine of lines) {
    if (!rawLine || /^\s*#/.test(rawLine)) continue;
    const indentMatch = rawLine.match(/^(\s*)([a-zA-Z0-9_-]+)\s*:\s*(.*)$/);
    if (!indentMatch) continue;

    const indent = indentMatch[1].length;
    const key = indentMatch[2].toLowerCase();
    let value = indentMatch[3].trim();

    // Strip surrounding quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1).trim();
    }

    if (indent === 0) {
      if (value === '') {
        currentSection = key;
        if (!sections[currentSection]) sections[currentSection] = {};
      } else {
        currentSection = '';
        topLevel[key] = value;
      }
    } else if (currentSection) {
      if (!sections[currentSection]) sections[currentSection] = {};
      if (value !== '' && sections[currentSection][key] === undefined) {
        sections[currentSection][key] = value;
      }
    }
  }

  const gameSec = sections.game || {};
  const wineSec = sections.wine || {};
  const systemSec = sections.system || {};

  let installDir =
    topLevel.directory ||
    topLevel.game_path ||
    topLevel.install_path ||
    topLevel.path ||
    gameSec.working_dir ||
    gameSec.directory ||
    gameSec.game_path ||
    gameSec.prefix ||
    systemSec.game_path ||
    '';

  if (!installDir && gameSec.exe) {
    const exePath = gameSec.exe;
    installDir = exePath.startsWith('/')
      ? path.posix.dirname(exePath)
      : path.dirname(exePath);
  }

  let name = topLevel.name || topLevel.title || topLevel.game_name || gameSec.name || '';
  const slug = topLevel.slug || '';

  if (!name && slug) {
    name = slug
      .replace(/-\d{8,}$/, '')
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  if (!name && filePath) {
    const base = path.basename(filePath, path.extname(filePath));
    name = base
      .replace(/-\d{8,}$/, '')
      .replace(/[-_]+/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  const runner = (topLevel.runner || gameSec.runner || 'wine').toLowerCase();
  const wineVersion = wineSec.version || topLevel.wine_version || null;

  return {
    name: name.trim(),
    slug: slug || slugify(name),
    runner,
    installDir: installDir.trim(),
    exe: gameSec.exe || topLevel.exe || null,
    wineVersion
  };
}

/**
 * Scans Lutris game configurations across Linux paths:
 * - ~/.local/share/lutris/games/*.yml
 * - ~/.config/lutris/games/*.yml
 * - Flatpak: ~/.var/app/net.lutris.Lutris/data/lutris/games/*.yml
 */
function scanLutrisGames(options = {}) {
  const opts = typeof options === 'string' ? { customPath: options } : options || {};
  const homeDir = opts.homeDir || os.homedir();

  const candidateDirs = [];
  const yamlFiles = [];

  const addDir = (d) => {
    if (d) candidateDirs.push(d);
  };

  if (opts.customPath) {
    try {
      if (fs.existsSync(opts.customPath) && fs.statSync(opts.customPath).isFile()) {
        yamlFiles.push(opts.customPath);
      } else {
        const base = opts.customPath;
        addDir(base);
        addDir(path.join(base, 'games'));
        addDir(path.join(base, '.local', 'share', 'lutris', 'games'));
        addDir(path.join(base, '.config', 'lutris', 'games'));
        addDir(path.join(base, '.var', 'app', 'net.lutris.Lutris', 'data', 'lutris', 'games'));
        addDir(path.join(base, '.var', 'app', 'net.lutris.Lutris', 'config', 'lutris', 'games'));
      }
    } catch (e) {
      // ignore
    }
  } else if (homeDir) {
    addDir(path.join(homeDir, '.local', 'share', 'lutris', 'games'));
    addDir(path.join(homeDir, '.config', 'lutris', 'games'));
    addDir(path.join(homeDir, '.var', 'app', 'net.lutris.Lutris', 'data', 'lutris', 'games'));
    addDir(path.join(homeDir, '.var', 'app', 'net.lutris.Lutris', 'config', 'lutris', 'games'));
  }

  if (Array.isArray(opts.dirs)) {
    for (const d of opts.dirs) addDir(d);
  }

  for (const dir of candidateDirs) {
    try {
      if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) continue;
      const entries = fs.readdirSync(dir);
      for (const file of entries) {
        if (/\.(yml|yaml)$/i.test(file)) {
          yamlFiles.push(path.join(dir, file));
        }
      }
    } catch (e) {
      // ignore unreadable directory
    }
  }

  const catalogGames = getAllGames();
  const results = [];
  const seenNames = new Set();

  for (const ymlPath of yamlFiles) {
    try {
      const content = fs.readFileSync(ymlPath, 'utf8');
      const parsed = parseLutrisYaml(content, ymlPath);
      if (!parsed || !parsed.name || isNonGameEntry(parsed.name)) continue;

      const normKey = normalizeForMatch(parsed.name) || parsed.name.toLowerCase();
      if (seenNames.has(normKey)) continue;
      seenNames.add(normKey);

      const installDir = parsed.installDir || path.dirname(ymlPath);
      const drive = extractDriveLetter(installDir);
      const sizeOnDiskGB =
        installDir && fs.existsSync(installDir) ? estimateDirectorySizeGB(installDir) : 25;

      const matched = matchCatalogGame(parsed.name, catalogGames);
      const baseGame = matched
        ? { ...matched }
        : buildFallbackGameSpec({
            name: parsed.name,
            appId: parsed.slug,
            launcher: 'Lutris',
            drive,
            sizeOnDiskGB
          });

      const isWineRunner = /^(wine|proton|steam)$/i.test(parsed.runner);
      const runtime = isWineRunner ? 'Proton' : 'Native';
      const protonVersion = isWineRunner
        ? parsed.wineVersion || 'Lutris Wine / Proton'
        : null;
      const linuxCompatNote = isWineRunner
        ? `Lutris Runner: ${parsed.runner}${parsed.wineVersion ? ` (${parsed.wineVersion})` : ''}`
        : `Lutris Runner: ${parsed.runner}`;

      results.push(
        attachPlayStatusAndVisuals(
          {
            ...baseGame,
            name: parsed.name,
            title: matched ? matched.title : baseGame.title,
            installed: true,
            installedTitle: parsed.name,
            launcher: 'Lutris',
            runner: parsed.runner,
            appId: parsed.slug || slugify(parsed.name),
            installDir,
            drive,
            sizeOnDiskGB,
            storageGB: Math.max(1, Math.round(sizeOnDiskGB || baseGame.storageGB || 25)),
            runtime,
            protonVersion,
            linuxCompatNote,
            matchedCatalogId: matched ? matched.id : null
          },
          getRunningProcessNames(opts)
        )
      );
    } catch (e) {
      // ignore malformed YAML file
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
 * Checks if a folder looks like an actual game installation (contains .exe, Linux game binaries, or common game subdirs)
 */
function looksLikeGameFolder(dirPath) {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    if (entries.length === 0) return false;
    for (const entry of entries) {
      if (entry.isFile() && /\.(exe|x86_64|appimage)$/i.test(entry.name)) {
        if (!/unins|setup|crash|redist|unitycrash/i.test(entry.name)) {
          return true;
        }
      }
      if (
        entry.isDirectory() &&
        /^(binaries|engine|content|data|gamedata|game|shipping|x64|win64|linux64)$/i.test(entry.name)
      ) {
        return true;
      }
    }
    // Check 1 level deeper for .exe or .x86_64
    for (const entry of entries) {
      if (entry.isDirectory()) {
        try {
          const sub = fs.readdirSync(path.join(dirPath, entry.name));
          if (sub.some((f) => /\.(exe|x86_64)$/i.test(f))) return true;
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
 * Scans standalone game folders (`Games`, `Program Files/Games`, `XboxGames`, `Riot Games`, `~/Games`) across drives/mounts
 */
function scanStandaloneFolders(existingInstallDirs = new Set()) {
  const results = [];

  const skipFolderNames = new Set([
    'steam',
    'steamlibrary',
    'steamapps',
    'common',
    'heroic',
    'lutris',
    'riot client',
    'directx',
    'redist'
  ]);

  const scanRootCandidates = [];

  if (process.platform === 'win32') {
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
    for (const drive of DRIVES_TO_SCAN) {
      for (const { rel, launcher } of standaloneRoots) {
        scanRootCandidates.push({ rootDir: `${drive}\\${rel}`, launcher });
      }
    }
  } else if (process.platform === 'linux') {
    const homeDir = os.homedir();
    if (homeDir) {
      scanRootCandidates.push({ rootDir: path.join(homeDir, 'Games'), launcher: 'Standalone' });
      scanRootCandidates.push({ rootDir: path.join(homeDir, 'GOG Games'), launcher: 'GOG' });
    }
    scanRootCandidates.push({ rootDir: '/opt/games', launcher: 'Standalone' });
  }

  for (const { rootDir, launcher } of scanRootCandidates) {
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
        const drive = extractDriveLetter(fullInstallDir);

        results.push({
          name: folderName,
          appId: null,
          launcher,
          installDir: fullInstallDir,
          drive,
          sizeOnDiskGB,
          runtime: 'Native',
          protonVersion: null,
          linuxCompatNote: process.platform === 'linux' ? 'Standalone Linux Folder' : null
        });
      }
    } catch (e) {
      // ignore missing or restricted folder
    }
  }

  return results;
}

/**
 * Fuzzy matches an installed game title against the catalog from games-db.js
 */
function matchCatalogGame(installedName, catalogGames = getAllGames()) {
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

  const isCompetitive =
    /valorant|league of legends|dota|counter-strike|cs2|overwatch|apex|rocket league|rainbow six|pubg|fortnite/i.test(
      title
    );
  const isHeavyAAA =
    sizeGB >= 60 ||
    /unreal|cyber|witcher|red dead|call of duty|warzone|assassin|far cry|starfield|battlefield|halo|forza|horizon|spider-man|god of war|last of us|resident evil|final fantasy|baldur|elden|alan wake|stalker|wukong/i.test(
      title
    );
  const isMidTier = !isHeavyAAA && (sizeGB >= 20 || isCompetitive);

  let genre = 'Action / PC Game';
  if (
    /valorant|counter-strike|overwatch|apex|call of duty|battlefield|halo|doom|quake|rainbow six|pubg|shooter/i.test(
      title
    )
  ) {
    genre = 'Shooter';
  } else if (/forza|assetto|dirt|f1|need for speed|crew|gran turismo|racing/i.test(title)) {
    genre = 'Racing';
  } else if (
    /witcher|elder scrolls|skyrim|fallout|baldur|divinity|diablo|path of exile|elden|souls|persona|final fantasy|dragon age|mass effect|rpg/i.test(
      title
    )
  ) {
    genre = 'RPG';
  } else if (
    /civilization|total war|age of empires|starcraft|stellaris|crusader kings|hearts of iron|factorio|rimworld|cities/i.test(
      title
    )
  ) {
    genre = 'Strategy / Simulation';
  } else if (
    /hollow knight|celeste|hades|dead cells|stardew|terraria|binding of isaac|slay the spire|undertale|balatro/i.test(
      title
    )
  ) {
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
 * Scans drives/mounts for Steam, Epic Games, Heroic (Epic + GOG), Lutris, and Standalone games,
 * matching against games-db or generating an enriched fallback spec object for every found game.
 */
function scanInstalledGames(options = {}) {
  const catalogGames = getAllGames();
  const runningProcs = getRunningProcessNames(options);

  const steamGames = scanSteamGames(options);
  const epicGames = scanEpicGames(options);
  const heroicGames = scanHeroicGames(options);
  const lutrisGames =
    process.platform === 'linux' || options.homeDir || options.customPath || options.includeLinux
      ? scanLutrisGames(options)
      : [];

  const knownInstallDirs = new Set();
  for (const g of [...steamGames, ...epicGames, ...heroicGames, ...lutrisGames]) {
    if (g.installDir) knownInstallDirs.add(path.normalize(g.installDir).toLowerCase());
  }

  const standaloneGames = options.skipStandalone ? [] : scanStandaloneFolders(knownInstallDirs);
  const allRaw = [...steamGames, ...epicGames, ...heroicGames, ...lutrisGames, ...standaloneGames];

  // Deduplicate by normalized name
  const seenNames = new Set();
  const uniqueInstalled = [];

  for (const raw of allRaw) {
    const key = normalizeForMatch(raw.name) || raw.name.toLowerCase();
    if (seenNames.has(key)) continue;
    seenNames.add(key);

    const matched = matchCatalogGame(raw.name, catalogGames);
    const baseGame = matched ? { ...matched } : buildFallbackGameSpec(raw);

    uniqueInstalled.push(
      attachPlayStatusAndVisuals(
        {
          ...baseGame,
          name: raw.name,
          installed: true,
          installedTitle: raw.name,
          launcher: raw.launcher,
          appId: raw.appId,
          steamAppId: raw.steamAppId || baseGame.steamAppId || null,
          installDir: raw.installDir,
          drive: raw.drive || extractDriveLetter(raw.installDir),
          sizeOnDiskGB: raw.sizeOnDiskGB,
          storageGB: Math.max(1, Math.round(raw.sizeOnDiskGB || baseGame.storageGB || 20)),
          runtime: raw.runtime || 'Native',
          protonVersion: raw.protonVersion || null,
          linuxCompatNote: raw.linuxCompatNote || null,
          matchedCatalogId: matched ? matched.id : null,
          lastPlayedTimestamp: raw.lastPlayedTimestamp || 0,
          hasAcfLastPlayed: Boolean(raw.hasAcfLastPlayed)
        },
        runningProcs
      )
    );
  }

  const statusRank = { PLAYING_NOW: 3, RECENTLY_PLAYED: 2, INSTALLED: 1 };
  uniqueInstalled.sort((a, b) => {
    const rankDiff = (statusRank[b.playStatus] || 0) - (statusRank[a.playStatus] || 0);
    if (rankDiff !== 0) return rankDiff;
    if ((b.lastPlayedTimestamp || 0) !== (a.lastPlayedTimestamp || 0)) {
      return (b.lastPlayedTimestamp || 0) - (a.lastPlayedTimestamp || 0);
    }
    return (b.sizeOnDiskGB || 0) - (a.sizeOnDiskGB || 0);
  });
  return uniqueInstalled;
}

module.exports = {
  scanInstalledGames,
  parseVdf,
  parseAcfFile,
  parseLibraryFoldersVdf,
  matchCatalogGame,
  buildFallbackGameSpec,
  scanSteamGames,
  scanEpicGames,
  scanStandaloneFolders,
  scanHeroicGames,
  scanLutrisGames,
  parseLutrisYaml,
  detectSteamProtonInfo,
  getLinuxSteamLibraryFolders,
  extractDriveLetter,
  getRunningProcessNames,
  attachPlayStatusAndVisuals
};
