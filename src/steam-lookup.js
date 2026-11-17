const { enrichGameScores } = require('./games-db');
const { scoreCPU, scoreGPU } = require('./hardware');

/**
 * Extracts VRAM in GB from a GPU string or dedicated VRAM line.
 */
function extractVramFromText(gpuLine = '', sectionText = '') {
  // Check explicit VRAM line first: e.g. "VRAM: 8 GB" or "Video Memory: 6144 MB"
  const explicitVram = sectionText.match(/(?:vram|video\s*memory|dedicated\s*video\s*ram)\s*[:=-]?\s*(\d+(?:\.\d+)?)\s*(gb|mb)/i);
  if (explicitVram) {
    const val = parseFloat(explicitVram[1]);
    return explicitVram[2].toLowerCase() === 'mb' ? Math.max(1, Math.round(val / 1024)) : Math.round(val);
  }

  // Check inside the GPU string: e.g. "GTX 1060 6GB" or "RTX 3070 (8 GB)"
  const inlineGb = gpuLine.match(/(\d+)\s*gb\b/i);
  if (inlineGb) {
    return parseInt(inlineGb[1], 10);
  }
  const inlineMb = gpuLine.match(/(\d{4,5})\s*mb\b/i);
  if (inlineMb) {
    return Math.max(1, Math.round(parseInt(inlineMb[1], 10) / 1024));
  }

  // Fallback to hardware benchmark table default VRAM for that GPU
  const gpuEval = scoreGPU(gpuLine, null);
  return gpuEval.vramGB || 6;
}

/**
 * Extracts RAM in GB from a section of requirements text.
 */
function extractRamGB(sectionText = '', fallback = 16) {
  const ramLine = sectionText.match(/(?:memory|ram|memoria|system\s*ram)\s*[:=-]?\s*(\d+(?:\.\d+)?)\s*(gb|mb)/i)
    || sectionText.match(/\b(\d+)\s*gb\s*ram\b/i);
  if (ramLine) {
    const val = parseFloat(ramLine[1]);
    const unit = (ramLine[2] || 'gb').toLowerCase();
    return unit === 'mb' ? Math.max(2, Math.round(val / 1024)) : Math.round(val);
  }
  return fallback;
}

/**
 * Extracts Storage in GB from full requirements text.
 */
function extractStorageGB(fullText = '', fallback = 70) {
  const storageMatch = fullText.match(/(?:storage|hard\s*drive|disk\s*space|available\s*space|almacenamiento|hd\s*space)\s*[:=-]?\s*(\d+(?:\.\d+)?)\s*(tb|gb|mb)/i)
    || fullText.match(/\b(\d+(?:\.\d+)?)\s*(tb|gb)\s*(?:available\s*space|free\s*space|ssd|hdd|storage)/i);
  if (storageMatch) {
    const val = parseFloat(storageMatch[1]);
    const unit = storageMatch[2].toLowerCase();
    if (unit === 'tb') return Math.round(val * 1024);
    if (unit === 'mb') return Math.max(1, Math.round(val / 1024));
    return Math.round(val);
  }
  return fallback;
}

/**
 * Extracts CPU and GPU requirement strings from a section block.
 */
function extractCpuAndGpuFromBlock(blockText = '') {
  const lines = blockText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  let cpu = '';
  let gpu = '';

  for (const line of lines) {
    if (!cpu && /^(?:processor|cpu|procesador)\s*[:=-]\s*(.+)/i.test(line)) {
      cpu = line.replace(/^(?:processor|cpu|procesador)\s*[:=-]\s*/i, '').trim();
      continue;
    }
    if (!gpu && /^(?:graphics|video\s*card|gpu|tarjeta\s*gr[aá]fica|video)\s*[:=-]\s*(.+)/i.test(line)) {
      gpu = line.replace(/^(?:graphics|video\s*card|gpu|tarjeta\s*gr[aá]fica|video)\s*[:=-]\s*/i, '').trim();
      continue;
    }
  }

  // Fallback heuristic scan if user pasted unlabeled lines (e.g. "Intel Core i7-9700 / Ryzen 5 5500")
  if (!cpu) {
    const cpuCandidate = lines.find((l) => /(?:intel\s*core|i[3579]-\d{3,5}|ryzen\s*[3579]|fx-\d{4}|phenom|pentium|athlon)/i.test(l)
      && !/(?:geforce|radeon|gtx|rtx|rx\s*\d{3,4}|arc\s*a\d{3})/i.test(l));
    if (cpuCandidate) {
      cpu = cpuCandidate.replace(/^(?:processor|cpu)\s*[:=-]?\s*/i, '').trim();
    }
  }

  if (!gpu) {
    const gpuCandidate = lines.find((l) => /(?:geforce|radeon|nvidia|amd\s*rx|gtx\s*\d{3,4}|rtx\s*\d{3,4}|rx\s*\d{3,4}|arc\s*[ab]\d{3}|vega\s*\d+)/i.test(l));
    if (gpuCandidate) {
      gpu = gpuCandidate.replace(/^(?:graphics|gpu|video\s*card)\s*[:=-]?\s*/i, '').trim();
    }
  }

  return { cpu, gpu };
}

/**
 * Parses pasted Steam / PCGamingWiki system requirements text into a structured,
 * benchmark-scored game object ready for analyzeGameCompatibility().
 */
function parseRawRequirementsText(text = '', titleOrOptions = 'Custom Steam Game') {
  const raw = String(text || '').trim();
  const resolvedTitle = typeof titleOrOptions === 'object' && titleOrOptions !== null
    ? (titleOrOptions.title || 'Custom Steam Game')
    : (titleOrOptions || 'Custom Steam Game');
  const resolvedGenre = typeof titleOrOptions === 'object' && titleOrOptions !== null && titleOrOptions.genre
    ? titleOrOptions.genre
    : 'Custom / Steam Spec';

  // Split into Minimum and Recommended sections if headers exist
  const recSplitRegex = /(?:^|\n)\s*(?:recommended|recomendado|recommended\s*specifications?)\s*:?/i;
  const minHeaderRegex = /(?:^|\n)\s*(?:minimum|m[ií]nimo|minimum\s*specifications?)\s*:?/i;

  let minBlock = raw;
  let recBlock = '';

  const recMatch = raw.match(recSplitRegex);
  if (recMatch && typeof recMatch.index === 'number') {
    minBlock = raw.slice(0, recMatch.index).replace(minHeaderRegex, '').trim();
    recBlock = raw.slice(recMatch.index + recMatch[0].length).trim();
  } else {
    minBlock = raw.replace(minHeaderRegex, '').trim();
  }

  const minExtracted = extractCpuAndGpuFromBlock(minBlock);
  const recExtracted = recBlock ? extractCpuAndGpuFromBlock(recBlock) : { cpu: '', gpu: '' };

  const minCpu = minExtracted.cpu || 'Intel Core i5-8400 or AMD Ryzen 5 1600';
  const minGpu = minExtracted.gpu || 'NVIDIA GeForce GTX 1060 6GB or AMD Radeon RX 580 8GB';
  const minRamGB = extractRamGB(minBlock, 8);
  const minVramGB = extractVramFromText(minGpu, minBlock || raw);

  // If Recommended block wasn't explicitly provided, derive sensible Recommended specs
  let recCpu = recExtracted.cpu;
  let recGpu = recExtracted.gpu;
  if (!recCpu) {
    const minCpuScore = scoreCPU(minCpu).score;
    recCpu = minCpuScore >= 65
      ? minCpu
      : 'Intel Core i7-10700 or AMD Ryzen 5 5600';
  }
  if (!recGpu) {
    const minGpuScore = scoreGPU(minGpu, minVramGB).score;
    recGpu = minGpuScore >= 60
      ? minGpu
      : 'NVIDIA GeForce RTX 3060 or AMD Radeon RX 6600 XT';
  }

  const recRamGB = recBlock
    ? extractRamGB(recBlock, Math.max(16, minRamGB))
    : Math.max(16, minRamGB);
  const recVramGB = recBlock
    ? extractVramFromText(recGpu, recBlock)
    : Math.max(8, minVramGB);

  const storageGB = extractStorageGB(raw, 70);
  const ssdRequired = /ssd|nvme|solid\s*state/i.test(raw) || storageGB >= 70;
  const supportsRT = /ray\s*tracing|path\s*tracing|\brtx\b|\bdxr\b/i.test(raw);

  const upscalers = [];
  if (/dlss|rtx/i.test(raw)) upscalers.push('DLSS');
  if (/fsr|radeon|fidelityfx/i.test(raw)) upscalers.push('FSR');
  if (/xess|arc\s*[ab]\d{3}/i.test(raw)) upscalers.push('XeSS');
  if (upscalers.length === 0) upscalers.push('DLSS', 'FSR');

  const slugId = String(resolvedTitle)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'custom-steam-game';

  const tuningTips = [
    `Parsed directly from Steam/PCGW requirements (${minGpu} min -> ${recGpu} rec).`,
    recVramGB >= 8
      ? `Keep Texture Quality at High on 8GB VRAM GPUs and lower Shadow/Volumetric settings first for a +18% FPS boost.`
      : `Modest VRAM footprint (${recVramGB} GB recommended)—most modern GPUs can use High/Ultra textures safely.`,
    ssdRequired
      ? 'Install on an NVMe/SATA SSD to eliminate asset streaming stutter.'
      : 'Enable DLSS/FSR Quality mode if you need extra headroom at 1440p.'
  ];

  return enrichGameScores({
    id: slugId,
    title: resolvedTitle,
    genre: resolvedGenre,
    releaseYear: new Date().getFullYear(),
    engine: /unreal\s*engine\s*5|\bue5\b/i.test(raw) ? 'Unreal Engine 5' : 'Steam Spec Lookup',
    supportsRT,
    supportsUpscaling: upscalers,
    storageGB,
    ssdRequired,
    baseRecFps: 64,
    parsedFromRawText: true,
    minimum: {
      cpu: minCpu,
      gpu: minGpu,
      ramGB: minRamGB,
      vramGB: minVramGB
    },
    recommended: {
      cpu: recCpu,
      gpu: recGpu,
      ramGB: recRamGB,
      vramGB: recVramGB
    },
    tuningTips
  });
}

const TIER_WEIGHT = {
  EXCEEDS_RECOMMENDED: 4,
  MEETS_RECOMMENDED: 3,
  MEETS_MINIMUM: 2,
  BELOW_MINIMUM: 1
};

/**
 * Filters and sorts an array of games (optionally enriched with `.analysis` and `.installed`).
 */
function filterAndSortGames(games = [], { query = '', genre = '', tier = '', sortBy = '', installedOnly = false } = {}) {
  if (!Array.isArray(games)) return [];

  const q = String(query || '').trim().toLowerCase();
  const gFilter = String(genre || '').trim().toLowerCase();
  const tFilter = String(tier || '').trim().toUpperCase();
  const sortKey = String(sortBy || '').trim().toLowerCase();

  const filtered = games.filter((game) => {
    if (!game) return false;

    if (installedOnly && !(game.installed || game.isInstalled)) {
      return false;
    }

    if (q) {
      const hay = `${game.title || ''} ${game.genre || ''} ${game.engine || ''} ${game.id || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }

    if (gFilter && gFilter !== 'all') {
      const gameGenre = String(game.genre || '').toLowerCase();
      if (!gameGenre.includes(gFilter)) return false;
    }

    if (tFilter && tFilter !== 'ALL') {
      const gameTier = game.analysis?.overallTier || '';
      if (tFilter === 'PLAYABLE') {
        if (!game.analysis?.canRunMinimum) return false;
      } else if (tFilter === 'RECOMMENDED') {
        if (!game.analysis?.canRunRecommended) return false;
      } else if (gameTier && gameTier !== tFilter) {
        return false;
      }
    }

    return true;
  });

  const sorted = [...filtered];
  sorted.sort((a, b) => {
    if (sortKey === 'fps' || sortKey === 'fps-desc') {
      const fpsA = a.analysis?.optimalConfig?.estimatedFps?.['1080p']?.avg ?? a.baseRecFps ?? 0;
      const fpsB = b.analysis?.optimalConfig?.estimatedFps?.['1080p']?.avg ?? b.baseRecFps ?? 0;
      return fpsB - fpsA;
    }
    if (sortKey === 'fps-asc') {
      const fpsA = a.analysis?.optimalConfig?.estimatedFps?.['1080p']?.avg ?? a.baseRecFps ?? 0;
      const fpsB = b.analysis?.optimalConfig?.estimatedFps?.['1080p']?.avg ?? b.baseRecFps ?? 0;
      return fpsA - fpsB;
    }
    if (sortKey === 'title' || sortKey === 'name') {
      return String(a.title || '').localeCompare(String(b.title || ''));
    }
    if (sortKey === 'year' || sortKey === 'releaseyear' || sortKey === 'newest') {
      return (b.releaseYear || 0) - (a.releaseYear || 0);
    }
    if (sortKey === 'storage' || sortKey === 'size') {
      return (b.storageGB || 0) - (a.storageGB || 0);
    }
    if (sortKey === 'demanding' || sortKey === 'gpuscore') {
      return (b.recommended?.gpuScore || 0) - (a.recommended?.gpuScore || 0);
    }
    if (sortKey === 'tier' || sortKey === 'compatibility') {
      const rankA = TIER_WEIGHT[a.analysis?.overallTier] || 0;
      const rankB = TIER_WEIGHT[b.analysis?.overallTier] || 0;
      if (rankB !== rankA) return rankB - rankA;
      const fpsA = a.analysis?.optimalConfig?.estimatedFps?.['1080p']?.avg ?? 0;
      const fpsB = b.analysis?.optimalConfig?.estimatedFps?.['1080p']?.avg ?? 0;
      return fpsB - fpsA;
    }
    return 0;
  });

  return sorted;
}

module.exports = {
  parseRawRequirementsText,
  filterAndSortGames
};
