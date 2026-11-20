const { scoreCPU, scoreGPU } = require('./hardware');

const STEAM_APP_ID_MAP = {
  'cyberpunk-2077': '1091500',
  'black-myth-wukong': '2358720',
  'elden-ring': '1245620',
  'counter-strike-2': '730',
  'baldurs-gate-3': '1086940',
  'helldivers-2': '553850',
  'alan-wake-2': null,
  'red-dead-redemption-2': '1174180',
  'starfield': '1716740',
  'hogwarts-legacy': '990080',
  'forza-horizon-5': '1551360',
  'ghost-of-tsushima': '2215430',
  'cod-black-ops-6-warzone': '1938090',
  'call-of-duty-warzone': '1938090',
  'apex-legends': '1172470',
  'valorant': null,
  'fortnite': null,
  'minecraft-shaders': null,
  'minecraft-java': null,
  'gta-v': '271590',
  'gtav': '271590',
  'witcher-3-next-gen': '292030',
  'the-witcher-3': '292030',
  'resident-evil-4-remake': '2050650',
  'resident-evil-4': '2050650',
  'space-marine-2': '2183900',
  'stalker-2': '1643320',
  'monster-hunter-wilds': '2246340',
  'final-fantasy-xvi': '2515020',
  'spider-man-remastered': '1817070',
  'god-of-war-ragnarok': '2322010',
  'path-of-exile-2': '2694490',
  'horizon-forbidden-west': '2420110',
  'the-last-of-us-part-1': '1888930',
  'control': '870780',
  'metro-exodus-enhanced': '1449560',
  'doom-eternal': '782330',
  'hollow-knight': '367520',
  'hades-ii': '1145350',
  'diablo-iv': '2344520',
  'league-of-legends': null,
  'dota-2': '570',
  'overwatch-2': '2357570',
  'rainbow-six-siege': '359550',
  'pubg-battlegrounds': '578080',
  'escape-from-tarkov': null,
  'rust': '252490',
  'palworld': '1623730',
  'enshrouded': '1203620',
  'valheim': '892970',
  'no-mans-sky': '275850',
  'ms-flight-sim-2024': '2537590',
  'f1-24': '2488620',
  'assetto-corsa-competizione': '805550',
  'civilization-vii': '1295660',
  'cities-skylines-ii': '949230',
  'kingdom-come-deliverance-2': '1771300',
  'dragons-dogma-2': '2054970',
  'silent-hill-2-remake': '2124490',
  'indiana-jones-great-circle': '2677660',
  'gta-vi-projected': null
};

function escapeXml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function getGameMonogram(title = 'Game') {
  const cleaned = String(title)
    .replace(/[:\-–—()]/g, ' ')
    .replace(/\b(the|of|and|edition|remastered|director'?s|cut|next-gen|update|enhanced)\b/gi, ' ')
    .trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'GM';
  if (words.length === 1) {
    return words[0].slice(0, 3).toUpperCase();
  }
  const letters = words.slice(0, 3).map((w) => {
    if (/^\d+$/.test(w)) return w;
    return w[0].toUpperCase();
  });
  return letters.join('').slice(0, 3);
}

function getGenrePalette(genre = '', title = '') {
  const g = `${genre} ${title}`.toLowerCase();
  if (g.includes('horror') || g.includes('resident evil') || g.includes('alan wake') || g.includes('stalker')) {
    return { bg1: '#0f172a', bg2: '#3b0764', accent: '#c084fc', glow: '#ef4444' };
  }
  if (g.includes('shooter') || g.includes('counter-strike') || g.includes('valorant') || g.includes('apex') || g.includes('call of duty') || g.includes('helldivers')) {
    return { bg1: '#091526', bg2: '#1e293b', accent: '#38bdf8', glow: '#f59e0b' };
  }
  if (g.includes('racing') || g.includes('forza')) {
    return { bg1: '#0f172a', bg2: '#064e3b', accent: '#10b981', glow: '#38bdf8' };
  }
  if (g.includes('rpg') || g.includes('witcher') || g.includes('elden') || g.includes('baldur') || g.includes('wukong') || g.includes('cyberpunk') || g.includes('monster hunter')) {
    return { bg1: '#0b1120', bg2: '#1e1b4b', accent: '#38bdf8', glow: '#a855f7' };
  }
  if (g.includes('sandbox') || g.includes('minecraft') || g.includes('survival')) {
    return { bg1: '#0a191e', bg2: '#14532d', accent: '#34d399', glow: '#fbbf24' };
  }
  return { bg1: '#0a0e17', bg2: '#1e293b', accent: '#38bdf8', glow: '#6366f1' };
}

function buildFallbackBannerSvg(game = {}) {
  const title = String(game.title || game.name || 'PC Game');
  const genre = String(game.genre || 'PC Gaming');
  const engine = String(game.engine || 'Optimized Profile');
  const monogram = getGameMonogram(title);
  const pal = getGenrePalette(genre, title);
  const shortTitle = title.length > 30 ? `${title.slice(0, 28)}…` : title;
  const subText = `${genre} • ${engine}`.slice(0, 44);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 460 215" width="460" height="215">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${pal.bg1}"/>
        <stop offset="65%" stop-color="${pal.bg2}"/>
        <stop offset="100%" stop-color="#090d16"/>
      </linearGradient>
      <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${pal.accent}"/>
        <stop offset="100%" stop-color="${pal.glow}"/>
      </linearGradient>
    </defs>
    <rect width="460" height="215" fill="url(#bg)"/>
    <circle cx="400" cy="40" r="110" fill="${pal.glow}" fill-opacity="0.14"/>
    <circle cx="85" cy="180" r="95" fill="${pal.accent}" fill-opacity="0.12"/>
    <path d="M0 175 L460 135 L460 215 L0 215 Z" fill="#050811" fill-opacity="0.55"/>
    <rect x="24" y="42" width="84" height="84" rx="18" fill="#0b1324" stroke="url(#accentGrad)" stroke-width="2.5"/>
    <text x="66" y="95" text-anchor="middle" fill="#f8fafc" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="30" font-weight="800" letter-spacing="1">${escapeXml(monogram)}</text>
    <text x="126" y="82" fill="#f8fafc" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="22" font-weight="800">${escapeXml(shortTitle)}</text>
    <text x="126" y="109" fill="${pal.accent}" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="13" font-weight="600">${escapeXml(subText)}</text>
    <rect x="126" y="124" width="112" height="6" rx="3" fill="url(#accentGrad)"/>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function buildFallbackLogoSvg(game = {}) {
  const title = String(game.title || game.name || 'PC Game');
  const genre = String(game.genre || 'PC Gaming');
  const monogram = getGameMonogram(title);
  const pal = getGenrePalette(genre, title);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
    <defs>
      <linearGradient id="lg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${pal.bg2}"/>
        <stop offset="100%" stop-color="${pal.bg1}"/>
      </linearGradient>
      <linearGradient id="bdr" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${pal.accent}"/>
        <stop offset="100%" stop-color="${pal.glow}"/>
      </linearGradient>
    </defs>
    <rect x="6" y="6" width="108" height="108" rx="24" fill="url(#lg)" stroke="url(#bdr)" stroke-width="4"/>
    <text x="60" y="72" text-anchor="middle" fill="#f8fafc" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="36" font-weight="800" letter-spacing="1">${escapeXml(monogram)}</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const GAMES_CATALOG = [
  {
    id: 'cyberpunk-2077',
    title: 'Cyberpunk 2077: Phantom Liberty',
    genre: 'Action RPG',
    releaseYear: 2023,
    engine: 'REDengine 4',
    supportsRT: true,
    supportsUpscaling: ['DLSS', 'FSR', 'XeSS'],
    storageGB: 70,
    ssdRequired: true,
    baseRecFps: 64,
    minimum: {
      cpu: 'Intel Core i7-6700 or AMD Ryzen 5 1600',
      gpu: 'GeForce GTX 1060 6GB or Radeon RX 580 8GB',
      ramGB: 12,
      vramGB: 6
    },
    recommended: {
      cpu: 'Intel Core i7-10700 or AMD Ryzen 7 5800X',
      gpu: 'GeForce RTX 2060 SUPER or Radeon RX 5700 XT',
      ramGB: 16,
      vramGB: 8
    },
    ultraRT: {
      cpu: 'Intel Core i7-12700 or AMD Ryzen 7 7800X3D',
      gpu: 'GeForce RTX 3080 or Radeon RX 7900 XT',
      ramGB: 20,
      vramGB: 12
    },
    tuningTips: [
      'Lower "Crowd Density" to Medium in heavy city areas (Dogtown) for a +12% CPU boost.',
      'Set "Volumetric Fog Resolution" and "Screen Space Reflections" to Medium/High instead of Ultra for +18% FPS with minimal visual loss.',
      'With 8GB VRAM GPUs, keep Textures on High and avoid enabling Ray Tracing at 1440p.'
    ]
  },
  {
    id: 'black-myth-wukong',
    title: 'Black Myth: Wukong',
    genre: 'Action RPG',
    releaseYear: 2024,
    engine: 'Unreal Engine 5',
    supportsRT: true,
    supportsUpscaling: ['DLSS', 'FSR', 'XeSS', 'TSR'],
    storageGB: 130,
    ssdRequired: true,
    baseRecFps: 62,
    minimum: {
      cpu: 'Intel Core i5-8400 or AMD Ryzen 5 1600',
      gpu: 'NVIDIA GeForce GTX 1060 6GB or AMD Radeon RX 580 8GB',
      ramGB: 16,
      vramGB: 6
    },
    recommended: {
      cpu: 'Intel Core i7-9700 or AMD Ryzen 5 5500',
      gpu: 'NVIDIA GeForce RTX 2060 or AMD Radeon RX 5700 XT',
      ramGB: 16,
      vramGB: 8
    },
    ultraRT: {
      cpu: 'Intel Core i7-9700 or AMD Ryzen 5 5500',
      gpu: 'NVIDIA GeForce RTX 4070 or AMD Radeon RX 7800 XT',
      ramGB: 32,
      vramGB: 12
    },
    tuningTips: [
      'Unreal Engine 5 relies heavily on upscaling: set Super Resolution (FSR / DLSS) to ~65-75% (Quality) and enable Frame Generation if targeting 90+ FPS.',
      'Set "Shadow Quality" and "Global Illumination" to Medium/High instead of Cinematic to avoid massive GPU spikes.',
      'Keep "Full Ray Tracing" Off on AMD and mid-range NVIDIA cards.'
    ]
  },
  {
    id: 'elden-ring',
    title: 'Elden Ring: Shadow of the Erdtree',
    genre: 'Action RPG',
    releaseYear: 2024,
    engine: 'FromSoftware Proprietary',
    supportsRT: true,
    supportsUpscaling: ['Native'],
    storageGB: 80,
    ssdRequired: true,
    baseRecFps: 60,
    minimum: {
      cpu: 'Intel Core i5-8400 or AMD Ryzen 3 3300X',
      gpu: 'NVIDIA GeForce GTX 1060 3GB or AMD Radeon RX 580 4GB',
      ramGB: 12,
      vramGB: 4
    },
    recommended: {
      cpu: 'Intel Core i7-8700K or AMD Ryzen 5 3600X',
      gpu: 'NVIDIA GeForce GTX 1070 8GB or AMD Radeon RX Vega 56 8GB',
      ramGB: 16,
      vramGB: 8
    },
    tuningTips: [
      'Elden Ring has a locked 60 FPS cap by default and no built-in FSR/DLSS.',
      'Disable "Ray Tracing Quality" unless you have substantial GPU headroom, as it can cause frame drops in open areas.',
      'Set Grass Quality and Volumetric Quality to High for rock-solid 60 FPS.'
    ]
  },
  {
    id: 'baldurs-gate-3',
    title: "Baldur's Gate 3",
    genre: 'CRPG',
    releaseYear: 2023,
    engine: 'Divinity Engine 4.0',
    supportsRT: false,
    supportsUpscaling: ['DLSS', 'FSR'],
    storageGB: 150,
    ssdRequired: true,
    baseRecFps: 68,
    minimum: {
      cpu: 'Intel i5-4690 or AMD FX 8350',
      gpu: 'Nvidia GTX 970 or RX 480',
      ramGB: 8,
      vramGB: 4
    },
    recommended: {
      cpu: 'Intel i7-8700K or AMD Ryzen 5 3600',
      gpu: 'Nvidia RTX 2060 Super or RX 5700 XT',
      ramGB: 16,
      vramGB: 8
    },
    tuningTips: [
      'Act 3 (Lower City) is CPU-intensive; enable "Dynamic Crowds" only if your CPU has 8+ fast cores (like Ryzen 7 5800X).',
      'Use DirectX 11 or Vulkan depending on stability; Vulkan often performs very well on AMD Radeon RX 7000 GPUs.',
      'Set "Shadow Quality" and "Cloud Quality" to High instead of Ultra for +14% FPS during large tactical fights.'
    ]
  },
  {
    id: 'red-dead-redemption-2',
    title: 'Red Dead Redemption 2',
    genre: 'Open World Action',
    releaseYear: 2019,
    engine: 'RAGE',
    supportsRT: false,
    supportsUpscaling: ['DLSS', 'FSR'],
    storageGB: 150,
    ssdRequired: false,
    baseRecFps: 66,
    minimum: {
      cpu: 'Intel Core i5-2500K or AMD FX-6300',
      gpu: 'Nvidia GeForce GTX 770 2GB or AMD Radeon R9 280 3GB',
      ramGB: 8,
      vramGB: 3
    },
    recommended: {
      cpu: 'Intel Core i7-4770K or AMD Ryzen 5 1500X',
      gpu: 'Nvidia GeForce GTX 1060 6GB or AMD Radeon RX 480 4GB',
      ramGB: 12,
      vramGB: 6
    },
    tuningTips: [
      'Set "Texture Quality" to Ultra (it looks drastically better and easily fits in 6GB+ VRAM).',
      'Keep "Water Physics Quality" at 50% and "Tree Tessellation" Off for a huge +25% FPS gain.',
      'Use "Near Volumetric Resolution" on Medium and "Far Volumetric Resolution" on High for Hardware Unboxed optimized settings.'
    ]
  },
  {
    id: 'helldivers-2',
    title: 'HELLDIVERS 2',
    genre: 'Co-op Shooter',
    releaseYear: 2024,
    engine: 'Autodesk Stingray',
    supportsRT: false,
    supportsUpscaling: ['Native', 'Render Scale'],
    storageGB: 100,
    ssdRequired: true,
    baseRecFps: 68,
    minimum: {
      cpu: 'Intel Core i7-4790K or AMD Ryzen 5 1500X',
      gpu: 'NVIDIA GeForce GTX 1050 Ti or AMD Radeon RX 470',
      ramGB: 8,
      vramGB: 4
    },
    recommended: {
      cpu: 'Intel Core i7-9700K or AMD Ryzen 7 3700X',
      gpu: 'NVIDIA GeForce RTX 2060 or AMD Radeon RX 6600 XT',
      ramGB: 16,
      vramGB: 8
    },
    tuningTips: [
      'Set Render Scale to "Native" or "Ultra Quality" at 1080p for crisp visibility.',
      'Lower "Space Quality" and "Volumetric Fog" to Medium for +20% higher framerates during intense bug/bot drops.',
      'Disable "Async Compute" on most modern GPUs if you experience frametime stutter in 4-player chaotic missions.'
    ]
  },
  {
    id: 'counter-strike-2',
    title: 'Counter-Strike 2',
    genre: 'Competitive Tactical Shooter',
    releaseYear: 2023,
    engine: 'Source 2',
    supportsRT: false,
    supportsUpscaling: ['FSR', 'Native'],
    storageGB: 85,
    ssdRequired: true,
    baseRecFps: 210,
    minimum: {
      cpu: 'Intel Core i5-750 or AMD Ryzen 3 1200',
      gpu: 'GeForce GTX 1050 or Radeon RX 560',
      ramGB: 8,
      vramGB: 2
    },
    recommended: {
      cpu: 'Intel Core i5-12400 or AMD Ryzen 5 5600',
      gpu: 'NVIDIA GeForce RTX 2060 or AMD Radeon RX 6600',
      ramGB: 16,
      vramGB: 6
    },
    tuningTips: [
      'Keep "Global Shadow Quality" on High so you can spot enemy shadows around corners.',
      'Set "FidelityFX Super Resolution" to Disabled (Native) for maximum competitive clarity and lowest input latency.',
      'Enable AMD Anti-Lag 2 or NVIDIA Reflex Low Latency (+Boost).'
    ]
  },
  {
    id: 'alan-wake-2',
    title: 'Alan Wake 2',
    genre: 'Survival Horror',
    releaseYear: 2023,
    engine: 'Northlight Engine (Mesh Shaders)',
    supportsRT: true,
    supportsUpscaling: ['DLSS', 'FSR'],
    storageGB: 90,
    ssdRequired: true,
    baseRecFps: 60,
    minimum: {
      cpu: 'Intel i5-7600K or AMD Ryzen 7 3700X',
      gpu: 'GeForce RTX 2060 or Radeon RX 6600',
      ramGB: 16,
      vramGB: 6
    },
    recommended: {
      cpu: 'AMD Ryzen 7 3700X or Intel i7-10700',
      gpu: 'GeForce RTX 3070 or Radeon RX 6700 XT',
      ramGB: 16,
      vramGB: 8
    },
    tuningTips: [
      'Requires hardware Mesh Shader support (RTX 2000+ or RX 6000+).',
      'On 8GB VRAM GPUs, use Medium/High Preset at 1080p with FSR/DLSS Quality and keep Ray Tracing Off to avoid VRAM overflow.',
      'Lower "Volumetric Lighting" and "Post-Processing Quality" to Medium for an instant +16% FPS boost in forest scenes.'
    ]
  },
  {
    id: 'forza-horizon-5',
    title: 'Forza Horizon 5',
    genre: 'Open World Racing',
    releaseYear: 2021,
    engine: 'ForzaTech',
    supportsRT: true,
    supportsUpscaling: ['DLSS', 'FSR', 'XeSS'],
    storageGB: 110,
    ssdRequired: true,
    baseRecFps: 95,
    minimum: {
      cpu: 'AMD Ryzen 3 1200 or Intel i5-4460',
      gpu: 'AMD Radeon RX 470 or Nvidia GTX 970',
      ramGB: 8,
      vramGB: 4
    },
    recommended: {
      cpu: 'AMD Ryzen 5 1500X or Intel i5-8400',
      gpu: 'AMD Radeon RX 590 or Nvidia GTX 1070',
      ramGB: 16,
      vramGB: 8
    },
    tuningTips: [
      'Extremely well-optimized engine: most 8GB modern GPUs can run High/Ultra natively at 1080p or 1440p at 90-120+ FPS.',
      'Set "Environment Texture Quality" to High (Extreme requires 10GB+ VRAM).',
      'Set "Shader Quality" and "SSR Quality" to High rather than Extreme for +15% FPS while racing through dense jungle.'
    ]
  },
  {
    id: 'monster-hunter-wilds',
    title: 'Monster Hunter Wilds',
    genre: 'Action RPG',
    releaseYear: 2025,
    engine: 'RE Engine',
    supportsRT: true,
    supportsUpscaling: ['DLSS', 'FSR', 'XeSS'],
    storageGB: 140,
    ssdRequired: true,
    baseRecFps: 60,
    minimum: {
      cpu: 'Intel Core i5-10600 or AMD Ryzen 5 3600',
      gpu: 'NVIDIA GeForce GTX 1660 Super or AMD Radeon RX 5600 XT',
      ramGB: 16,
      vramGB: 6
    },
    recommended: {
      cpu: 'Intel Core i5-12400 or AMD Ryzen 5 5600',
      gpu: 'NVIDIA GeForce RTX 2070 Super or NVIDIA GeForce RTX 4060 or AMD Radeon RX 6700 XT',
      ramGB: 16,
      vramGB: 8
    },
    tuningTips: [
      'RE Engine open-world biomes are both CPU and VRAM heavy: keep Texture Quality at High (not Ultra/HD Pack) on 8GB VRAM GPUs.',
      'Enable FSR 3 Quality + Frame Generation to double smoothness from ~60 FPS to ~100+ FPS.',
      'Turn "Wind Simulation Quality" and "Foliage Sway" to Medium to ease CPU load in base camps.'
    ]
  },
  {
    id: 'gta-v',
    title: 'Grand Theft Auto V (Enhanced)',
    genre: 'Open World Action',
    releaseYear: 2015,
    engine: 'RAGE',
    supportsRT: true,
    supportsUpscaling: ['DLSS', 'FSR'],
    storageGB: 105,
    ssdRequired: false,
    baseRecFps: 105,
    minimum: {
      cpu: 'Intel Core i5-3470 or AMD FX-8350',
      gpu: 'NVIDIA GTX 960 4GB or AMD Radeon RX 470 4GB',
      ramGB: 8,
      vramGB: 4
    },
    recommended: {
      cpu: 'Intel Core i7-8700K or AMD Ryzen 5 3600',
      gpu: 'NVIDIA GeForce RTX 2060 or AMD Radeon RX 6600',
      ramGB: 16,
      vramGB: 6
    },
    tuningTips: [
      'Lower "Grass Quality" from Ultra to High or Very High—Ultra grass cuts framerate by up to 30% in Blaine County.',
      'Avoid cranking "Extended Distance Scaling" past 50% in Advanced Graphics as it heavily taxes single-core CPU performance.',
      'Use 2x MSAA with NVIDIA TXAA or FSR/DLSS in the Enhanced edition instead of 8x MSAA.'
    ]
  },
  {
    id: 'witcher-3-next-gen',
    title: 'The Witcher 3: Wild Hunt (Next-Gen Update)',
    genre: 'Action RPG',
    releaseYear: 2022,
    engine: 'REDengine 3 (DX12)',
    supportsRT: true,
    supportsUpscaling: ['DLSS', 'FSR', 'XeSS'],
    storageGB: 58,
    ssdRequired: true,
    baseRecFps: 66,
    minimum: {
      cpu: 'Intel Core i5-7400 or AMD Ryzen 5 1600',
      gpu: 'NVIDIA GTX 1060 6GB or AMD Radeon RX 580 8GB',
      ramGB: 8,
      vramGB: 6
    },
    recommended: {
      cpu: 'Intel Core i7-8700K or AMD Ryzen 5 3600',
      gpu: 'NVIDIA GeForce RTX 2060 Super or AMD Radeon RX 6600 XT',
      ramGB: 16,
      vramGB: 8
    },
    tuningTips: [
      'Switch to the DirectX 11 launcher if you do not use Ray Tracing or DLSS—DX11 delivers +20-25% higher FPS and smoother frametimes on older GPUs.',
      'Set "Foliage Visibility Range" to High instead of Ultra+ for a massive +18% FPS boost in dense Velen and Toussaint forests.',
      'Disable "NVIDIA HairWorks" on monsters and Geralt unless you have plenty of spare GPU compute.'
    ]
  },
  {
    id: 'valorant',
    title: 'VALORANT',
    genre: 'Competitive Tactical Shooter',
    releaseYear: 2020,
    engine: 'Unreal Engine 4',
    supportsRT: false,
    supportsUpscaling: ['Native'],
    storageGB: 45,
    ssdRequired: false,
    baseRecFps: 280,
    minimum: {
      cpu: 'Intel Core i3-4150 or AMD Ryzen 3 1200',
      gpu: 'GeForce GT 730 or Radeon R7 240',
      ramGB: 4,
      vramGB: 2
    },
    recommended: {
      cpu: 'Intel Core i5-9400F or AMD Ryzen 5 2600',
      gpu: 'NVIDIA GeForce GTX 1050 Ti or AMD Radeon RX 570',
      ramGB: 8,
      vramGB: 4
    },
    tuningTips: [
      'Enable "Multithreaded Rendering" in Video Settings—it is the single most impactful setting for 240+ FPS on 6+ core CPUs.',
      'Set Material, Texture, and Detail Quality to Low/Medium to eliminate visual clutter and maximize competitive frame pacing.',
      'Set "NVIDIA Reflex Low Latency" to On + Boost to minimize click-to-photon latency.'
    ]
  },
  {
    id: 'apex-legends',
    title: 'Apex Legends',
    genre: 'Battle Royale Shooter',
    releaseYear: 2019,
    engine: 'Source (Modified)',
    supportsRT: false,
    supportsUpscaling: ['Native', 'Adaptive Resolution'],
    storageGB: 75,
    ssdRequired: true,
    baseRecFps: 195,
    minimum: {
      cpu: 'Intel Core i3-6300 or AMD FX-4350',
      gpu: 'NVIDIA GeForce GT 730 or AMD Radeon HD 7730',
      ramGB: 6,
      vramGB: 2
    },
    recommended: {
      cpu: 'Intel Core i5-8400 or AMD Ryzen 5 2600',
      gpu: 'NVIDIA GeForce GTX 1060 6GB or AMD Radeon RX 580 8GB',
      ramGB: 16,
      vramGB: 6
    },
    tuningTips: [
      'Set "Spot Shadow Detail" and "Sun Shadow Coverage" to Low for +22% higher FPS during final-ring Gibraltar/Bangalore ultimates.',
      'Set "Texture Streaming Budget" to match your GPU VRAM (e.g., High 6GB or Very High 8GB) as it has near-zero FPS cost when within VRAM limits.',
      'Disable "Volumetric Lighting" and "Ambient Occlusion Quality" for cleaner visibility and steadier 144-240Hz lock.'
    ]
  },
  {
    id: 'cod-black-ops-6-warzone',
    title: 'Call of Duty: Black Ops 6 / Warzone',
    genre: 'Competitive Shooter',
    releaseYear: 2024,
    engine: 'IW 9.0 Engine',
    supportsRT: false,
    supportsUpscaling: ['DLSS', 'FSR', 'XeSS', 'FidelityFX CAS'],
    storageGB: 140,
    ssdRequired: true,
    baseRecFps: 115,
    minimum: {
      cpu: 'Intel Core i5-6600 or AMD Ryzen 5 1400',
      gpu: 'NVIDIA GeForce GTX 960 or AMD Radeon RX 470',
      ramGB: 8,
      vramGB: 4
    },
    recommended: {
      cpu: 'Intel Core i7-8700K or AMD Ryzen 5 3600',
      gpu: 'NVIDIA GeForce RTX 3060 or AMD Radeon RX 6600 XT',
      ramGB: 16,
      vramGB: 8
    },
    tuningTips: [
      'Use "FidelityFX CAS" (Sharpness ~75%) at Native resolution or FSR 3 / DLSS Quality for crystal-clear long-range target visibility in Warzone.',
      'Set "Shader Quality", "Screen Space Reflections", and "Weather Grid Volumes" to Low for a +24% framerate jump.',
      'Lower "VRAM Scale Target" to 75-80% in Graphics > Quality settings to prevent packet-burst-like microstutters.'
    ]
  },
  {
    id: 'hogwarts-legacy',
    title: 'Hogwarts Legacy',
    genre: 'Action RPG',
    releaseYear: 2023,
    engine: 'Unreal Engine 4',
    supportsRT: true,
    supportsUpscaling: ['DLSS', 'FSR', 'XeSS'],
    storageGB: 85,
    ssdRequired: true,
    baseRecFps: 64,
    minimum: {
      cpu: 'Intel Core i5-6600 or AMD Ryzen 5 1400',
      gpu: 'NVIDIA GeForce GTX 960 4GB or AMD Radeon RX 470 4GB',
      ramGB: 16,
      vramGB: 4
    },
    recommended: {
      cpu: 'Intel Core i7-8700 or AMD Ryzen 5 3600',
      gpu: 'NVIDIA GeForce GTX 1080 Ti or RTX 2070 or AMD Radeon RX 5700 XT',
      ramGB: 16,
      vramGB: 8
    },
    tuningTips: [
      'Hogsmeade and Hogwarts Castle are heavy on RAM and VRAM: keep Texture Quality and Material Quality on High (not Ultra) on 8GB VRAM GPUs.',
      'Set "Fog Quality" and "Sky Quality" to Medium/High for a quick +17% GPU performance boost.',
      'Keep Ray Tracing Off unless you have 12GB+ VRAM, as RT Reflections cause heavy traversal stutter.'
    ]
  },
  {
    id: 'starfield',
    title: 'Starfield',
    genre: 'Sci-Fi RPG',
    releaseYear: 2023,
    engine: 'Creation Engine 2',
    supportsRT: false,
    supportsUpscaling: ['DLSS', 'FSR', 'XeSS'],
    storageGB: 125,
    ssdRequired: true,
    baseRecFps: 62,
    minimum: {
      cpu: 'AMD Ryzen 5 2600X or Intel Core i7-6800K',
      gpu: 'AMD Radeon RX 5700 or NVIDIA GeForce GTX 1070 Ti',
      ramGB: 16,
      vramGB: 8
    },
    recommended: {
      cpu: 'AMD Ryzen 5 3600X or Intel i5-10600K',
      gpu: 'AMD Radeon RX 6800 XT or NVIDIA GeForce RTX 2080',
      ramGB: 16,
      vramGB: 8
    },
    tuningTips: [
      'MUST be installed on an NVMe/SATA SSD—running Starfield on an HDD causes severe audio dropouts and asset freezes.',
      'Enable FSR 3 or DLSS 3 with Frame Generation to smooth out CPU bottlenecks in New Atlantis and Akila City.',
      'Lower "Shadow Quality" and "Volumetric Lighting" to Medium for +19% FPS with minimal visual difference.'
    ]
  },
  {
    id: 'spider-man-remastered',
    title: "Marvel's Spider-Man Remastered",
    genre: 'Open World Action',
    releaseYear: 2022,
    engine: 'Insomniac Proprietary',
    supportsRT: true,
    supportsUpscaling: ['DLSS', 'FSR', 'XeSS', 'IGTI'],
    storageGB: 75,
    ssdRequired: true,
    baseRecFps: 76,
    minimum: {
      cpu: 'Intel Core i3-4160 or AMD Ryzen 3 1200',
      gpu: 'NVIDIA GTX 960 4GB or AMD Radeon RX 470',
      ramGB: 8,
      vramGB: 4
    },
    recommended: {
      cpu: 'Intel Core i5-4670 or AMD Ryzen 5 1600',
      gpu: 'NVIDIA GTX 1060 6GB or AMD Radeon RX 580 8GB',
      ramGB: 16,
      vramGB: 6
    },
    tuningTips: [
      'Web-swinging at high speed streams assets rapidly and taxes the CPU: lower "Traffic Density" and "Crowd Density" if FPS dips while swinging.',
      'If enabling Ray-Traced Reflections, set "Ray-Traced Geometry Detail" to High instead of Very High to save CPU threads and VRAM.',
      'Set "Weather Particle Quality" to Medium during rainy night missions for +12% FPS.'
    ]
  },
  {
    id: 'god-of-war-ragnarok',
    title: 'God of War Ragnarök',
    genre: 'Action Adventure',
    releaseYear: 2024,
    engine: 'Santa Monica Proprietary',
    supportsRT: false,
    supportsUpscaling: ['DLSS', 'FSR', 'XeSS'],
    storageGB: 190,
    ssdRequired: true,
    baseRecFps: 70,
    minimum: {
      cpu: 'Intel i5-4670K or AMD Ryzen 3 1200',
      gpu: 'NVIDIA GTX 1060 6GB or AMD RX 5500 XT 8GB',
      ramGB: 8,
      vramGB: 6
    },
    recommended: {
      cpu: 'Intel i5-8600 or AMD Ryzen 5 3600',
      gpu: 'NVIDIA RTX 2060 Super or AMD RX 5700',
      ramGB: 16,
      vramGB: 8
    },
    tuningTips: [
      'Requires 190 GB of fast SSD storage—make sure your drive has extra headroom before installing.',
      'Set "Atmospherics" and "Reflections" to High instead of Ultra for +15% FPS in Svartalfheim and Vanaheim.',
      'Combine DLSS/FSR Quality with Frame Generation for locked 100+ FPS combat responsiveness.'
    ]
  },
  {
    id: 'ghost-of-tsushima',
    title: "Ghost of Tsushima Director's Cut",
    genre: 'Open World Action',
    releaseYear: 2024,
    engine: 'Sucker Punch Engine',
    supportsRT: false,
    supportsUpscaling: ['DLSS', 'FSR', 'XeSS'],
    storageGB: 75,
    ssdRequired: true,
    baseRecFps: 72,
    minimum: {
      cpu: 'Intel Core i3-7100 or AMD Ryzen 3 1200',
      gpu: 'NVIDIA GeForce GTX 960 4GB or AMD Radeon RX 5500 XT',
      ramGB: 8,
      vramGB: 4
    },
    recommended: {
      cpu: 'Intel Core i5-8600 or AMD Ryzen 5 3600',
      gpu: 'NVIDIA GeForce RTX 2060 or AMD Radeon RX 5600 XT',
      ramGB: 16,
      vramGB: 6
    },
    tuningTips: [
      'Nixxes port is well optimized: set "Volumetric Fog" and "Shadow Quality" to High instead of Very High/Extreme for +18% FPS.',
      'On 8GB VRAM GPUs, keep Texture Quality on High (Very High can exceed 8GB after extended play sessions).',
      'Supports decoupled FSR 3 Frame Generation even when using DLSS or XeSS upscaling.'
    ]
  },
  {
    id: 'minecraft-shaders',
    title: 'Minecraft (Java Edition with Shaders)',
    genre: 'Sandbox Survival',
    releaseYear: 2024,
    engine: 'Java LWJGL (Sodium + Iris Shaders)',
    supportsRT: true,
    supportsUpscaling: ['Native', 'Render Scale'],
    storageGB: 25,
    ssdRequired: false,
    baseRecFps: 85,
    minimum: {
      cpu: 'Intel Core i5-4690 or AMD Ryzen 3 1200',
      gpu: 'NVIDIA GeForce GTX 1050 Ti or AMD Radeon RX 570',
      ramGB: 8,
      vramGB: 4
    },
    recommended: {
      cpu: 'Intel Core i5-12400 or AMD Ryzen 5 5600',
      gpu: 'NVIDIA GeForce RTX 3060 or AMD Radeon RX 6600 XT',
      ramGB: 16,
      vramGB: 8
    },
    tuningTips: [
      'Use the Fabric modloader with Sodium + Lithium + Iris Shaders instead of OptiFine for up to 2.5x higher FPS.',
      'Set "Shadow Distance" in shader settings to 12-16 chunks and "Render Distance" to 16 chunks to balance CPU and GPU load.',
      'Allocate 6GB to 8GB of RAM (`-Xmx6G`) in the Minecraft Launcher JVM arguments—allocating too much (12GB+) can cause GC lag spikes.'
    ]
  },
  {
    id: 'path-of-exile-2',
    title: 'Path of Exile 2',
    genre: 'Action RPG',
    releaseYear: 2024,
    engine: 'Grinding Gear Proprietary',
    supportsRT: false,
    supportsUpscaling: ['DLSS', 'FSR', 'XeSS', 'NIS'],
    storageGB: 100,
    ssdRequired: true,
    baseRecFps: 75,
    minimum: {
      cpu: 'Intel Core i7-7700 or AMD Ryzen 5 2500X',
      gpu: 'NVIDIA GeForce GTX 960 or AMD Radeon RX 470',
      ramGB: 8,
      vramGB: 4
    },
    recommended: {
      cpu: 'Intel Core i5-10500 or AMD Ryzen 5 3600',
      gpu: 'NVIDIA GeForce RTX 2060 or AMD Radeon RX 5600 XT',
      ramGB: 16,
      vramGB: 6
    },
    tuningTips: [
      'Switch Renderer from DirectX 12 to Vulkan (or vice versa) if you see shader compilation stutters when entering new maps.',
      'Enable "Dynamic Culling" and "Dynamic Resolution" (target 60 FPS) to keep endgame Breach/Delirium density playable.',
      'Set "Global Illumination Quality" to High instead of Ultra—Ultra GI adds heavy GPU cost with subtle visual gains.'
    ]
  },
  {
    id: 'stalker-2',
    title: 'S.T.A.L.K.E.R. 2: Heart of Chornobyl',
    genre: 'Survival FPS',
    releaseYear: 2024,
    engine: 'Unreal Engine 5.1',
    supportsRT: true,
    supportsUpscaling: ['DLSS', 'FSR', 'XeSS', 'TSR'],
    storageGB: 160,
    ssdRequired: true,
    baseRecFps: 60,
    minimum: {
      cpu: 'Intel Core i7-7700K or AMD Ryzen 5 1600X',
      gpu: 'NVIDIA GeForce GTX 1060 6GB or AMD Radeon RX 580 8GB',
      ramGB: 16,
      vramGB: 6
    },
    recommended: {
      cpu: 'Intel Core i7-11700 or AMD Ryzen 7 5800X',
      gpu: 'NVIDIA GeForce RTX 3070 Ti or AMD Radeon RX 6800 XT',
      ramGB: 32,
      vramGB: 8
    },
    tuningTips: [
      'A-Life 2.0 NPC simulation in hubs (Rostok, Zalissya) is extremely CPU-bound: enable FSR 3 / DLSS 3 Frame Generation to bypass CPU limits.',
      'Keep "Hair Quality", "Shading Quality", and "Foliage Quality" at Medium/High rather than Epic for +22% FPS.',
      'On 8GB VRAM GPUs, set Texture Quality to Medium/High to prevent sudden drops to 15 FPS after 30 minutes of play.'
    ]
  },
  {
    id: 'resident-evil-4-remake',
    title: 'Resident Evil 4 Remake',
    genre: 'Survival Horror',
    releaseYear: 2023,
    engine: 'RE Engine',
    supportsRT: true,
    supportsUpscaling: ['FSR', 'Native'],
    storageGB: 67,
    ssdRequired: true,
    baseRecFps: 78,
    minimum: {
      cpu: 'AMD Ryzen 3 1200 or Intel Core i5-7500',
      gpu: 'AMD Radeon RX 560 4GB or NVIDIA GeForce GTX 1050 Ti 4GB',
      ramGB: 8,
      vramGB: 4
    },
    recommended: {
      cpu: 'AMD Ryzen 5 3600 or Intel Core i7-8700',
      gpu: 'AMD Radeon RX 5700 or NVIDIA GeForce GTX 1070',
      ramGB: 16,
      vramGB: 8
    },
    tuningTips: [
      'In RE Engine, "Texture Quality" controls the streaming pool budget: keep it at "High (2 GB)" or "High (3 GB)" on 8GB cards to avoid fatal DXGI crashes.',
      'Disable "Hair Strands" and "Ray Tracing" for an immediate +25% FPS increase during rainy village chapters.',
      'Set "Shadow Cache" to On and "Volumetric Lighting" to Medium for smooth 90+ FPS.'
    ]
  },
  {
    id: 'fortnite',
    title: 'Fortnite',
    genre: 'Battle Royale',
    releaseYear: 2017,
    engine: 'Unreal Engine 5',
    supportsRT: true,
    supportsUpscaling: ['DLSS', 'FSR', 'TSR'],
    storageGB: 70,
    ssdRequired: true,
    baseRecFps: 144,
    minimum: {
      cpu: 'Intel Core i3-3225',
      gpu: 'Intel HD 4000 or AMD Radeon Vega 8',
      ramGB: 8,
      vramGB: 2
    },
    recommended: {
      cpu: 'Intel Core i5-7300U or AMD Ryzen 3 3300U',
      gpu: 'NVIDIA GeForce GTX 960 or AMD Radeon R9 280',
      ramGB: 16,
      vramGB: 4
    },
    tuningTips: [
      'Use Performance Mode (Lower Graphical Fidelity) for 165-240+ FPS in competitive Zero Build and Ranked.',
      'Disable Nanite Virtualized Geometry and Hardware Ray Tracing unless playing casual 60 FPS cinematic mode.',
      'Turn on NVIDIA Reflex Low Latency + Boost for responsive building and edits.'
    ]
  },
  {
    id: 'space-marine-2',
    title: 'Warhammer 40,000: Space Marine 2',
    genre: 'Third-Person Action Shooter',
    releaseYear: 2024,
    engine: 'Swarm Engine',
    supportsRT: false,
    supportsUpscaling: ['DLSS', 'FSR'],
    storageGB: 75,
    ssdRequired: true,
    baseRecFps: 66,
    minimum: {
      cpu: 'AMD Ryzen 5 2600X or Intel Core i5-8600K',
      gpu: 'AMD Radeon RX 580 or NVIDIA GeForce GTX 1060 6GB',
      ramGB: 8,
      vramGB: 6
    },
    recommended: {
      cpu: 'AMD Ryzen 7 5800X or Intel Core i7-12700',
      gpu: 'AMD Radeon RX 6800 XT or NVIDIA GeForce RTX 3070',
      ramGB: 16,
      vramGB: 8
    },
    tuningTips: [
      'Tyranid swarm physics are CPU-heavy: keep Cloth Simulation and Volumetric Effects at Medium.',
      'Enable DLSS Quality or FSR 2 Quality to hold 60+ FPS during massive horde waves.',
      'Keep Texture Filtering at High on 8GB VRAM cards.'
    ]
  },
  {
    id: 'final-fantasy-xvi',
    title: 'Final Fantasy XVI',
    genre: 'Action RPG',
    releaseYear: 2024,
    engine: 'Square Enix Proprietary',
    supportsRT: false,
    supportsUpscaling: ['DLSS', 'FSR', 'XeSS'],
    storageGB: 170,
    ssdRequired: true,
    baseRecFps: 60,
    minimum: {
      cpu: 'AMD Ryzen 5 1600 or Intel Core i5-8400',
      gpu: 'AMD Radeon RX 5700 or NVIDIA GeForce GTX 1070',
      ramGB: 16,
      vramGB: 8
    },
    recommended: {
      cpu: 'AMD Ryzen 7 5700X or Intel Core i7-10700',
      gpu: 'AMD Radeon RX 6700 XT or NVIDIA GeForce RTX 2080',
      ramGB: 16,
      vramGB: 8
    },
    tuningTips: [
      'Enable Dynamic Resolution with DLSS 3 or FSR 3 Quality to maintain 60+ FPS during Eikon battles.',
      'Set Graphical Fidelity and Shadow Quality to High instead of Ultra on 8GB VRAM GPUs.',
      'Must be installed on a fast NVMe SSD for seamless cutscene-to-combat transitions.'
    ]
  },
  {
    id: 'horizon-forbidden-west',
    title: 'Horizon Forbidden West Complete Edition',
    genre: 'Action RPG',
    releaseYear: 2024,
    engine: 'Decima Engine',
    supportsRT: false,
    supportsUpscaling: ['DLSS', 'FSR', 'XeSS'],
    storageGB: 150,
    ssdRequired: true,
    baseRecFps: 74,
    minimum: {
      cpu: 'Intel Core i3-8100 or AMD Ryzen 3 1300X',
      gpu: 'NVIDIA GeForce GTX 1650 4GB or AMD Radeon RX 5500 XT 4GB',
      ramGB: 16,
      vramGB: 4
    },
    recommended: {
      cpu: 'Intel Core i5-8600 or AMD Ryzen 5 3600',
      gpu: 'NVIDIA GeForce RTX 3060 or AMD Radeon RX 5700',
      ramGB: 16,
      vramGB: 8
    },
    tuningTips: [
      'Keep Texture Quality at High on 8GB VRAM GPUs to prevent texture pop-in in Burning Shores.',
      'Lower Cloud Quality and Hair Quality from Very High to Medium/High for +15% FPS.',
      'Use DLSS 3 or FSR 2.2 Quality for crisp foliage rendering at 1440p.'
    ]
  },
  {
    id: 'the-last-of-us-part-1',
    title: 'The Last of Us Part I',
    genre: 'Action Adventure',
    releaseYear: 2023,
    engine: 'Naughty Dog Engine',
    supportsRT: false,
    supportsUpscaling: ['DLSS', 'FSR'],
    storageGB: 100,
    ssdRequired: true,
    baseRecFps: 62,
    minimum: {
      cpu: 'AMD Ryzen 5 1500X or Intel Core i7-4770K',
      gpu: 'AMD Radeon RX 470 or NVIDIA GeForce GTX 970',
      ramGB: 16,
      vramGB: 4
    },
    recommended: {
      cpu: 'AMD Ryzen 5 3600 or Intel Core i7-8700',
      gpu: 'AMD Radeon RX 5700 XT or NVIDIA GeForce RTX 2070 Super',
      ramGB: 16,
      vramGB: 8
    },
    tuningTips: [
      'Wait for initial shader compilation to reach 100% in the main menu before starting gameplay.',
      'Set Environment Texture Quality to Medium/High on 8GB VRAM cards to stay under the VRAM budget.',
      'Enable DLSS or FSR Quality to smooth out dense overgrown city chapters.'
    ]
  },
  {
    id: 'control',
    title: 'Control Ultimate Edition',
    genre: 'Action Adventure',
    releaseYear: 2020,
    engine: 'Northlight Engine',
    supportsRT: true,
    supportsUpscaling: ['DLSS'],
    storageGB: 42,
    ssdRequired: false,
    baseRecFps: 82,
    minimum: {
      cpu: 'Intel Core i5-4690 or AMD FX-4350',
      gpu: 'NVIDIA GeForce GTX 780 or AMD Radeon R9 280X',
      ramGB: 8,
      vramGB: 4
    },
    recommended: {
      cpu: 'Intel Core i5-7600K or AMD Ryzen 5 1600X',
      gpu: 'NVIDIA GeForce GTX 1660 or AMD Radeon RX 580',
      ramGB: 16,
      vramGB: 6
    },
    tuningTips: [
      'Set Volumetric Lighting and Screen Space Reflections to Medium for +20% FPS with virtually identical visuals.',
      'If enabling Ray Tracing, toggle on DLSS Quality and keep RT Indirect Diffuse Lighting off on mid-range GPUs.',
      'Run in DirectX 12 mode for better multi-core CPU scaling and ray tracing support.'
    ]
  },
  {
    id: 'metro-exodus-enhanced',
    title: 'Metro Exodus Enhanced Edition',
    genre: 'First-Person Shooter',
    releaseYear: 2021,
    engine: '4A Engine',
    supportsRT: true,
    supportsUpscaling: ['DLSS'],
    storageGB: 80,
    ssdRequired: true,
    baseRecFps: 68,
    minimum: {
      cpu: 'Intel Core i5-4440',
      gpu: 'NVIDIA GeForce RTX 2060',
      ramGB: 8,
      vramGB: 6
    },
    recommended: {
      cpu: 'Intel Core i7-8700K',
      gpu: 'NVIDIA GeForce RTX 2070 or AMD Radeon RX 6700 XT',
      ramGB: 16,
      vramGB: 8
    },
    tuningTips: [
      'Enhanced Edition requires a hardware Ray Tracing GPU (RTX 20-series or RX 6000-series+).',
      'Enable DLSS Quality and set Ray Tracing to Normal rather than Ultra for 60+ FPS in open Volga/Caspian zones.',
      'Keep Hairworks and Advanced PhysX off unless you have significant GPU headroom.'
    ]
  },
  {
    id: 'doom-eternal',
    title: 'DOOM Eternal',
    genre: 'First-Person Shooter',
    releaseYear: 2020,
    engine: 'id Tech 7',
    supportsRT: true,
    supportsUpscaling: ['DLSS'],
    storageGB: 80,
    ssdRequired: true,
    baseRecFps: 144,
    minimum: {
      cpu: 'Intel Core i5-4430 or AMD Ryzen 3 1200',
      gpu: 'NVIDIA GeForce GTX 1050 Ti or AMD Radeon RX 470',
      ramGB: 8,
      vramGB: 4
    },
    recommended: {
      cpu: 'Intel Core i7-6700K or AMD Ryzen 7 1700',
      gpu: 'NVIDIA GeForce GTX 1080 or AMD Radeon RX 5700',
      ramGB: 8,
      vramGB: 8
    },
    tuningTips: [
      'id Tech 7 runs on Vulkan and scales effortlessly to 144+ FPS on mid-range hardware.',
      'Keep Texture Pool Size at High on 6-8GB VRAM cards so it never exceeds available VRAM.',
      'Disable Ray-Traced Reflections on non-RTX 3070+ GPUs to maintain locked high-refresh competitive fluidity.'
    ]
  },
  {
    id: 'hollow-knight',
    title: 'Hollow Knight',
    genre: 'Metroidvania Indie',
    releaseYear: 2017,
    engine: 'Unity',
    supportsRT: false,
    supportsUpscaling: ['Native'],
    storageGB: 9,
    ssdRequired: false,
    baseRecFps: 144,
    minimum: {
      cpu: 'Intel Core 2 Duo E5200',
      gpu: 'NVIDIA GeForce 9800GTX+ or AMD Radeon HD 4850',
      ramGB: 4,
      vramGB: 1
    },
    recommended: {
      cpu: 'Intel Core i5-4460',
      gpu: 'NVIDIA GeForce GTX 560 or AMD Radeon R7 260X',
      ramGB: 8,
      vramGB: 2
    },
    tuningTips: [
      'Runs at 144+ FPS on virtually any modern integrated or discrete GPU.',
      'Set Particle Effects to Normal if you experience minor frame dips in White Palace or Godhome.',
      'Use Borderless Fullscreen with V-Sync off if your monitor supports G-Sync/FreeSync for zero input lag.'
    ]
  },
  {
    id: 'hades-ii',
    title: 'Hades II',
    genre: 'Roguelike Action',
    releaseYear: 2024,
    engine: 'Supergiant Custom Engine',
    supportsRT: false,
    supportsUpscaling: ['Native'],
    storageGB: 10,
    ssdRequired: false,
    baseRecFps: 144,
    minimum: {
      cpu: 'Intel Core i5-6500 or AMD Ryzen 3 1200',
      gpu: 'NVIDIA GeForce GTX 950 or AMD Radeon R7 370',
      ramGB: 8,
      vramGB: 2
    },
    recommended: {
      cpu: 'Intel Core i5-8400 or AMD Ryzen 5 2600',
      gpu: 'NVIDIA GeForce GTX 1060 or AMD Radeon RX 580',
      ramGB: 16,
      vramGB: 4
    },
    tuningTips: [
      'Extremely lightweight and responsive: easily hits 120-240 FPS on 1080p/1440p displays.',
      'Enable V-Sync or cap FPS to your monitor refresh rate to prevent unnecessary GPU coil whine.',
      'Run in DirectX 12 or Vulkan for optimal frame pacing during busy Olympus encounters.'
    ]
  },
  {
    id: 'diablo-iv',
    title: 'Diablo IV',
    genre: 'Action RPG',
    releaseYear: 2023,
    engine: 'Blizzard Proprietary',
    supportsRT: true,
    supportsUpscaling: ['DLSS', 'FSR', 'XeSS'],
    storageGB: 90,
    ssdRequired: true,
    baseRecFps: 96,
    minimum: {
      cpu: 'Intel Core i5-2500K or AMD FX-8100',
      gpu: 'NVIDIA GeForce GTX 660 or AMD Radeon R9 280',
      ramGB: 8,
      vramGB: 4
    },
    recommended: {
      cpu: 'Intel Core i5-4670K or AMD Ryzen 3 1300X',
      gpu: 'NVIDIA GeForce GTX 970 or AMD Radeon RX 470',
      ramGB: 16,
      vramGB: 6
    },
    tuningTips: [
      'Do not install the optional High-Resolution Assets pack if your GPU has 8GB VRAM or less.',
      'Keep Fur Quality and Clutter Quality at Medium to eliminate town/world-boss stuttering.',
      'Enable DLSS Quality + NVIDIA Reflex for crisp 120+ FPS ARPG combat.'
    ]
  },
  {
    id: 'league-of-legends',
    title: 'League of Legends',
    genre: 'Competitive MOBA',
    releaseYear: 2009,
    engine: 'Riot Proprietary',
    supportsRT: false,
    supportsUpscaling: ['Native'],
    storageGB: 16,
    ssdRequired: false,
    baseRecFps: 180,
    minimum: {
      cpu: 'Intel Core i3-530 or AMD A6-3650',
      gpu: 'NVIDIA GeForce 9600GT or AMD Radeon HD 6570',
      ramGB: 4,
      vramGB: 1
    },
    recommended: {
      cpu: 'Intel Core i5-3300 or AMD Ryzen 3 1200',
      gpu: 'NVIDIA GeForce GTX 560 or AMD Radeon HD 6950',
      ramGB: 8,
      vramGB: 2
    },
    tuningTips: [
      'Single-core CPU speed drives late-game 5v5 teamfight FPS; close browser tabs in the background.',
      'Cap FPS at 144 or 240 FPS instead of Uncapped to avoid character-skipping movement bugs.',
      'Disable Eye Candy and Character Inking for maximum visual clarity in teamfights.'
    ]
  },
  {
    id: 'dota-2',
    title: 'Dota 2',
    genre: 'Competitive MOBA',
    releaseYear: 2013,
    engine: 'Source 2',
    supportsRT: false,
    supportsUpscaling: ['FSR'],
    storageGB: 60,
    ssdRequired: false,
    baseRecFps: 144,
    minimum: {
      cpu: 'Intel Core i5-2400 or AMD FX-6300',
      gpu: 'NVIDIA GeForce GTX 650 or AMD Radeon HD 7750',
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
      'Use the Vulkan or DirectX 11 API depending on which gives steadier 1% lows on your GPU.',
      'Turn off Animate Portrait, Grass, and High Quality Water for +18% FPS in chaotic Roshan fights.',
      'Enable NVIDIA Reflex Low Latency in Video settings for faster last-hitting and spell reactions.'
    ]
  },
  {
    id: 'overwatch-2',
    title: 'Overwatch 2',
    genre: 'Competitive Hero Shooter',
    releaseYear: 2022,
    engine: 'Overwatch Engine',
    supportsRT: false,
    supportsUpscaling: ['DLSS', 'FSR'],
    storageGB: 50,
    ssdRequired: true,
    baseRecFps: 165,
    minimum: {
      cpu: 'Intel Core i3-6100 or AMD Ryzen 3 1200',
      gpu: 'NVIDIA GeForce GTX 600 series or AMD Radeon HD 7000',
      ramGB: 6,
      vramGB: 2
    },
    recommended: {
      cpu: 'Intel Core i7-4770 or AMD Ryzen 5 1600',
      gpu: 'NVIDIA GeForce GTX 1060 or AMD Radeon RX 580',
      ramGB: 8,
      vramGB: 4
    },
    tuningTips: [
      'Set Render Scale to 100% (or FSR/DLSS Quality) and Dynamic Render Scale to Off for crisp aim.',
      'Lower Fog Detail, Local Reflections, and Shadow Detail to Low for rock-solid 165-240 FPS.',
      'Enable NVIDIA Reflex + Boost to minimize system click-to-photon latency.'
    ]
  },
  {
    id: 'rainbow-six-siege',
    title: "Tom Clancy's Rainbow Six Siege",
    genre: 'Tactical Shooter',
    releaseYear: 2015,
    engine: 'AnvilNext 2.0',
    supportsRT: false,
    supportsUpscaling: ['DLSS', 'FSR'],
    storageGB: 85,
    ssdRequired: false,
    baseRecFps: 180,
    minimum: {
      cpu: 'Intel Core i3-560 or AMD Phenom II X4 945',
      gpu: 'NVIDIA GeForce GTX 460 or AMD Radeon HD 5870',
      ramGB: 6,
      vramGB: 2
    },
    recommended: {
      cpu: 'Intel Core i5-2500K or AMD FX-8120',
      gpu: 'NVIDIA GeForce GTX 670 or AMD Radeon HD 7970',
      ramGB: 8,
      vramGB: 4
    },
    tuningTips: [
      'Run the DirectX 11 or Vulkan executable and enable NVIDIA Reflex / Anti-Lag.',
      'Set Shadows to Medium (keeps player shadows visible) while lowering Shading and Reflection Quality to Low.',
      'Use T-AA at 100% Render Scaling or DLSS Quality for razor-sharp pixel peeks.'
    ]
  },
  {
    id: 'pubg-battlegrounds',
    title: 'PUBG: BATTLEGROUNDS',
    genre: 'Battle Royale',
    releaseYear: 2017,
    engine: 'Unreal Engine 4',
    supportsRT: false,
    supportsUpscaling: ['Native'],
    storageGB: 40,
    ssdRequired: true,
    baseRecFps: 115,
    minimum: {
      cpu: 'Intel Core i5-4430 or AMD FX-6300',
      gpu: 'NVIDIA GeForce GTX 960 or AMD Radeon R7 370',
      ramGB: 8,
      vramGB: 2
    },
    recommended: {
      cpu: 'Intel Core i5-6600K or AMD Ryzen 5 1600',
      gpu: 'NVIDIA GeForce GTX 1060 3GB or AMD Radeon RX 580',
      ramGB: 16,
      vramGB: 4
    },
    tuningTips: [
      'Set Foliage, Shadows, and Effects to Very Low for both maximum FPS and clearer enemy visibility.',
      'Keep Textures and View Distance at Medium/High if you have 6GB+ VRAM.',
      'Run in DirectX 11 Enhanced mode for the best frame-time consistency in hot-drops.'
    ]
  },
  {
    id: 'escape-from-tarkov',
    title: 'Escape from Tarkov',
    genre: 'Tactical Extraction Shooter',
    releaseYear: 2017,
    engine: 'Unity',
    supportsRT: false,
    supportsUpscaling: ['DLSS', 'FSR'],
    storageGB: 45,
    ssdRequired: true,
    baseRecFps: 72,
    minimum: {
      cpu: 'Intel Core i5-4460 or AMD Ryzen 3 1200',
      gpu: 'NVIDIA GeForce GTX 960 or AMD Radeon RX 560',
      ramGB: 16,
      vramGB: 4
    },
    recommended: {
      cpu: 'Intel Core i7-10700 or AMD Ryzen 7 5800X3D',
      gpu: 'NVIDIA GeForce RTX 3060 or AMD Radeon RX 6700 XT',
      ramGB: 32,
      vramGB: 8
    },
    tuningTips: [
      'Streets of Tarkov is heavily CPU & RAM bound: 32 GB RAM and X3D cache CPUs yield massive 1% low gains.',
      "Enable 'Streets of Tarkov Lower Texture Resolution Mode' on 8GB VRAM GPUs to prevent stutters.",
      'Use DLSS Quality or FSR 2.2 Quality to offset the performance hit of dual-render PiP scopes.'
    ]
  },
  {
    id: 'rust',
    title: 'Rust',
    genre: 'Survival Sandbox',
    releaseYear: 2018,
    engine: 'Unity',
    supportsRT: false,
    supportsUpscaling: ['DLSS'],
    storageGB: 25,
    ssdRequired: true,
    baseRecFps: 84,
    minimum: {
      cpu: 'Intel Core i7-3770 or AMD FX-9590',
      gpu: 'NVIDIA GeForce GTX 670 or AMD Radeon R9 280',
      ramGB: 10,
      vramGB: 4
    },
    recommended: {
      cpu: 'Intel Core i7-9700K or AMD Ryzen 7 5800X3D',
      gpu: 'NVIDIA GeForce RTX 2060 or AMD Radeon RX 5700',
      ramGB: 16,
      vramGB: 8
    },
    tuningTips: [
      'Rust is intensely CPU- and memory-bound on high-pop servers: 16-32 GB RAM and an SSD are essential.',
      'Set Graphics Quality to 3-4, Shadow Cascades to None/Two, and Max Gibs to 0 for smoother PvP gunfights.',
      'Enable DLSS Quality and NVIDIA Reflex to reduce input lag during base raids.'
    ]
  },
  {
    id: 'palworld',
    title: 'Palworld',
    genre: 'Survival Monster-Taming',
    releaseYear: 2024,
    engine: 'Unreal Engine 5',
    supportsRT: false,
    supportsUpscaling: ['DLSS', 'TSR'],
    storageGB: 40,
    ssdRequired: true,
    baseRecFps: 76,
    minimum: {
      cpu: 'Intel Core i5-3570K or AMD Ryzen 3 1200',
      gpu: 'NVIDIA GeForce GTX 1050 2GB or AMD Radeon RX 560',
      ramGB: 16,
      vramGB: 4
    },
    recommended: {
      cpu: 'Intel Core i9-9900K or AMD Ryzen 5 5600',
      gpu: 'NVIDIA GeForce RTX 2070 or AMD Radeon RX 6600 XT',
      ramGB: 32,
      vramGB: 8
    },
    tuningTips: [
      'Hosting a multiplayer co-op world uses significant RAM: 32 GB is recommended for smooth base building.',
      'Lower View Distance and Grass Details to Medium for +20% FPS in dense Pal bases.',
      'Enable DLSS Quality or TSR Balanced at 1440p.'
    ]
  },
  {
    id: 'enshrouded',
    title: 'Enshrouded',
    genre: 'Survival Action RPG',
    releaseYear: 2024,
    engine: 'Voxel Proprietary Engine',
    supportsRT: false,
    supportsUpscaling: ['DLSS', 'FSR'],
    storageGB: 60,
    ssdRequired: true,
    baseRecFps: 68,
    minimum: {
      cpu: 'Intel Core i5-6400 or AMD Ryzen 5 1500X',
      gpu: 'NVIDIA GeForce GTX 1060 6GB or AMD Radeon RX 580 8GB',
      ramGB: 16,
      vramGB: 6
    },
    recommended: {
      cpu: 'Intel Core i7-8700 or AMD Ryzen 5 3700X',
      gpu: 'NVIDIA GeForce RTX 2070 Super or AMD Radeon RX 6700 XT',
      ramGB: 16,
      vramGB: 8
    },
    tuningTips: [
      'Voxel global illumination and dense fog are GPU-heavy: set Fog Quality and GI Quality to Performance/Balanced.',
      'Enable DLSS Quality or FSR 2 Quality for a +25-30% FPS boost in Shroud zones.',
      'Keep Texture Resolution at Balanced on 6GB VRAM cards.'
    ]
  },
  {
    id: 'valheim',
    title: 'Valheim',
    genre: 'Survival Co-op',
    releaseYear: 2021,
    engine: 'Unity',
    supportsRT: false,
    supportsUpscaling: ['Native'],
    storageGB: 2,
    ssdRequired: false,
    baseRecFps: 95,
    minimum: {
      cpu: 'Intel Core i5-7400 or AMD Ryzen 3 1200',
      gpu: 'NVIDIA GeForce GTX 950 or AMD Radeon R9 280',
      ramGB: 8,
      vramGB: 2
    },
    recommended: {
      cpu: 'Intel Core i5-10400 or AMD Ryzen 5 3600',
      gpu: 'NVIDIA GeForce GTX 1060 or AMD Radeon RX 580',
      ramGB: 16,
      vramGB: 4
    },
    tuningTips: [
      'Large player-built bases with many terraformed terrain instances tax CPU draw calls.',
      'Lower Vegetation Quality and Active Point Lights to Medium to keep base FPS above 60.',
      'Run with Vulkan (-force-vulkan) if you experience stuttering on DirectX 11.'
    ]
  },
  {
    id: 'no-mans-sky',
    title: "No Man's Sky",
    genre: 'Space Exploration Survival',
    releaseYear: 2016,
    engine: 'Hello Games Proprietary',
    supportsRT: false,
    supportsUpscaling: ['DLSS', 'FSR', 'XeSS'],
    storageGB: 15,
    ssdRequired: true,
    baseRecFps: 88,
    minimum: {
      cpu: 'Intel Core i3-4130 or AMD FX-6300',
      gpu: 'NVIDIA GeForce GTX 1060 3GB or AMD Radeon RX 470',
      ramGB: 8,
      vramGB: 4
    },
    recommended: {
      cpu: 'Intel Core i5-8400 or AMD Ryzen 5 2600',
      gpu: 'NVIDIA GeForce RTX 2060 or AMD Radeon RX 5600 XT',
      ramGB: 16,
      vramGB: 6
    },
    tuningTips: [
      'Planet Quality and Reflections are the biggest GPU hits: keep both at Enhanced/High instead of Ultra.',
      'Enable DLSS 2 or FSR 2.0 Quality for smooth 90+ FPS during planetary entry.',
      'Install on an SSD to drastically cut warp-screen loading times.'
    ]
  },
  {
    id: 'ms-flight-sim-2024',
    title: 'Microsoft Flight Simulator 2024',
    genre: 'Flight Simulation',
    releaseYear: 2024,
    engine: 'Asobo Engine',
    supportsRT: true,
    supportsUpscaling: ['DLSS', 'FSR', 'XeSS'],
    storageGB: 50,
    ssdRequired: true,
    baseRecFps: 48,
    minimum: {
      cpu: 'Intel Core i7-6800K or AMD Ryzen 5 2600X',
      gpu: 'NVIDIA GeForce GTX 970 or AMD Radeon RX 5700',
      ramGB: 16,
      vramGB: 4
    },
    recommended: {
      cpu: 'Intel Core i7-10700K or AMD Ryzen 7 2700X',
      gpu: 'NVIDIA GeForce RTX 3080 or AMD Radeon RX 7900 XT',
      ramGB: 32,
      vramGB: 12
    },
    tuningTips: [
      'Terrain Level of Detail (TLOD) is the #1 CPU killer near major airports: keep TLOD at 100-150 for smooth landings.',
      'Enable DLSS 3 / FSR 3 Frame Generation to double perceived smoothness from ~45 FPS to 90 FPS.',
      '32 GB+ RAM and 12 GB+ VRAM are strongly recommended for dense photogrammetry cities.'
    ]
  },
  {
    id: 'f1-24',
    title: 'F1 24',
    genre: 'Sim Racing',
    releaseYear: 2024,
    engine: 'EGO Engine 4.0',
    supportsRT: true,
    supportsUpscaling: ['DLSS', 'FSR', 'XeSS'],
    storageGB: 100,
    ssdRequired: true,
    baseRecFps: 110,
    minimum: {
      cpu: 'Intel Core i3-2130 or AMD FX-4300',
      gpu: 'NVIDIA GeForce GTX 1060 6GB or AMD Radeon RX 590',
      ramGB: 8,
      vramGB: 6
    },
    recommended: {
      cpu: 'Intel Core i5-9600K or AMD Ryzen 5 2600X',
      gpu: 'NVIDIA GeForce RTX 2070 or AMD Radeon RX 6700 XT',
      ramGB: 16,
      vramGB: 8
    },
    tuningTips: [
      'Disable Ray-Traced DDGI and Ray-Traced Reflections during rain races for +35% FPS.',
      'Enable DLSS Quality or FSR 2 Quality to hit locked 120+ FPS on 144Hz ultrawide monitors.',
      'Keep Crowd and Skidmarks at Medium to reduce CPU overhead on grid starts.'
    ]
  },
  {
    id: 'assetto-corsa-competizione',
    title: 'Assetto Corsa Competizione',
    genre: 'Sim Racing',
    releaseYear: 2019,
    engine: 'Unreal Engine 4',
    supportsRT: false,
    supportsUpscaling: ['DLSS', 'FSR'],
    storageGB: 50,
    ssdRequired: true,
    baseRecFps: 92,
    minimum: {
      cpu: 'Intel Core i5-4460 or AMD FX-8120',
      gpu: 'NVIDIA GeForce GTX 460 or AMD Radeon HD 7770',
      ramGB: 8,
      vramGB: 4
    },
    recommended: {
      cpu: 'Intel Core i5-8600K or AMD Ryzen 5 2600X',
      gpu: 'NVIDIA GeForce GTX 1070 or AMD Radeon RX 580',
      ramGB: 16,
      vramGB: 8
    },
    tuningTips: [
      'Visible Cars limit has a huge CPU impact in 30-car GT3 grids: cap visible opponents to 15-20.',
      'Set Mirrors Quality to Low/Mid and Volumetric Fog to Disabled for +20% FPS in night/rain races.',
      'Use KTAA or DLSS Quality for clean brake-marker readability.'
    ]
  },
  {
    id: 'civilization-vii',
    title: "Sid Meier's Civilization VII",
    genre: '4X Grand Strategy',
    releaseYear: 2025,
    engine: 'Firaxis LORE Engine',
    supportsRT: false,
    supportsUpscaling: ['FSR', 'XeSS'],
    storageGB: 20,
    ssdRequired: true,
    baseRecFps: 75,
    minimum: {
      cpu: 'Intel Core i5-8400 or AMD Ryzen 3 1200',
      gpu: 'NVIDIA GeForce GTX 1050 Ti or AMD Radeon RX 470',
      ramGB: 8,
      vramGB: 4
    },
    recommended: {
      cpu: 'Intel Core i5-10400 or AMD Ryzen 5 3600X',
      gpu: 'NVIDIA GeForce RTX 2060 or AMD Radeon RX 6600',
      ramGB: 16,
      vramGB: 8
    },
    tuningTips: [
      'Late-game turn times depend on CPU single-core & multi-core speed rather than GPU.',
      'Lower Leader Quality and Water Reflections to Medium on 4-6GB VRAM laptops.',
      'Cap FPS at 60-75 Hz to keep GPU fans quiet during long strategy sessions.'
    ]
  },
  {
    id: 'cities-skylines-ii',
    title: 'Cities: Skylines II',
    genre: 'City Builder Simulation',
    releaseYear: 2023,
    engine: 'Unity DOTS',
    supportsRT: false,
    supportsUpscaling: ['DLSS', 'FSR'],
    storageGB: 60,
    ssdRequired: true,
    baseRecFps: 44,
    minimum: {
      cpu: 'Intel Core i7-6700K or AMD Ryzen 5 2600X',
      gpu: 'NVIDIA GeForce GTX 970 or AMD Radeon RX 480',
      ramGB: 8,
      vramGB: 4
    },
    recommended: {
      cpu: 'Intel Core i5-12600K or AMD Ryzen 7 5800X',
      gpu: 'NVIDIA GeForce RTX 3080 or AMD Radeon RX 6800 XT',
      ramGB: 16,
      vramGB: 10
    },
    tuningTips: [
      'Disable Depth of Field, Volumetrics Quality, and Motion Blur immediately for +30% GPU FPS.',
      'Set Level of Detail to Low/Medium and Global Illumination to Low on 8GB VRAM GPUs.',
      'Large 200k+ citizen cities are heavily multi-core CPU bound; 8+ CPU cores help simulation speed.'
    ]
  },
  {
    id: 'kingdom-come-deliverance-2',
    title: 'Kingdom Come: Deliverance II',
    genre: 'Action RPG',
    releaseYear: 2025,
    engine: 'CryEngine',
    supportsRT: false,
    supportsUpscaling: ['DLSS', 'FSR'],
    storageGB: 100,
    ssdRequired: true,
    baseRecFps: 64,
    minimum: {
      cpu: 'Intel Core i5-8400 or AMD Ryzen 5 2600',
      gpu: 'NVIDIA GeForce GTX 1060 6GB or AMD Radeon RX 580',
      ramGB: 16,
      vramGB: 6
    },
    recommended: {
      cpu: 'Intel Core i7-13700K or AMD Ryzen 7 7800X3D',
      gpu: 'NVIDIA GeForce RTX 4070 or AMD Radeon RX 7800 XT',
      ramGB: 32,
      vramGB: 12
    },
    tuningTips: [
      'CryEngine SVOGI lighting and dense Kuttenberg crowds scale heavily with CPU & GPU: use High preset over Experimental.',
      'Enable DLSS Quality or FSR 3 Quality for +25% FPS in forested Bohemia.',
      'Keep Object Distance and Vegetation Detail at High for smooth 60+ FPS on mid-range rigs.'
    ]
  },
  {
    id: 'dragons-dogma-2',
    title: "Dragon's Dogma 2",
    genre: 'Action RPG',
    releaseYear: 2024,
    engine: 'RE Engine',
    supportsRT: true,
    supportsUpscaling: ['DLSS', 'FSR'],
    storageGB: 65,
    ssdRequired: true,
    baseRecFps: 56,
    minimum: {
      cpu: 'Intel Core i5-10600 or AMD Ryzen 5 3600',
      gpu: 'NVIDIA GeForce GTX 1070 or AMD Radeon RX 5500 XT',
      ramGB: 16,
      vramGB: 8
    },
    recommended: {
      cpu: 'Intel Core i7-10700 or AMD Ryzen 5 3600X',
      gpu: 'NVIDIA GeForce RTX 2080 or AMD Radeon RX 6700',
      ramGB: 16,
      vramGB: 8
    },
    tuningTips: [
      'Vernworth and Bakbattahl are severely CPU-bound due to NPC simulation: enable DLSS 3 / FSR 3 Frame Generation if supported.',
      'Disable Ray Tracing and lower Shadow Quality to Medium to save VRAM and stabilize frame times.',
      'Keep Texture Quality at High (2GB-3GB) on 8GB VRAM GPUs.'
    ]
  },
  {
    id: 'silent-hill-2-remake',
    title: 'SILENT HILL 2',
    genre: 'Survival Horror',
    releaseYear: 2024,
    engine: 'Unreal Engine 5',
    supportsRT: true,
    supportsUpscaling: ['DLSS', 'FSR', 'XeSS', 'TSR'],
    storageGB: 50,
    ssdRequired: true,
    baseRecFps: 58,
    minimum: {
      cpu: 'Intel Core i7-6700K or AMD Ryzen 5 3600',
      gpu: 'NVIDIA GeForce GTX 1070 Ti or AMD Radeon RX 5700',
      ramGB: 16,
      vramGB: 8
    },
    recommended: {
      cpu: 'Intel Core i7-8700K or AMD Ryzen 5 3600X',
      gpu: 'NVIDIA GeForce RTX 2080 or AMD Radeon RX 6800 XT',
      ramGB: 16,
      vramGB: 8
    },
    tuningTips: [
      'Keep Ray Tracing Off on 8GB VRAM GPUs; Software Lumen still delivers atmospheric fog and lighting.',
      'Set Shaders and Shadows Quality to Medium for +20% FPS in foggy South Vale streets.',
      'Enable DLSS Quality or FSR 3 Quality for smoother traversal.'
    ]
  },
  {
    id: 'indiana-jones-great-circle',
    title: 'Indiana Jones and the Great Circle',
    genre: 'Action Adventure',
    releaseYear: 2024,
    engine: 'Motor (id Tech 7)',
    supportsRT: true,
    supportsUpscaling: ['DLSS', 'FSR', 'XeSS'],
    storageGB: 120,
    ssdRequired: true,
    baseRecFps: 66,
    minimum: {
      cpu: 'Intel Core i7-10700K or AMD Ryzen 5 3600',
      gpu: 'NVIDIA GeForce RTX 2060 Super or AMD Radeon RX 6600',
      ramGB: 16,
      vramGB: 8
    },
    recommended: {
      cpu: 'Intel Core i7-12700K or AMD Ryzen 7 7700',
      gpu: 'NVIDIA GeForce RTX 3080 Ti or AMD Radeon RX 7700 XT',
      ramGB: 32,
      vramGB: 12
    },
    tuningTips: [
      'Requires a hardware Ray Tracing GPU (RTX 2060 Super / RX 6600 or newer) to launch.',
      'On 8GB VRAM GPUs, keep Texture Pool Size at Low/Medium to prevent severe performance drops.',
      'Enable DLSS Quality + Frame Generation (or FSR) for smooth 60-90+ FPS.'
    ]
  },
  {
    id: 'gta-vi-projected',
    title: 'Grand Theft Auto VI (Projected)',
    genre: 'Open World Action',
    releaseYear: 2026,
    engine: 'RAGE 9',
    supportsRT: true,
    supportsUpscaling: ['DLSS', 'FSR', 'XeSS'],
    storageGB: 150,
    ssdRequired: true,
    baseRecFps: 60,
    minimum: {
      cpu: 'Intel Core i5-12400 or AMD Ryzen 5 5600',
      gpu: 'NVIDIA GeForce RTX 3060 12GB or AMD Radeon RX 6700 XT',
      ramGB: 16,
      vramGB: 8
    },
    recommended: {
      cpu: 'Intel Core i7-13700K or AMD Ryzen 7 7800X3D',
      gpu: 'NVIDIA GeForce RTX 4070 Super or AMD Radeon RX 7800 XT',
      ramGB: 32,
      vramGB: 12
    },
    tuningTips: [
      'Projected specs based on RAGE 9 RTGI: an NVMe SSD and 12GB+ VRAM GPU are strongly advised for 1440p High.',
      'Expect DLSS 3.5 / FSR 3+ upscaling and Frame Generation to be key for high-refresh Leonida exploration.',
      '32 GB system RAM will help eliminate streaming hitches in dense Vice City traffic.'
    ]
  }
];

function enrichGameScores(game) {
  const minCpuScore = scoreCPU(game.minimum.cpu).score;
  const minGpuScore = scoreGPU(game.minimum.gpu, game.minimum.vramGB).score;
  const recCpuScore = scoreCPU(game.recommended.cpu).score;
  const recGpuScore = scoreGPU(game.recommended.gpu, game.recommended.vramGB).score;

  const rawSteamAppId =
    game.steamAppId ||
    (game.appId && /^\d+$/.test(String(game.appId).trim()) ? String(game.appId).trim() : null) ||
    STEAM_APP_ID_MAP[game.id] ||
    null;
  const steamAppId = rawSteamAppId ? String(rawSteamAppId) : null;
  const fallbackBannerSvg = game.fallbackBannerSvg || buildFallbackBannerSvg(game);
  const fallbackLogoSvg = game.fallbackLogoSvg || buildFallbackLogoSvg(game);
  const bannerUrl =
    game.bannerUrl ||
    (steamAppId
      ? `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${steamAppId}/header.jpg`
      : fallbackBannerSvg);
  const logoUrl =
    game.logoUrl ||
    (steamAppId
      ? `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${steamAppId}/logo.png`
      : fallbackLogoSvg);

  return {
    ...game,
    steamAppId,
    bannerUrl,
    logoUrl,
    fallbackBannerSvg,
    fallbackLogoSvg,
    monogram: getGameMonogram(game.title || game.name || 'Game'),
    baseRecFps: Number(game.baseRecFps) || 64,
    minimum: {
      ...game.minimum,
      cpuScore: minCpuScore,
      gpuScore: minGpuScore
    },
    recommended: {
      ...game.recommended,
      cpuScore: recCpuScore,
      gpuScore: recGpuScore
    }
  };
}

function getAllGames() {
  return GAMES_CATALOG.map(enrichGameScores);
}

function getGameById(id) {
  const found = GAMES_CATALOG.find((g) => g.id === id);
  return found ? enrichGameScores(found) : null;
}

function getAllGenres() {
  return Array.from(new Set(GAMES_CATALOG.map((g) => g.genre))).sort();
}

module.exports = {
  STEAM_APP_ID_MAP,
  GAMES_CATALOG,
  getAllGames,
  getGameById,
  getAllGenres,
  enrichGameScores,
  buildFallbackBannerSvg,
  buildFallbackLogoSvg,
  getGameMonogram
};
