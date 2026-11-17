const { scoreCPU, scoreGPU } = require('./hardware');

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
    minimum: {
      cpu: 'Intel i5-4690 or AMD FX 8350',
      gpu: 'Nvidia GTX 970 or RX 480',
      ramGB: 8,
      vramGB: 4
    },
    recommended: {
      cpu: 'Intel i7 8700K or AMD r5 3600',
      gpu: 'Nvidia 2060 Super or RX 5700 XT',
      ramGB: 16,
      vramGB: 8
    },
    tuningTips: [
      'Act 3 (Lower City) is CPU-intensive; enable "Dynamic Crowds" only if your CPU has 8+ fast cores (like Ryzen 7 5800X).',
      'Use DirectX 11 or Vulkan depending on stability; Vulkan often performs very well on AMD Radeon RX 7000 GPUs.'
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
      'Set "Texture Quality" to Ultra (it looks drastically better and easily fits in 8GB VRAM).',
      'Keep "Water Physics Quality" at 50% and "Tree Tessellation" Off for a huge +25% FPS gain.'
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
      'Lower "Space Quality" and "Volumetric Fog" to Medium for +20% higher framerates during intense bug/bot drops.'
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
    minimum: {
      cpu: 'Intel Core i5 750 or AMD Ryzen 3 1200',
      gpu: 'GTX 1050 or RX 560',
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
      'Enable AMD Anti-Lag or NVIDIA Reflex Low Latency.'
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
      'On 8GB VRAM GPUs, use Medium/High Preset at 1080p with FSR Quality and keep Ray Tracing Off to avoid VRAM overflow.'
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
      'Set "Environment Texture Quality" to High (Extreme requires 10GB+ VRAM).'
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
      'Enable FSR 3 Quality + Frame Generation to double smoothness from ~60 FPS to ~100+ FPS.'
    ]
  }
];

function enrichGameScores(game) {
  const minCpuScore = scoreCPU(game.minimum.cpu).score;
  const minGpuScore = scoreGPU(game.minimum.gpu, game.minimum.vramGB).score;
  const recCpuScore = scoreCPU(game.recommended.cpu).score;
  const recGpuScore = scoreGPU(game.recommended.gpu, game.recommended.vramGB).score;

  return {
    ...game,
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

module.exports = {
  getAllGames,
  getGameById,
  enrichGameScores
};
