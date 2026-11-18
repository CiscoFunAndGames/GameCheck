const { analyzeGameCompatibility, normalizeOptimizationMode, buildDriverAppRecommendations } = require('./analyzer');

/**
 * Computes per-setting FPS gain (%) and VRAM impact (MB) tailored to the user's
 * detected GPU, VRAM, CPU, Display, and active Optimization Mode against the selected game.
 */
function getPerSettingImpact(specs, game, analysis, options = {}) {
  const resolvedAnalysis = analysis || analyzeGameCompatibility(specs, game, options);
  const baseOptimal = resolvedAnalysis.optimalConfig || {};
  const activeMode = options.optimizationMode
    ? normalizeOptimizationMode(options.optimizationMode)
    : (baseOptimal.activeMode || 'optimal');

  const optimal = (baseOptimal.modeProfiles && baseOptimal.modeProfiles[activeMode])
    ? { ...baseOptimal, ...baseOptimal.modeProfiles[activeMode], activeMode }
    : baseOptimal;

  const gpu = specs?.gpu || { name: 'Generic GPU', score: 45, vramGB: 6, vendor: 'unknown', rtCapable: false, upscaler: 'FSR' };
  const cpu = specs?.cpu || { name: 'Generic CPU', score: 50, cores: 6, threads: 12 };
  const display = baseOptimal.displayTarget || specs?.display || { monitorName: 'Primary Display', width: 1920, height: 1080, refreshRateHz: 60 };
  const recGpuScore = Math.max(15, game?.recommended?.gpuScore || 50);
  const recCpuScore = Math.max(15, game?.recommended?.cpuScore || 50);
  const recVramGB = Math.max(2, game?.recommended?.vramGB || 6);

  const gpuRatio = gpu.score / recGpuScore;
  const cpuRatio = cpu.score / recCpuScore;
  const vramHeadroomGB = gpu.vramGB - recVramGB;

  const supportsRT = Boolean(game?.supportsRT);
  const upscalers = Array.isArray(game?.supportsUpscaling) && game.supportsUpscaling.length > 0
    ? game.supportsUpscaling
    : ['Native'];
  const supportsUpscaling = !(upscalers.length === 1 && upscalers[0] === 'Native');
  const preferredUpscaler = gpu.vendor === 'nvidia' && upscalers.includes('DLSS')
    ? 'NVIDIA DLSS'
    : upscalers.includes('FSR')
      ? 'AMD FSR'
      : upscalers.includes('XeSS')
        ? 'Intel XeSS'
        : upscalers[0] || 'Native';

  const supportsFrameGen = /dlss\s*[34]|fsr\s*[34]/i.test(gpu.upscaler || '');

  // 1. Shadow Quality
  const shadowValue = optimal.shadows
    || (activeMode === 'full_fps'
      ? 'Low'
      : activeMode === 'quality_30_60'
        ? 'Ultra'
        : gpuRatio >= 1.3 ? 'High / Ultra' : gpuRatio >= 0.95 ? 'High' : 'Medium');
  const shadowFpsGain = activeMode === 'full_fps' ? 24 : gpuRatio < 0.85 ? 22 : gpuRatio < 1.15 ? 16 : 11;
  const shadowVramMB = shadowValue.includes('Low') ? 520 : shadowValue.includes('Medium') ? 380 : 240;

  // 2. Volumetric Fog / Clouds
  const fogValue = activeMode === 'full_fps'
    ? 'Low'
    : activeMode === 'quality_30_60'
      ? 'High / Ultra'
      : gpuRatio >= 1.35 ? 'High' : gpuRatio >= 0.9 ? 'Medium / High' : 'Low / Medium';
  const fogFpsGain = activeMode === 'full_fps' ? 21 : gpuRatio < 0.9 ? 19 : gpuRatio < 1.2 ? 15 : 10;
  const fogVramMB = 220;

  // 3. Ray Tracing
  let rtValue = optimal.rayTracing || 'Off';
  let rtFpsGain = 0;
  let rtVramMB = 0;
  let rtVisualCost = 'None';
  let rtNote = '';

  if (!supportsRT) {
    rtValue = 'Not Supported by Game';
    rtFpsGain = 0;
    rtVramMB = 0;
    rtVisualCost = 'None';
    rtNote = `${game.title} uses rasterized lighting only; no Ray Tracing overhead on ${gpu.name}.`;
  } else if (!gpu.rtCapable) {
    rtValue = 'Off (Hardware Unsupported)';
    rtFpsGain = 38;
    rtVramMB = 1250;
    rtVisualCost = 'Moderate';
    rtNote = `${gpu.name} lacks dedicated RT cores; keeping Ray Tracing Off avoids severe frame pacing stalls.`;
  } else if (activeMode === 'quality_30_60' && gpu.vramGB >= 8) {
    rtValue = optimal.rayTracing && optimal.rayTracing !== 'Off' ? optimal.rayTracing : 'Medium (Cinematic RT)';
    rtFpsGain = 22;
    rtVramMB = 1100;
    rtVisualCost = 'Low';
    rtNote = `Quality (30–60 FPS) mode enables ${rtValue} on ${gpu.name} for peak lighting fidelity.`;
  } else if (gpuRatio >= 1.45 && gpu.vramGB >= 12 && activeMode !== 'full_fps') {
    rtValue = 'Medium / High';
    rtFpsGain = 24;
    rtVramMB = 1100;
    rtVisualCost = 'Low-Medium';
    rtNote = `${gpu.name} (${gpu.vramGB} GB VRAM) has sufficient RT & VRAM headroom for hybrid Ray Tracing.`;
  } else {
    rtValue = activeMode === 'full_fps' ? 'Off (Disabled for Max Hz)' : 'Off (Recommended for FPS)';
    rtFpsGain = 34;
    rtVramMB = 1200;
    rtVisualCost = 'Moderate';
    rtNote = `Disabling RT on ${gpu.name} reclaims ~1.2 GB VRAM and boosts frame rate by ~${rtFpsGain}%.`;
  }

  // 4. Upscaling (FSR/DLSS)
  let upscalingValue = optimal.upscalingMode || 'Off (Native)';
  let upscalingFpsGain = 0;
  let upscalingVramMB = 0;
  let upscalingVisualCost = 'Minimal';
  let upscalingNote = '';

  if (!supportsUpscaling) {
    upscalingValue = activeMode === 'full_fps' ? '85% Render Scale' : 'Native (100% Scale)';
    upscalingFpsGain = activeMode === 'full_fps' || gpuRatio < 0.85 ? 18 : 0;
    upscalingVramMB = 180;
    upscalingVisualCost = 'Low';
    upscalingNote = `${game.title} does not include built-in temporal upscalers; use driver-level RSR/NIS if extra FPS is needed.`;
  } else {
    upscalingFpsGain = upscalingValue.includes('Performance')
      ? 38
      : upscalingValue.includes('Balanced')
        ? 29
        : gpuRatio < 0.85 ? 34 : 22;
    upscalingVramMB = 420;
    upscalingVisualCost = upscalingValue.includes('Performance') ? 'Low-Medium' : 'Minimal';
    upscalingNote = `${preferredUpscaler} (${upscalingValue}) reduces shader load at ${display.width}x${display.height} (${display.refreshRateHz}Hz).`;
  }

  // 5. Ambient Occlusion
  const aoValue = activeMode === 'full_fps'
    ? 'Low / Off'
    : activeMode === 'quality_30_60'
      ? 'HBAO+ / RTAO Ultra'
      : gpuRatio >= 1.1 ? 'HBAO+ / High' : gpuRatio >= 0.8 ? 'SSAO (Medium)' : 'Low / Off';
  const aoFpsGain = activeMode === 'full_fps' ? 12 : gpuRatio < 0.85 ? 10 : 7;
  const aoVramMB = 160;

  // 6. Texture Quality
  const textureValue = optimal.textures || (gpu.vramGB >= 12 ? 'Ultra' : gpu.vramGB >= 8 ? 'High' : gpu.vramGB >= 6 ? 'Medium' : 'Low');
  const textureFpsGain = vramHeadroomGB < 0 ? 18 : 3;
  const textureVramMB = gpu.vramGB >= 12 ? 1600 : gpu.vramGB >= 8 ? 1050 : 650;
  const textureVisualCost = vramHeadroomGB < 0 ? 'Moderate (Prevents Stutter)' : 'None (VRAM Bound)';
  const textureNote = vramHeadroomGB >= 0
    ? `Your ${gpu.vramGB} GB VRAM handles ${textureValue} textures without frame-time spikes (${recVramGB} GB recommended).`
    : `Lowering textures to ${textureValue} prevents PCIe VRAM spillover stutter on ${gpu.vramGB} GB VRAM (${recVramGB} GB recommended).`;

  // 7. Crowd / Foliage Density
  const crowdValue = activeMode === 'full_fps'
    ? (cpuRatio >= 1.2 ? 'Medium' : 'Low')
    : activeMode === 'quality_30_60'
      ? 'High / Ultra'
      : cpuRatio >= 1.15 ? 'High' : cpuRatio >= 0.9 ? 'Medium' : 'Low';
  const crowdFpsGain = activeMode === 'full_fps' ? 18 : cpuRatio < 0.95 ? 16 : 11;
  const crowdVramMB = 210;
  const crowdVisualCost = crowdValue === 'Low' ? 'Moderate' : 'Low';
  const crowdNote = cpuRatio < 1.0 || activeMode === 'full_fps'
    ? `Tuned to ${crowdValue} for ${cpu.name} (${cpu.threads} threads) to prevent 1% low drops and maximize ${display.refreshRateHz}Hz pacing.`
    : `${cpu.name} (${cpu.threads} threads) comfortably sustains ${crowdValue} simulation & draw-call density.`;

  // 8. Frame Generation
  let fgValue = optimal.frameGen || 'Off';
  let fgFpsGain = 0;
  let fgVramMB = 0;
  let fgVisualCost = 'Minimal';
  let fgNote = '';

  if (activeMode === 'quality_30_60') {
    fgValue = 'Off (Native 30–60 FPS Pacing)';
    fgFpsGain = 0;
    fgVramMB = 350;
    fgVisualCost = 'None';
    fgNote = 'Disabled in Quality (30–60 FPS) mode to avoid interpolation artifacts at lower base framerates.';
  } else if (supportsFrameGen && gpu.vramGB >= 8) {
    fgValue = optimal.frameGen && optimal.frameGen !== 'Off'
      ? optimal.frameGen
      : (gpuRatio >= 0.95 ? 'On (DLSS 3 / FSR 3 FG)' : 'Optional (Requires 55+ Base FPS)');
    fgFpsGain = 42;
    fgVramMB = 380;
    fgVisualCost = 'Minimal';
    fgNote = `${gpu.name} supports ${gpu.upscaler} Frame Generation; ideal for saturating ${display.refreshRateHz}Hz displays with Reflex/Anti-Lag.`;
  } else {
    fgValue = 'Off';
    fgFpsGain = 0;
    fgVramMB = 350;
    fgVisualCost = 'None';
    fgNote = gpu.vramGB < 8
      ? `Kept Off on ${gpu.vramGB} GB VRAM to reserve memory buffer for textures and frame pacing.`
      : `Use standard VRR / G-Sync / FreeSync pacing on ${gpu.name} for lowest input latency.`;
  }

  return [
    {
      setting: 'Shadow Quality',
      recommendedValue: shadowValue,
      fpsGainPercent: shadowFpsGain,
      vramImpactMB: shadowVramMB,
      visualCost: 'Low',
      note: `Dropping Cascade Shadows from Ultra to ${shadowValue} saves ~${shadowFpsGain}% GPU time on ${gpu.name}.`
    },
    {
      setting: 'Volumetric Fog / Clouds',
      recommendedValue: fogValue,
      fpsGainPercent: fogFpsGain,
      vramImpactMB: fogVramMB,
      visualCost: 'Minimal',
      note: `Volumetric ray-marching is heavy on pixel shaders; ${fogValue} preserves atmosphere while gaining +${fogFpsGain}% FPS.`
    },
    {
      setting: 'Ray Tracing',
      recommendedValue: rtValue,
      fpsGainPercent: rtFpsGain,
      vramImpactMB: rtVramMB,
      visualCost: rtVisualCost,
      note: rtNote
    },
    {
      setting: 'Upscaling (FSR/DLSS)',
      recommendedValue: upscalingValue,
      fpsGainPercent: upscalingFpsGain,
      vramImpactMB: upscalingVramMB,
      visualCost: upscalingVisualCost,
      note: upscalingNote
    },
    {
      setting: 'Ambient Occlusion',
      recommendedValue: aoValue,
      fpsGainPercent: aoFpsGain,
      vramImpactMB: aoVramMB,
      visualCost: 'Low',
      note: `${aoValue} balances contact shading depth and post-process cost (+${aoFpsGain}% FPS vs Ultra).`
    },
    {
      setting: 'Texture Quality',
      recommendedValue: textureValue,
      fpsGainPercent: textureFpsGain,
      vramImpactMB: textureVramMB,
      visualCost: textureVisualCost,
      note: textureNote
    },
    {
      setting: 'Crowd / Foliage Density',
      recommendedValue: crowdValue,
      fpsGainPercent: crowdFpsGain,
      vramImpactMB: crowdVramMB,
      visualCost: crowdVisualCost,
      note: crowdNote
    },
    {
      setting: 'Frame Generation',
      recommendedValue: fgValue,
      fpsGainPercent: fgFpsGain,
      vramImpactMB: fgVramMB,
      visualCost: fgVisualCost,
      note: fgNote
    }
  ];
}

function toQualityIndex(label = '') {
  const s = String(label).toLowerCase();
  if (s.includes('ultra')) return 3;
  if (s.includes('high')) return 2;
  if (s.includes('medium')) return 1;
  return 0;
}

function slugifyGame(game) {
  const raw = game?.id || game?.title || 'pc-game';
  return String(raw)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'pc-game';
}

/**
 * Generates downloadable configuration files (.ini, .json, .md) for a game, PC hardware profile,
 * active screen, and selected optimization mode.
 */
function exportGameConfigFiles(specs, game, analysis, options = {}) {
  const resolvedAnalysis = analysis || analyzeGameCompatibility(specs, game, options);
  const perSettingImpact = getPerSettingImpact(specs, game, resolvedAnalysis, options);
  const baseOptimal = resolvedAnalysis.optimalConfig || {};
  const activeMode = options.optimizationMode
    ? normalizeOptimizationMode(options.optimizationMode)
    : (baseOptimal.activeMode || 'optimal');
  const optimal = (baseOptimal.modeProfiles && baseOptimal.modeProfiles[activeMode])
    ? { ...baseOptimal, ...baseOptimal.modeProfiles[activeMode], activeMode }
    : baseOptimal;

  const displayTarget = optimal.displayTarget || specs?.display || {
    monitorName: 'Primary Display',
    width: 1920,
    height: 1080,
    refreshRateHz: 60,
    resolutionLabel: '1920x1080 (1080p)'
  };

  const slug = slugifyGame(game);
  const filenameBase = `${slug}-${activeMode.replace(/_/g, '-')}-settings`;

  const settingMap = {};
  for (const item of perSettingImpact) {
    settingMap[item.setting] = item;
  }

  const shadowIdx = toQualityIndex(settingMap['Shadow Quality']?.recommendedValue);
  const fogIdx = toQualityIndex(settingMap['Volumetric Fog / Clouds']?.recommendedValue);
  const texIdx = toQualityIndex(settingMap['Texture Quality']?.recommendedValue);
  const aoIdx = toQualityIndex(settingMap['Ambient Occlusion']?.recommendedValue);
  const crowdIdx = toQualityIndex(settingMap['Crowd / Foliage Density']?.recommendedValue);
  const rtEnabled = /medium|high|on|ultra/i.test(settingMap['Ray Tracing']?.recommendedValue || '') &&
    !/off|not|unsupported/i.test(settingMap['Ray Tracing']?.recommendedValue || '');
  const fgEnabled = /^on/i.test(settingMap['Frame Generation']?.recommendedValue || '');

  const resolutionMatch = (optimal.targetResolution || `${displayTarget.width}x${displayTarget.height}`).match(/(\d{3,5})x(\d{3,5})/);
  const resX = resolutionMatch ? Number(resolutionMatch[1]) : (displayTarget.width || 1920);
  const resY = resolutionMatch ? Number(resolutionMatch[2]) : (displayTarget.height || 1080);
  const hz = displayTarget.refreshRateHz || 60;

  const iniLines = [
    `; ============================================================================`,
    `; PC Game Compatibility & Screen-Aware Optimal Graphics Profile (.INI)`,
    `; Game: ${game.title} (${game.engine || 'Custom Engine'})`,
    `; Optimization Mode: ${optimal.label || activeMode.toUpperCase()}`,
    `; Generated For: ${specs.cpu.name} | ${specs.gpu.name} (${specs.gpu.vramGB} GB VRAM) | ${specs.ram.totalGB} GB RAM`,
    `; Target Display: ${displayTarget.monitorName || displayTarget.name} (${resX}x${resY} @ ${hz}Hz)`,
    `; Compatibility Verdict: ${resolvedAnalysis.overallTier}`,
    `; Estimated Screen FPS: ${optimal.estimatedScreenFps?.range || optimal.estimatedFps?.['1080p']?.range || '60 FPS'}`,
    `; ============================================================================`,
    ``,
    `[Display]`,
    `FullscreenMode=WindowedFullscreen`,
    `ResolutionSizeX=${resX}`,
    `ResolutionSizeY=${resY}`,
    `RefreshRateHz=${hz}`,
    `MonitorModel="${displayTarget.monitorName || displayTarget.name || 'Primary Display'}"`,
    `TargetResolution="${optimal.targetResolution || '1920x1080 (1080p)'}"`,
    `OptimizationMode="${activeMode}"`,
    `OverallPreset="${optimal.preset || 'High'}"`,
    `FrameRateCapAdvice="${optimal.fpsCapAdvice || ''}"`,
    `VSync=False`,
    `VariableRefreshRate=${hz >= 75 ? 'True' : 'False'}`,
    ``,
    `[Graphics.OptimalSettings]`,
    `ShadowQuality="${settingMap['Shadow Quality']?.recommendedValue}"`,
    `VolumetricFogClouds="${settingMap['Volumetric Fog / Clouds']?.recommendedValue}"`,
    `RayTracing="${settingMap['Ray Tracing']?.recommendedValue}"`,
    `UpscalingMode="${settingMap['Upscaling (FSR/DLSS)']?.recommendedValue}"`,
    `AmbientOcclusion="${settingMap['Ambient Occlusion']?.recommendedValue}"`,
    `TextureQuality="${settingMap['Texture Quality']?.recommendedValue}"`,
    `CrowdFoliageDensity="${settingMap['Crowd / Foliage Density']?.recommendedValue}"`,
    `FrameGeneration="${settingMap['Frame Generation']?.recommendedValue}"`,
    ``,
    `[ScalabilityGroups]`,
    `sg.ResolutionQuality=${/performance/i.test(optimal.upscalingMode || '') ? 58 : /balanced/i.test(optimal.upscalingMode || '') ? 62 : /quality/i.test(optimal.upscalingMode || '') ? 67 : 100}`,
    `sg.ViewDistanceQuality=${Math.max(1, crowdIdx)}`,
    `sg.AntiAliasingQuality=2`,
    `sg.ShadowQuality=${shadowIdx}`,
    `sg.GlobalIlluminationQuality=${rtEnabled ? 3 : Math.max(1, fogIdx)}`,
    `sg.ReflectionQuality=${rtEnabled ? 3 : Math.max(1, shadowIdx)}`,
    `sg.PostProcessQuality=${aoIdx}`,
    `sg.TextureQuality=${texIdx}`,
    `sg.EffectsQuality=${fogIdx}`,
    `sg.FoliageQuality=${crowdIdx}`,
    `sg.ShadingQuality=2`,
    ``,
    `[RayTracing]`,
    `r.RayTracing=${rtEnabled ? 1 : 0}`,
    `r.RayTracing.Shadows=${rtEnabled ? 1 : 0}`,
    `r.RayTracing.Reflections=${rtEnabled ? 1 : 0}`,
    `r.FrameGeneration.Enabled=${fgEnabled ? 1 : 0}`,
    `r.Streaming.PoolSize=${Math.max(2048, Math.round(specs.gpu.vramGB * 1024 * 0.72))}`
  ];

  const iniContent = iniLines.join('\n') + '\n';

  const jsonPayload = {
    schemaVersion: '2.0',
    generatedAt: new Date().toISOString(),
    optimizationMode: activeMode,
    optimizationModeLabel: optimal.label || activeMode,
    game: {
      id: game.id,
      title: game.title,
      genre: game.genre || 'PC Game',
      engine: game.engine || 'Standard',
      storageGB: game.storageGB,
      ssdRequired: Boolean(game.ssdRequired)
    },
    hardwareProfile: {
      os: specs.os,
      cpu: {
        name: specs.cpu.name,
        cores: specs.cpu.cores,
        threads: specs.cpu.threads,
        score: specs.cpu.score
      },
      gpu: {
        name: specs.gpu.name,
        vramGB: specs.gpu.vramGB,
        vendor: specs.gpu.vendor,
        rtCapable: specs.gpu.rtCapable,
        upscaler: specs.gpu.upscaler,
        score: specs.gpu.score
      },
      ramGB: specs.ram.totalGB,
      display: displayTarget
    },
    compatibility: {
      overallTier: resolvedAnalysis.overallTier,
      canRunMinimum: resolvedAnalysis.canRunMinimum,
      canRunRecommended: resolvedAnalysis.canRunRecommended,
      storagePass: resolvedAnalysis.storagePass,
      bottleneck: resolvedAnalysis.bottleneck
    },
    optimalConfig: optimal,
    perSettingImpact,
    driverSuites: Array.isArray(specs.driverSuites) ? specs.driverSuites : [],
    driverAdvisor: resolvedAnalysis.driverAdvisor || buildDriverAppRecommendations(specs, game, activeMode)
  };

  const jsonContent = JSON.stringify(jsonPayload, null, 2);

  const tipsSection = (optimal.tuningTips && optimal.tuningTips.length > 0)
    ? optimal.tuningTips.map((t) => `- ${t}`).join('\n')
    : `- Keep GPU drivers updated and enable Resizable BAR / Smart Access Memory in BIOS.`;

  const settingsTableRows = perSettingImpact
    .map(
      (s) =>
        `| **${s.setting}** | \`${s.recommendedValue}\` | +${s.fpsGainPercent}% FPS | ~${s.vramImpactMB} MB | ${s.visualCost} | ${s.note} |`
    )
    .join('\n');

  const drv = jsonPayload.driverAdvisor;
  const driverRows = (drv?.settings || [])
    .map((s) => `| **${s.setting}** | \`${s.recommendedValue}\` | ${s.reason} |`)
    .join('\n');

  const markdownGuide = [
    `# ${game.title} — Optimal PC Settings & Tuning Checklist`,
    ``,
    `> **Verdict**: \`${resolvedAnalysis.overallTier}\` • **Mode**: \`${optimal.label || activeMode}\`  `,
    `> **Hardware Profile**: ${specs.cpu.name} (${specs.cpu.threads}T) • ${specs.gpu.name} (${specs.gpu.vramGB} GB VRAM) • ${specs.ram.totalGB} GB RAM  `,
    `> **Target Display**: ${displayTarget.monitorName || displayTarget.name} (${resX}x${resY} @ ${hz}Hz)`,
    ``,
    `## 1. Target Display, Mode & Estimated Performance`,
    `- **Optimization Mode**: **${optimal.label || activeMode}** — ${optimal.summary || ''}`,
    `- **Recommended Resolution**: **${optimal.targetResolution || '1920x1080 (1080p)'}**`,
    `- **Base Preset**: **${optimal.preset || 'High'}**`,
    `- **Screen FPS (${resX}x${resY} @ ${hz}Hz)**: **${optimal.estimatedScreenFps?.avg || optimal.estimatedFps?.['1080p']?.avg || 60} FPS avg** (${optimal.estimatedScreenFps?.range || '50 - 70 FPS'})`,
    `- **Frame Pacing / VRR Advice**: ${optimal.fpsCapAdvice || ''}`,
    `- **1080p Estimate**: ${optimal.estimatedFps?.['1080p']?.avg || 60} FPS avg (${optimal.estimatedFps?.['1080p']?.range || '50 - 70 FPS'})`,
    `- **1440p Estimate**: ${optimal.estimatedFps?.['1440p']?.avg || 45} FPS avg (${optimal.estimatedFps?.['1440p']?.range || '38 - 52 FPS'})`,
    `- **4K Estimate**: ${optimal.estimatedFps?.['4K']?.avg || 30} FPS avg (${optimal.estimatedFps?.['4K']?.range || '24 - 35 FPS'})`,
    ``,
    `## 2. Per-Setting FPS Gain & VRAM Impact Breakdown`,
    `| Setting | Recommended Value | Est. FPS Gain | VRAM Impact | Visual Cost | Hardware Note |`,
    `| :--- | :--- | :--- | :--- | :--- | :--- |`,
    settingsTableRows,
    ``,
    `## 3. Bottleneck & Hardware Notes`,
    `- **Primary Limiting Factor**: **${resolvedAnalysis.bottleneck?.limitingComponent || 'GPU'}**`,
    `- ${resolvedAnalysis.bottleneck?.note || ''}`,
    ``,
    `## 4. Game-Specific Optimization Checklist`,
    tipsSection,
    ``,
    `## 5. GPU Driver App Configuration (${drv?.suiteName || 'GPU Driver'} [${drv?.suiteStatus || 'DRIVER_ONLY'}])`,
    `- **Profile Summary**: ${drv?.summary || ''}`,
    `- **Storage / Drive Placement**: ${drv?.storageAdvice || ''}`,
    ``,
    `| Driver Setting | Recommended Value | Reason |`,
    `| :--- | :--- | :--- |`,
    driverRows,
    ``
  ].join('\n');

  return {
    iniContent,
    jsonContent,
    markdownGuide,
    filenameBase
  };
}

module.exports = {
  getPerSettingImpact,
  exportGameConfigFiles
};
