const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const { detectSystemSpecs, scoreCPU, scoreGPU } = require('./hardware');
const { getAllGames, getGameById, getAllGenres, enrichGameScores } = require('./games-db');
const { analyzeGameCompatibility } = require('./analyzer');
const { scanInstalledGames } = require('./installed-scanner');
const { parseRawRequirementsText, filterAndSortGames } = require('./steam-lookup');
const { getPerSettingImpact, exportGameConfigFiles } = require('./config-exporter');

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

function resolveSpecsWithOverrides(baseSpecs, customHardware) {
  const customSpecs = JSON.parse(JSON.stringify(baseSpecs));
  if (!customHardware) return customSpecs;

  if (customHardware.cpuName) {
    const cpuEval = scoreCPU(customHardware.cpuName, customHardware.cpuThreads || customSpecs.cpu.threads);
    customSpecs.cpu.name = customHardware.cpuName;
    customSpecs.cpu.score = cpuEval.score;
    customSpecs.cpu.cores = cpuEval.estimatedCores;
  }
  if (customHardware.gpuName) {
    const vram = Number(customHardware.vramGB) || customSpecs.gpu.vramGB;
    const gpuEval = scoreGPU(customHardware.gpuName, vram);
    customSpecs.gpu.name = customHardware.gpuName;
    customSpecs.gpu.vramGB = gpuEval.vramGB;
    customSpecs.gpu.score = gpuEval.score;
    customSpecs.gpu.vendor = gpuEval.vendor;
    customSpecs.gpu.rtCapable = gpuEval.rtCapable;
    customSpecs.gpu.upscaler = gpuEval.upscaler;
  }
  if (customHardware.ramGB) {
    customSpecs.ram.totalGB = Number(customHardware.ramGB);
  }
  return customSpecs;
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
        installed: Boolean(inst),
        launcher: inst ? inst.launcher : null,
        drive: inst ? inst.drive : null,
        sizeOnDiskGB: inst ? inst.sizeOnDiskGB : null,
        installDir: inst ? inst.installDir : null,
        analysis: analyzeGameCompatibility(specs, game)
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
    const specs = getSpecs(refresh);
    const installedRaw = getInstalled(refresh);
    const games = installedRaw.map((game) => ({
      ...game,
      analysis: analyzeGameCompatibility(specs, game)
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

      const customSpecs = resolveSpecsWithOverrides(getSpecs(), body.customHardware);
      const game = parseRawRequirementsText(rawText, {
        title: body.title || 'Custom Steam Game',
        genre: body.genre || 'Custom / Steam Spec'
      });

      const analysis = analyzeGameCompatibility(customSpecs, game);
      const perSettingImpact = getPerSettingImpact(customSpecs, game, analysis);
      const exportedConfigs = exportGameConfigFiles(customSpecs, game, analysis);
      analysis.perSettingImpact = perSettingImpact;
      analysis.exportedConfigs = exportedConfigs;

      return sendJson(res, 200, {
        specs: customSpecs,
        game,
        analysis,
        perSettingImpact,
        exportedConfigs
      });
    } catch (err) {
      return sendJson(res, 400, { error: err.message });
    }
  }

  // API: Analyze a specific game or custom hardware override ("What-If Upgrade Simulator" or Custom Game)
  if (pathname === '/api/analyze' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const customSpecs = resolveSpecsWithOverrides(getSpecs(), body.customHardware);

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
        game = getGameById(targetId);
        if (!game) {
          const installedList = getInstalled();
          game = installedList.find((g) => g.id === targetId || g.matchedCatalogId === targetId) || null;
        }
      }

      if (!game) {
        return sendJson(res, 404, { error: 'Game not found' });
      }

      const analysis = analyzeGameCompatibility(customSpecs, game);
      const perSettingImpact = getPerSettingImpact(customSpecs, game, analysis);
      const exportedConfigs = exportGameConfigFiles(customSpecs, game, analysis);
      analysis.perSettingImpact = perSettingImpact;
      analysis.exportedConfigs = exportedConfigs;

      return sendJson(res, 200, {
        specs: customSpecs,
        game,
        analysis,
        perSettingImpact,
        exportedConfigs
      });
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

server.listen(PORT, () => {
  console.log(`PC Game Checker running at http://localhost:${PORT}`);
});
