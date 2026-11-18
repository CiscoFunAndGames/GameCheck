const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const { detectSystemSpecs } = require('./hardware');
const { getAllGames, getGameById, getAllGenres, enrichGameScores } = require('./games-db');
const { analyzeGameCompatibility } = require('./analyzer');
const { scanInstalledGames } = require('./installed-scanner');
const { parseRawRequirementsText, filterAndSortGames } = require('./steam-lookup');
const { getPerSettingImpact, exportGameConfigFiles } = require('./config-exporter');
const {
  resolveSpecsWithOverrides,
  getPatchStatus,
  applyPatch,
  createPatch,
  rollbackPatch,
  getFirewallStatus,
  requestFirewallAccess,
  revokeFirewallAccess,
  searchComponentDeals
} = require('./ipc-handlers');

const PORT = process.env.PORT || 3040;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

let cachedSpecs = null;
let cachedInstalled = null;

function getSpecs(forceRefresh = false) {
  if (!cachedSpecs || forceRefresh) {
    cachedSpecs = detectSystemSpecs();
  }
  return cachedSpecs;
}

function getInstalled(forceRefresh = false) {
  if (!cachedInstalled || forceRefresh) {
    cachedInstalled = scanInstalledGames();
  }
  return cachedInstalled;
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload, null, 2));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
      if (body.length > 1e6) req.destroy();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml'
};

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  // API: Get detected PC specs
  if (pathname === '/api/specs' && req.method === 'GET') {
    const refresh = parsedUrl.searchParams.get('refresh') === '1';
    if (refresh) getInstalled(true);
    return sendJson(res, 200, getSpecs(refresh));
  }

  // API: Get all catalog games + compatibility summary with current specs
  if (pathname === '/api/games' && req.method === 'GET') {
    const specs = getSpecs();
    const installedList = getInstalled();
    const optimizationMode = parsedUrl.searchParams.get('mode') || 'optimal';
    const installedByCatalogId = new Map();
    for (const inst of installedList) {
      if (inst.matchedCatalogId) {
        installedByCatalogId.set(inst.matchedCatalogId, inst);
      }
    }

    const rawGames = getAllGames().map((game) => {
      const inst = installedByCatalogId.get(game.id);
      return {
        ...game,
        steamAppId: (inst && inst.steamAppId) || game.steamAppId || null,
        bannerUrl: (inst && inst.bannerUrl) || game.bannerUrl,
        logoUrl: (inst && inst.logoUrl) || game.logoUrl,
        fallbackBannerSvg: (inst && inst.fallbackBannerSvg) || game.fallbackBannerSvg,
        fallbackLogoSvg: (inst && inst.fallbackLogoSvg) || game.fallbackLogoSvg,
        monogram: (inst && inst.monogram) || game.monogram,
        installed: Boolean(inst),
        launcher: inst ? inst.launcher : null,
        drive: inst ? inst.drive : null,
        sizeOnDiskGB: inst ? inst.sizeOnDiskGB : null,
        installDir: inst ? inst.installDir : null,
        runtime: inst && inst.runtime ? inst.runtime : null,
        protonVersion: inst && inst.protonVersion ? inst.protonVersion : null,
        linuxCompatNote: inst && inst.linuxCompatNote ? inst.linuxCompatNote : null,
        isRunning: Boolean(inst && inst.isRunning),
        wasRecentlyPlayed: Boolean(inst && inst.wasRecentlyPlayed),
        playStatus: inst ? inst.playStatus || 'INSTALLED' : 'CATALOG',
        playStatusLabel: inst ? inst.playStatusLabel || '💾 Installed' : '📚 Catalog',
        lastPlayedTimestamp: inst ? inst.lastPlayedTimestamp || 0 : 0,
        analysis: analyzeGameCompatibility(specs, game, {
          optimizationMode,
          targetDisplay: specs.display
        })
      };
    });

    const filteredGames = filterAndSortGames(rawGames, {
      query: parsedUrl.searchParams.get('q') || '',
      genre: parsedUrl.searchParams.get('genre') || '',
      tier: parsedUrl.searchParams.get('tier') || '',
      sortBy: parsedUrl.searchParams.get('sort') || '',
      installedOnly: parsedUrl.searchParams.get('installed') === '1'
    });

    return sendJson(res, 200, {
      specs,
      genres: getAllGenres(),
      installedCount: installedList.length,
      games: filteredGames
    });
  }

  // API: Get locally installed PC games + their compatibility analysis
  if (pathname === '/api/installed' && req.method === 'GET') {
    const refresh = parsedUrl.searchParams.get('refresh') === '1';
    const optimizationMode = parsedUrl.searchParams.get('mode') || 'optimal';
    const specs = getSpecs(refresh);
    const installedRaw = getInstalled(refresh);
    const games = installedRaw.map((game) => ({
      ...game,
      analysis: analyzeGameCompatibility(specs, game, {
        optimizationMode,
        targetDisplay: specs.display
      })
    }));

    return sendJson(res, 200, {
      specs,
      count: games.length,
      installedGames: games,
      games
    });
  }

  // API: Parse pasted raw Steam / PCGW requirements text and analyze compatibility
  if (pathname === '/api/parse-reqs' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const rawText = body.text || body.rawText || body.requirementsText || '';
      if (!String(rawText).trim()) {
        return sendJson(res, 400, { error: 'Please paste system requirements text to parse.' });
      }

      const optimizationMode = body.optimizationMode || 'optimal';
      const customSpecs = resolveSpecsWithOverrides(getSpecs(), body.customHardware, body.targetDisplay);
      const analysisOptions = {
        optimizationMode,
        targetDisplay: customSpecs.display
      };

      const game = parseRawRequirementsText(rawText, {
        title: body.title || 'Custom Steam Game',
        genre: body.genre || 'Custom / Steam Spec'
      });

      const analysis = analyzeGameCompatibility(customSpecs, game, analysisOptions);
      const perSettingImpact = getPerSettingImpact(customSpecs, game, analysis, analysisOptions);
      const exportedConfigs = exportGameConfigFiles(customSpecs, game, analysis, analysisOptions);
      analysis.perSettingImpact = perSettingImpact;
      analysis.exportedConfigs = exportedConfigs;

      return sendJson(res, 200, {
        specs: customSpecs,
        game,
        analysis,
        perSettingImpact,
        exportedConfigs,
        optimizationMode
      });
    } catch (err) {
      return sendJson(res, 400, { error: err.message });
    }
  }

  // API: Analyze a specific game or custom hardware override ("What-If Upgrade Simulator" or Custom Game)
  if (pathname === '/api/analyze' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const optimizationMode = body.optimizationMode || 'optimal';
      const customSpecs = resolveSpecsWithOverrides(getSpecs(), body.customHardware, body.targetDisplay);
      const analysisOptions = {
        optimizationMode,
        targetDisplay: customSpecs.display
      };

      let game = null;
      if (body.rawRequirementsText) {
        game = parseRawRequirementsText(body.rawRequirementsText, {
          title: body.title || (body.customGame && body.customGame.title) || 'Custom Steam Game',
          genre: body.genre || (body.customGame && body.customGame.genre) || 'Custom / Steam Spec'
        });
      } else if (body.customGame) {
        if (body.customGame.minimum && body.customGame.recommended) {
          game = enrichGameScores(body.customGame);
        } else {
          game = enrichGameScores({
            id: body.customGame.id || 'custom-game',
            title: body.customGame.title || 'Custom Game',
            genre: body.customGame.genre || 'Custom',
            releaseYear: body.customGame.releaseYear || 2025,
            engine: body.customGame.engine || 'Custom',
            supportsRT: Boolean(body.customGame.supportsRT),
            supportsUpscaling: body.customGame.supportsUpscaling || ['DLSS', 'FSR'],
            storageGB: Number(body.customGame.storageGB) || 60,
            ssdRequired: body.customGame.ssdRequired !== undefined ? Boolean(body.customGame.ssdRequired) : true,
            minimum: {
              cpu: body.customGame.minCpu || 'Intel Core i5-8400',
              gpu: body.customGame.minGpu || 'GTX 1060',
              ramGB: Number(body.customGame.minRamGB) || 8,
              vramGB: Number(body.customGame.minVramGB) || 4
            },
            recommended: {
              cpu: body.customGame.recCpu || 'AMD Ryzen 5 5600',
              gpu: body.customGame.recGpu || 'RTX 3060',
              ramGB: Number(body.customGame.recRamGB) || 16,
              vramGB: Number(body.customGame.recVramGB) || 8
            },
            tuningTips: body.customGame.tuningTips || [
              'Custom game analyzed using heuristic CPU/GPU benchmark scoring.',
              'Adjust Shadow Quality and Volumetric effects first if you need a quick +15-20% FPS boost.'
            ]
          });
        }
      } else {
        const targetId = body.gameId || 'cyberpunk-2077';
        const installedList = getInstalled();
        const instMatch = installedList.find((g) => g.id === targetId || g.matchedCatalogId === targetId) || null;
        game = getGameById(targetId);
        if (game && instMatch) {
          game = {
            ...game,
            installed: true,
            launcher: instMatch.launcher,
            drive: instMatch.drive,
            sizeOnDiskGB: instMatch.sizeOnDiskGB,
            installDir: instMatch.installDir,
            runtime: instMatch.runtime || null,
            protonVersion: instMatch.protonVersion || null,
            linuxCompatNote: instMatch.linuxCompatNote || null,
            isRunning: Boolean(instMatch.isRunning),
            wasRecentlyPlayed: Boolean(instMatch.wasRecentlyPlayed),
            playStatus: instMatch.playStatus || 'INSTALLED',
            playStatusLabel: instMatch.playStatusLabel || '💾 Installed',
            lastPlayedTimestamp: instMatch.lastPlayedTimestamp || 0
          };
        } else if (!game) {
          game = instMatch;
        }
      }

      if (!game) {
        return sendJson(res, 404, { error: 'Game not found' });
      }

      const analysis = analyzeGameCompatibility(customSpecs, game, analysisOptions);
      const perSettingImpact = getPerSettingImpact(customSpecs, game, analysis, analysisOptions);
      const exportedConfigs = exportGameConfigFiles(customSpecs, game, analysis, analysisOptions);
      analysis.perSettingImpact = perSettingImpact;
      analysis.exportedConfigs = exportedConfigs;

      return sendJson(res, 200, {
        specs: customSpecs,
        game,
        analysis,
        perSettingImpact,
        exportedConfigs,
        optimizationMode
      });
    } catch (err) {
      return sendJson(res, 400, { error: err.message });
    }
  }

  // API: Patch Status / Apply / Create / Rollback
  if (pathname === '/api/patch-status' && req.method === 'GET') {
    return sendJson(res, 200, getPatchStatus());
  }
  if (pathname === '/api/apply-patch' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const result = await applyPatch(body);
      return sendJson(res, 200, result);
    } catch (err) {
      return sendJson(res, 400, { error: err.message });
    }
  }
  if (pathname === '/api/create-patch' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const result = await createPatch(body);
      return sendJson(res, 200, result);
    } catch (err) {
      return sendJson(res, 400, { error: err.message });
    }
  }
  if (pathname === '/api/rollback-patch' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const result = await rollbackPatch(body);
      return sendJson(res, 200, result);
    } catch (err) {
      return sendJson(res, 400, { error: err.message });
    }
  }

  // API: Firewall Status & Outbound Network Permission + Verified Component Price & Deals Finder
  if (pathname === '/api/firewall-status' && req.method === 'GET') {
    return sendJson(res, 200, getFirewallStatus());
  }
  if (pathname === '/api/firewall-access' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      if (body && body.revoke === true) {
        return sendJson(res, 200, revokeFirewallAccess());
      }
      const result = await requestFirewallAccess({ ...body, autoApprove: true });
      return sendJson(res, 200, result);
    } catch (err) {
      return sendJson(res, 400, { error: err.message });
    }
  }
  if (pathname === '/api/deals' && (req.method === 'POST' || req.method === 'GET')) {
    try {
      const body = req.method === 'POST'
        ? await parseBody(req)
        : {
            query: parsedUrl.searchParams.get('q') || parsedUrl.searchParams.get('query') || 'AMD Radeon RX 7600',
            country: parsedUrl.searchParams.get('country') || 'AR',
            strictReputation: parsedUrl.searchParams.get('strict') !== '0'
          };
      const result = await searchComponentDeals(body);
      return sendJson(res, 200, result);
    } catch (err) {
      return sendJson(res, 400, { error: err.message });
    }
  }

  // Static file server
  const filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404);
      return res.end('Not found');
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'text/plain' });
    res.end(content);
  });
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`PC Game Checker running at http://localhost:${PORT}`);
  });
}

module.exports = { server, resolveSpecsWithOverrides };
