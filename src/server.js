const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const { detectSystemSpecs, scoreCPU, scoreGPU } = require('./hardware');
const { getAllGames, getGameById, enrichGameScores } = require('./games-db');
const { analyzeGameCompatibility } = require('./analyzer');

const PORT = process.env.PORT || 3040;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

let cachedSpecs = null;
function getSpecs(forceRefresh = false) {
  if (!cachedSpecs || forceRefresh) {
    cachedSpecs = detectSystemSpecs();
  }
  return cachedSpecs;
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
    return sendJson(res, 200, getSpecs(refresh));
  }

  // API: Get all games + compatibility summary with current specs
  if (pathname === '/api/games' && req.method === 'GET') {
    const specs = getSpecs();
    const games = getAllGames().map((game) => ({
      ...game,
      analysis: analyzeGameCompatibility(specs, game)
    }));
    return sendJson(res, 200, { specs, games });
  }

  // API: Analyze a specific game or custom hardware override ("What-If Upgrade Simulator" or Custom Game)
  if (pathname === '/api/analyze' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const baseSpecs = getSpecs();

      // Apply optional hardware overrides if the user is testing a CPU/GPU/RAM upgrade
      const customSpecs = JSON.parse(JSON.stringify(baseSpecs));
      if (body.customHardware) {
        const ch = body.customHardware;
        if (ch.cpuName) {
          const cpuEval = scoreCPU(ch.cpuName, ch.cpuThreads || customSpecs.cpu.threads);
          customSpecs.cpu.name = ch.cpuName;
          customSpecs.cpu.score = cpuEval.score;
          customSpecs.cpu.cores = cpuEval.estimatedCores;
        }
        if (ch.gpuName) {
          const vram = Number(ch.vramGB) || customSpecs.gpu.vramGB;
          const gpuEval = scoreGPU(ch.gpuName, vram);
          customSpecs.gpu.name = ch.gpuName;
          customSpecs.gpu.vramGB = gpuEval.vramGB;
          customSpecs.gpu.score = gpuEval.score;
          customSpecs.gpu.vendor = gpuEval.vendor;
          customSpecs.gpu.rtCapable = gpuEval.rtCapable;
          customSpecs.gpu.upscaler = gpuEval.upscaler;
        }
        if (ch.ramGB) {
          customSpecs.ram.totalGB = Number(ch.ramGB);
        }
      }

      let game = null;
      if (body.customGame) {
        game = enrichGameScores({
          id: 'custom-game',
          title: body.customGame.title || 'Custom Game',
          genre: body.customGame.genre || 'Custom',
          releaseYear: 2025,
          engine: 'Custom',
          supportsRT: Boolean(body.customGame.supportsRT),
          supportsUpscaling: ['DLSS', 'FSR'],
          storageGB: Number(body.customGame.storageGB) || 60,
          ssdRequired: true,
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
          tuningTips: [
            'Custom game analyzed using heuristic CPU/GPU benchmark scoring.',
            'Adjust Shadow Quality and Volumetric effects first if you need a quick +15-20% FPS boost.'
          ]
        });
      } else {
        game = getGameById(body.gameId || 'cyberpunk-2077');
      }

      if (!game) {
        return sendJson(res, 404, { error: 'Game not found' });
      }

      const analysis = analyzeGameCompatibility(customSpecs, game);
      return sendJson(res, 200, { specs: customSpecs, game, analysis });
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
