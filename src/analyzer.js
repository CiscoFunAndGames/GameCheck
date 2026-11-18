/**
 * Analyzes PC specs & Primary Display against a game's requirements and computes:
 * 1. Can I Run It verdict (Cannot Run / Minimum / Recommended / Ultra Ready)
 * 2. Component pass/fail breakdown & bottleneck detection
 * 3. Screen-Aware Optimal Graphics Configurations across 4 modes:
 *    - `optimal`       : Smart Rig + Screen Optimal (Default)
 *    - `full_fps`      : Full FPS (Max Hz / Competitive)
 *    - `balanced`      : Balanced (FPS & Visual Quality)
 *    - `quality_30_60` : Quality (30–60 FPS Cinematic)
 */

const OPTIMIZATION_MODES = {
  optimal: {
    id: 'optimal',
    label: '🎯 Optimal (Rig + Screen)',
    shortLabel: 'Optimal'
  },
  full_fps: {
    id: 'full_fps',
    label: '🚀 Full FPS (Max Hz)',
    shortLabel: 'Full FPS'
  },
  balanced: {
    id: 'balanced',
    label: '⚖️ Balanced (FPS & Quality)',
    shortLabel: 'Balanced'
  },
  quality_30_60: {
    id: 'quality_30_60',
    label: '🎬 Quality (30–60 FPS)',
    shortLabel: 'Quality (30–60 FPS)'
  }
};

function normalizeOptimizationMode(mode = 'optimal') {
  const m = String(mode || 'optimal').toLowerCase().trim().replace(/-/g, '_');
  if (m === 'full_fps' || m === 'fullfps' || m === 'max_fps' || m === 'competitive') return 'full_fps';
  if (m === 'balanced' || m === 'balance') return 'balanced';
  if (m === 'quality_30_60' || m === 'quality' || m === 'cinematic' || m === '30_60') return 'quality_30_60';
  return 'optimal';
}

function evaluateComponent(userScore, minScore, recScore) {
  if (userScore >= recScore * 1.15) return 'EXCEEDS_RECOMMENDED';
  if (userScore >= recScore * 0.95) return 'MEETS_RECOMMENDED';
  if (userScore >= minScore * 0.95) return 'MEETS_MINIMUM';
  return 'BELOW_MINIMUM';
}

function resolveDisplaySpec(specs, targetDisplayOverride = null) {
  const raw = targetDisplayOverride || specs?.display || {};
  const width = Math.max(640, Number(raw.width) || 1920);
  const height = Math.max(480, Number(raw.height) || 1080);
  const refreshRateHz = Math.max(30, Math.round(Number(raw.refreshRateHz) || 60));
  const pixels = width * height;
  const tier = raw.tier || (height >= 2000 || width >= 3400 || pixels >= 6000000
    ? '4K'
    : (height >= 1350 || width >= 2400 || pixels >= 3000000 ? '1440p' : '1080p'));
  const name = raw.name || 'Primary Display';
  const deviceName = raw.deviceName || 'DISPLAY1';
  const aspectRatio = raw.aspectRatio || '16:9';
  const vrrCapable = raw.vrrCapable !== undefined ? Boolean(raw.vrrCapable) : refreshRateHz >= 75;

  return {
    name,
    deviceName,
    width,
    height,
    tier,
    refreshRateHz,
    aspectRatio,
    vrrCapable,
    resolutionLabel: `${width}x${height} (${tier})`
  };
}

function getResolutionFactorForPixels(width, height) {
  const basePixels = 1920 * 1080;
  const actualPixels = Math.max(1280 * 720, (Number(width) || 1920) * (Number(height) || 1080));
  const pixelRatio = actualPixels / basePixels;
  if (Math.abs(pixelRatio - 1) < 0.08) return 1.0;
  if (Math.abs(pixelRatio - (2560 * 1440) / basePixels) < 0.15) return 1.35;
  if (pixelRatio >= 3.5) return 2.05;
  return Number(Math.pow(pixelRatio, 0.58).toFixed(2));
}

function estimateFpsForResolution(specs, game, resolutionFactor, modeMultiplier = 1.0) {
  const baseTarget = Number(game.baseRecFps) || (game.id === 'counter-strike-2' ? 210 : game.id === 'forza-horizon-5' ? 95 : 64);
  const gpuRatio = specs.gpu.score / Math.max(15, game.recommended.gpuScore);
  const cpuRatio = specs.cpu.score / Math.max(15, game.recommended.cpuScore);

  const gpuWeight = resolutionFactor <= 1.05 ? 0.72 : resolutionFactor <= 1.45 ? 0.84 : 0.92;
  const cpuWeight = 1 - gpuWeight;

  const combinedRatio = (gpuRatio / resolutionFactor) * gpuWeight + cpuRatio * cpuWeight;

  const estVramNeeded = game.recommended.vramGB * (resolutionFactor <= 1.05 ? 0.9 : resolutionFactor <= 1.45 ? 1.15 : 1.45);
  const vramPenalty = specs.gpu.vramGB < estVramNeeded ? 0.78 : 1.0;

  const baseFps = Math.max(15, Math.round(baseTarget * combinedRatio * vramPenalty * modeMultiplier));
  const lowFps = Math.max(12, Math.round(baseFps * 0.85));
  const highFps = Math.max(18, Math.round(baseFps * 1.12));

  return {
    avg: baseFps,
    low: lowFps,
    high: highFps,
    range: `${lowFps} - ${highFps} FPS`
  };
}

function selectPreferredUpscaler(specs, game) {
  const upscalers = Array.isArray(game?.supportsUpscaling) && game.supportsUpscaling.length > 0
    ? game.supportsUpscaling
    : ['Native'];
  if (specs.gpu.vendor === 'nvidia' && upscalers.includes('DLSS')) return 'NVIDIA DLSS';
  if (upscalers.includes('FSR')) return 'AMD FSR';
  if (upscalers.includes('XeSS')) return 'Intel XeSS';
  return upscalers[0] || 'Native';
}

function buildModeProfile(modeKey, specs, game, overallTier, display) {
  const gpuRatio = specs.gpu.score / Math.max(15, game.recommended.gpuScore);
  const vramGB = specs.gpu.vramGB;
  const upscalerName = selectPreferredUpscaler(specs, game);
  const hasTemporalUpscaler = upscalerName !== 'Native';
  const supportsFG = /dlss\s*[34]|fsr\s*[34]/i.test(specs.gpu.upscaler || '') && vramGB >= 8;
  const screenResFactor = getResolutionFactorForPixels(display.width, display.height);
  const baselineScreenFps = estimateFpsForResolution(specs, game, screenResFactor, 1.0).avg;
  const vrrCapTarget = display.refreshRateHz >= 100 ? display.refreshRateHz - 4 : display.refreshRateHz;

  let preset = 'High';
  let targetResolution = `${display.width}x${display.height} (${display.tier} @ ${display.refreshRateHz}Hz)`;
  let upscalingMode = 'Off (Native)';
  let textures = vramGB >= 12 ? 'Ultra' : vramGB >= 8 ? 'High' : vramGB >= 6 ? 'Medium' : 'Low';
  let shadows = 'High';
  let rayTracing = 'Off';
  let frameGen = 'Off';
  let fpsMultiplier = 1.0;
  let qualityScore = 82;
  let targetFpsWindow = '60 - 120 FPS';
  let fpsCapAdvice = `Cap at ${vrrCapTarget} FPS with VRR (${specs.gpu.vendor === 'nvidia' ? 'G-Sync + Reflex' : 'FreeSync + Anti-Lag'})`;
  let summary = '';

  if (modeKey === 'full_fps') {
    // Mode 2: Full FPS (Max Hz / Competitive)
    preset = overallTier === 'EXCEEDS_RECOMMENDED' ? 'Medium / Competitive High' : 'Low / Competitive';
    upscalingMode = hasTemporalUpscaler
      ? (baselineScreenFps < display.refreshRateHz * 0.75 ? `${upscalerName} - Performance` : `${upscalerName} - Balanced`)
      : '85% Render Scale';
    textures = vramGB >= 8 ? 'High (Zero FPS Cost)' : vramGB >= 6 ? 'Medium' : 'Low';
    shadows = 'Low';
    rayTracing = 'Off (Disabled for Max FPS & Lowest Latency)';
    frameGen = supportsFG && display.refreshRateHz >= 120 && baselineScreenFps >= 55
      ? `On (Target ${display.refreshRateHz}Hz Saturation)`
      : 'Off (Lowest Input Latency)';
    fpsMultiplier = frameGen.startsWith('On') ? 1.52 : 1.34;
    qualityScore = 64;
    targetFpsWindow = `${Math.min(display.refreshRateHz, Math.max(90, display.refreshRateHz - 10))}+ FPS (Max ${display.refreshRateHz}Hz)`;
    fpsCapAdvice = display.refreshRateHz >= 120
      ? `Cap at ${display.refreshRateHz - 3} FPS + ${specs.gpu.vendor === 'nvidia' ? 'NVIDIA Reflex (+Boost)' : 'AMD Anti-Lag 2'} to saturate ${display.refreshRateHz}Hz VRR`
      : `Uncapped or ${display.refreshRateHz * 2} FPS cap for minimum frame delivery latency`;
    summary = `Tuned for maximum framerate and lowest input latency on ${display.name} (${display.width}x${display.height} @ ${display.refreshRateHz}Hz).`;
  } else if (modeKey === 'balanced') {
    // Mode 3: Balanced (FPS & Visual Quality)
    preset = overallTier === 'BELOW_MINIMUM' ? 'Low / Medium' : overallTier === 'MEETS_MINIMUM' ? 'Medium' : 'High';
    upscalingMode = hasTemporalUpscaler
      ? `${upscalerName} - Quality`
      : 'Off (Native 100%)';
    textures = vramGB >= 10 ? 'Ultra' : vramGB >= 8 ? 'High' : 'Medium';
    shadows = overallTier === 'BELOW_MINIMUM' ? 'Low' : 'Medium';
    rayTracing = 'Off (Rasterized High Lighting)';
    frameGen = supportsFG && display.refreshRateHz >= 120
      ? 'Optional (Enable for 100+ FPS smoothness)'
      : 'Off';
    fpsMultiplier = hasTemporalUpscaler ? 1.15 : 1.06;
    qualityScore = 82;
    targetFpsWindow = display.refreshRateHz >= 120 ? '75 - 120 FPS' : '60 - 75 FPS';
    fpsCapAdvice = `Lock at ${Math.min(vrrCapTarget, 120)} FPS with VRR enabled for consistent frame times`;
    summary = `Balanced sweet-spot between crisp High visuals and smooth ${targetFpsWindow} gameplay at ${display.width}x${display.height}.`;
  } else if (modeKey === 'quality_30_60') {
    // Mode 4: Quality (30-60 FPS Cinematic)
    if (overallTier === 'BELOW_MINIMUM') {
      preset = 'Medium (Cinematic Floor)';
      upscalingMode = hasTemporalUpscaler ? `${upscalerName} - Quality` : '90% Render Scale';
      shadows = 'Medium';
      rayTracing = 'Off';
      fpsMultiplier = 0.92;
      qualityScore = 76;
    } else if (overallTier === 'MEETS_MINIMUM') {
      preset = 'High';
      upscalingMode = hasTemporalUpscaler ? `${upscalerName} - Quality` : 'Off (Native 100%)';
      shadows = 'High';
      rayTracing = 'Off';
      fpsMultiplier = 0.88;
      qualityScore = 86;
    } else {
      preset = 'Ultra';
      const needsQualityUpscaleFor30 = baselineScreenFps * 0.78 < 38 && hasTemporalUpscaler;
      upscalingMode = needsQualityUpscaleFor30
        ? `${upscalerName} - Quality`
        : hasTemporalUpscaler
          ? `Off (Native ${display.tier}) / ${upscalerName} Native AA`
          : `Off (Native ${display.tier})`;
      textures = vramGB >= 10 ? 'Ultra' : 'High (Safe for 8GB VRAM)';
      shadows = 'Ultra';
      rayTracing = game.supportsRT && specs.gpu.rtCapable && vramGB >= 8 && baselineScreenFps >= 55
        ? (vramGB >= 12 ? 'High (Ray-Traced GI & Reflections)' : 'Medium (RT Reflections)')
        : 'Off';
      fpsMultiplier = rayTracing !== 'Off' ? 0.72 : (needsQualityUpscaleFor30 ? 0.9 : 0.82);
      qualityScore = rayTracing !== 'Off' ? 98 : 94;
    }
    frameGen = 'Off (Native Cinematic Frame Pacing)';
    targetFpsWindow = '30 - 60 FPS (Cinematic Fidelity)';
    fpsCapAdvice = baselineScreenFps * fpsMultiplier >= 58
      ? 'Lock at 60 FPS (16.6ms frame-time) for rock-steady cinematic presentation'
      : 'Lock at 40 FPS (on 120Hz+ VRR screen) or 30/45 FPS for zero frame-time judder';
    summary = `Maximizes Ultra/High visual fidelity at ${display.width}x${display.height} while maintaining a stable 30–60 FPS cinematic target.`;
  } else {
    // Mode 1: Optimal (Smart Rig + Screen Default)
    const isHighHzScreen = display.refreshRateHz >= 120;
    if (overallTier === 'BELOW_MINIMUM') {
      targetResolution = `${display.width}x${display.height} (or 1280x720)`;
      preset = 'Low';
      upscalingMode = hasTemporalUpscaler ? `${upscalerName} - Performance` : '75% Render Scale';
      textures = vramGB >= 6 ? 'Medium' : 'Low';
      shadows = 'Low';
      fpsMultiplier = 1.25;
      qualityScore = 60;
    } else if (overallTier === 'MEETS_MINIMUM') {
      preset = 'Medium';
      upscalingMode = hasTemporalUpscaler ? `${upscalerName} - Quality` : 'Off (Native)';
      textures = vramGB >= 8 ? 'High' : 'Medium';
      shadows = 'Medium';
      fpsMultiplier = 1.12;
      qualityScore = 75;
    } else if (overallTier === 'MEETS_RECOMMENDED') {
      preset = 'High';
      upscalingMode = (gpuRatio >= 1.15 && !isHighHzScreen) || !hasTemporalUpscaler
        ? 'Off (Native 100%)'
        : `${upscalerName} - Quality`;
      textures = vramGB >= 8 ? 'High' : 'Medium';
      shadows = isHighHzScreen && baselineScreenFps < 90 ? 'Medium / High' : 'High';
      if (supportsFG && isHighHzScreen) {
        frameGen = `Optional (Enable for ${display.refreshRateHz}Hz monitor)`;
      }
      fpsMultiplier = upscalingMode.includes('Quality') ? 1.12 : 1.0;
      qualityScore = 85;
    } else {
      // EXCEEDS_RECOMMENDED
      if (gpuRatio >= 1.45 && vramGB >= 12) {
        preset = 'Ultra';
        upscalingMode = hasTemporalUpscaler && (isHighHzScreen || display.tier !== '1080p')
          ? `${upscalerName} - Quality`
          : 'Off (Native)';
        textures = 'Ultra';
        shadows = 'High / Ultra';
        rayTracing = game.supportsRT && specs.gpu.rtCapable && !isHighHzScreen ? 'Medium / High' : 'Off';
        fpsMultiplier = 1.05;
        qualityScore = 93;
      } else {
        preset = 'High / Ultra Custom';
        upscalingMode = gpuRatio >= 1.25 && !isHighHzScreen
          ? 'Off (Native) at 1080p / Quality at 1440p'
          : `${upscalerName} - Quality`;
        textures = vramGB >= 10 ? 'Ultra' : 'High (Safe for 8GB VRAM)';
        shadows = 'High';
        rayTracing = game.supportsRT && specs.gpu.rtCapable && gpuRatio >= 1.5 && !isHighHzScreen
          ? 'Low / Medium'
          : 'Off (Recommended for max FPS)';
        if (supportsFG && isHighHzScreen) {
          frameGen = `On (for 100-${display.refreshRateHz} FPS smoothness)`;
          fpsMultiplier = 1.22;
        } else {
          fpsMultiplier = 1.08;
        }
        qualityScore = 88;
      }
    }
    targetFpsWindow = isHighHzScreen ? `80 - ${display.refreshRateHz} FPS` : '60+ FPS';
    fpsCapAdvice = isHighHzScreen
      ? `Enable VRR (FreeSync/G-Sync) + cap at ${vrrCapTarget} FPS on ${display.name} (${display.refreshRateHz}Hz)`
      : `Lock at ${display.refreshRateHz} FPS or enable VRR for tear-free pacing`;
    summary = `Auto-tuned for ${specs.gpu.name} (${vramGB}GB) paired with your ${display.name} (${display.width}x${display.height} @ ${display.refreshRateHz}Hz).`;
  }

  let estimatedScreenFps = estimateFpsForResolution(specs, game, screenResFactor, fpsMultiplier);
  if (modeKey === 'quality_30_60' && estimatedScreenFps.avg > 60) {
    // In Quality 30-60 mode, note that native rendering easily hits the 60 FPS ceiling
    fpsCapAdvice = `Lock at 60 FPS (rig achieves ~${estimatedScreenFps.avg} FPS uncapped at ${display.tier} Ultra)`;
  }

  const refreshSaturationPct = Math.min(100, Math.max(10, Math.round((estimatedScreenFps.avg / display.refreshRateHz) * 100)));

  return {
    mode: modeKey,
    label: OPTIMIZATION_MODES[modeKey].label,
    shortLabel: OPTIMIZATION_MODES[modeKey].shortLabel,
    targetResolution,
    preset,
    upscalingMode,
    textures,
    shadows,
    rayTracing,
    frameGen,
    fpsCapAdvice,
    targetFpsWindow,
    estimatedScreenFps,
    refreshSaturationPct,
    qualityScore,
    fpsMultiplier,
    summary
  };
}

function buildOptimalSettings(specs, game, overallTier, options = {}) {
  const activeMode = normalizeOptimizationMode(options.optimizationMode);
  const display = resolveDisplaySpec(specs, options.targetDisplay);

  const modeProfiles = {
    optimal: buildModeProfile('optimal', specs, game, overallTier, display),
    full_fps: buildModeProfile('full_fps', specs, game, overallTier, display),
    balanced: buildModeProfile('balanced', specs, game, overallTier, display),
    quality_30_60: buildModeProfile('quality_30_60', specs, game, overallTier, display)
  };

  const selected = modeProfiles[activeMode] || modeProfiles.optimal;
  const mult = selected.fpsMultiplier || 1.0;

  const fps1080p = estimateFpsForResolution(specs, game, 1.0, mult);
  const fps1440p = estimateFpsForResolution(specs, game, 1.35, mult);
  const fps4k = estimateFpsForResolution(specs, game, 2.05, mult);

  const displayTarget = {
    monitorName: display.name,
    deviceName: display.deviceName,
    width: display.width,
    height: display.height,
    tier: display.tier,
    aspectRatio: display.aspectRatio,
    resolutionLabel: display.resolutionLabel,
    refreshRateHz: display.refreshRateHz,
    vrrCapable: display.vrrCapable,
    targetFpsWindow: selected.targetFpsWindow,
    estimatedScreenFps: selected.estimatedScreenFps,
    refreshSaturationPct: selected.refreshSaturationPct,
    fpsCapAdvice: selected.fpsCapAdvice,
    syncAdvice: display.refreshRateHz >= 100
      ? `Enable FreeSync / G-Sync VRR + ${specs.gpu.vendor === 'nvidia' ? 'NVIDIA Reflex' : 'AMD Anti-Lag 2'} and cap FPS at ${display.refreshRateHz - 4} FPS.`
      : `Use VRR or a ${display.refreshRateHz} FPS cap for tear-free frame pacing.`
  };

  return {
    activeMode,
    activeModeLabel: selected.label,
    targetResolution: selected.targetResolution,
    preset: selected.preset,
    upscalingMode: selected.upscalingMode,
    textures: selected.textures,
    shadows: selected.shadows,
    rayTracing: selected.rayTracing,
    frameGen: selected.frameGen,
    fpsCapAdvice: selected.fpsCapAdvice,
    qualityScore: selected.qualityScore,
    summary: selected.summary,
    displayTarget,
    modeProfiles,
    estimatedFps: {
      '1080p': fps1080p,
      '1440p': fps1440p,
      '4K': fps4k
    },
    tuningTips: game.tuningTips || []
  };
}

function buildDriverAppRecommendations(specs, game, mode = 'optimal') {
  const modeKey = normalizeOptimizationMode(mode);
  const gpuName = String(specs?.gpu?.name || '');
  const gpuLow = gpuName.toLowerCase();
  const cpuLow = String(specs?.cpu?.name || '').toLowerCase();
  let gpuVendor = String(specs?.gpu?.vendor || '').toLowerCase();
  if (!gpuVendor || gpuVendor === 'unknown') {
    if (/nvidia|geforce|rtx|gtx/.test(gpuLow)) gpuVendor = 'nvidia';
    else if (/amd|radeon|\brx\s*\d/.test(gpuLow)) gpuVendor = 'amd';
    else if (/intel|\barc\b|uhd|iris/.test(gpuLow)) gpuVendor = 'intel';
  }

  const suites = Array.isArray(specs?.driverSuites) ? specs.driverSuites : [];
  const findStatus = (id) => {
    const found = suites.find((s) => s.id === id && s.detected);
    return found ? found.installStatus : 'DRIVER_ONLY';
  };

  const display = resolveDisplaySpec(specs);
  const hz = Number(display?.refreshRateHz) > 0 ? Number(display.refreshRateHz) : 60;
  const capHz = Math.max(30, hz - 3);
  const vrr = Boolean(display?.vrrCapable);

  const titleLow = String(game?.title || '').toLowerCase();
  const genreLow = String(game?.genre || '').toLowerCase();
  const isCompetitive = /shooter|fps|tactical|esports|battle royale|counter-strike|cs2|valorant|apex|warzone|overwatch|fortnite/.test(`${genreLow} ${titleLow}`);

  let suiteName = 'Intel Arc Control / Graphics Software';
  let suiteStatus = findStatus('intel_arc');
  const settings = [];

  if (gpuVendor === 'amd') {
    suiteName = 'AMD Software: Adrenalin Edition';
    suiteStatus = findStatus('amd_adrenalin');
    settings.push({
      setting: 'Radeon Anti-Lag / Anti-Lag 2',
      recommendedValue: modeKey === 'quality_30_60' ? 'Enabled (Anti-Lag)' : 'Enabled (Anti-Lag 2 if supported)',
      reason: 'Cuts input-to-photon latency with zero FPS penalty.'
    });

    let chillVal = 'Off';
    let chillReason = 'Uncapped FPS for minimum input latency in Full FPS mode.';
    if (modeKey === 'quality_30_60') {
      chillVal = `Min: 30 / Max: ${Math.min(60, capHz)} FPS`;
      chillReason = 'Locks frame pacing to cinematic 30-60 FPS envelope.';
    } else if (modeKey === 'optimal' || modeKey === 'balanced') {
      chillVal = vrr ? `Min: 48 / Max: ${capHz} FPS` : `Min: 60 / Max: ${hz} FPS`;
      chillReason = vrr
        ? `Caps 3 FPS below ${hz}Hz to stay inside FreeSync VRR window.`
        : `Matches ${hz}Hz refresh rate to reduce power & heat.`;
    }
    settings.push({ setting: 'Radeon Chill', recommendedValue: chillVal, reason: chillReason });
    settings.push({
      setting: 'AMD FreeSync / VRR',
      recommendedValue: vrr ? 'Enabled (AMD FreeSync)' : 'Off (No VRR Display)',
      reason: vrr ? 'Eliminates tearing without V-Sync input lag.' : 'Display reported fixed refresh rate.'
    });

    const allowAfmf = !isCompetitive && modeKey !== 'full_fps';
    settings.push({
      setting: 'AMD Fluid Motion Frames 2 (AFMF 2)',
      recommendedValue: allowAfmf ? 'Auto (Enable if base FPS < 60)' : 'Off',
      reason: allowAfmf ? 'Boosts perceived smoothness on demanding AAA titles.' : 'Disabled to preserve raw responsiveness in fast/competitive play.'
    });
    settings.push({
      setting: 'Radeon Image Sharpening (RIS)',
      recommendedValue: (modeKey === 'full_fps' || modeKey === 'balanced') ? 'Enabled (70-80%)' : 'Enabled (50%)',
      reason: 'Restores texture crispness when FSR upscaling is active (<1% cost).'
    });
    settings.push({
      setting: 'Texture Filtering Quality',
      recommendedValue: modeKey === 'full_fps' ? 'Performance' : (modeKey === 'quality_30_60' ? 'High' : 'Standard'),
      reason: 'Balances anisotropic sharpness vs. shader bandwidth.'
    });
    settings.push({
      setting: 'Wait for Vertical Refresh',
      recommendedValue: 'Always Off',
      reason: 'Prevents driver-level V-Sync latency; rely on FreeSync + Chill cap.'
    });
    const hasRyzen5k7k = /ryzen/.test(cpuLow) && /(5500|5600|5700|5800|5900|5950|7500|7600|7700|7800|7900|7950|9600|9700|9800)/.test(cpuLow);
    const hasRx6k7k = /rx\s*[679]\d{3}/.test(gpuLow);
    settings.push({
      setting: 'AMD Smart Access Memory (SAM)',
      recommendedValue: (hasRyzen5k7k && hasRx6k7k) ? 'Enabled (Verify Above 4G + ReBAR in BIOS)' : 'Check BIOS ReBAR Support',
      reason: (hasRyzen5k7k && hasRx6k7k) ? 'Ryzen + RX 6000/7000 pairing gains 5-15% FPS via full VRAM BAR.' : 'Enable Resizable BAR in BIOS if supported.'
    });
  } else if (gpuVendor === 'nvidia') {
    suiteName = 'NVIDIA App / Control Panel';
    suiteStatus = findStatus('nvidia_app');
    settings.push({
      setting: 'Low Latency Mode / NVIDIA Reflex',
      recommendedValue: (modeKey === 'full_fps' || isCompetitive) ? 'Ultra (or Reflex On + Boost)' : 'On (or Reflex On)',
      reason: 'Minimizes render queue depth and mouse-to-display latency.'
    });
    let capVal = 'Off (Uncapped)';
    if (modeKey === 'quality_30_60') capVal = '60 FPS';
    else if (modeKey === 'optimal' || modeKey === 'balanced') {
      capVal = vrr ? `${capHz} FPS (Hz - 3)` : `${hz} FPS`;
    }
    settings.push({
      setting: 'Max Frame Rate',
      recommendedValue: capVal,
      reason: vrr ? `Keeps frame rate inside G-Sync range below ${hz}Hz.` : 'Aligns frame pacing with monitor refresh rate.'
    });
    settings.push({
      setting: 'Power Management Mode',
      recommendedValue: 'Prefer Maximum Performance',
      reason: 'Prevents GPU boost clock downclocking during light scenes.'
    });
    settings.push({
      setting: 'Texture Filtering - Quality',
      recommendedValue: modeKey === 'full_fps' ? 'High Performance' : (modeKey === 'quality_30_60' ? 'High Quality' : 'Quality'),
      reason: 'Optimizes shader filtering overhead without visible shimmer.'
    });
    settings.push({
      setting: 'Vertical Sync (NVCP)',
      recommendedValue: (vrr && modeKey !== 'full_fps') ? 'On (Paired with G-Sync + Cap)' : 'Off',
      reason: vrr ? 'NVCP V-Sync + G-Sync + Hz-3 cap eliminates tearing with zero V-Sync lag.' : 'Avoids double-buffer V-Sync latency.'
    });
    settings.push({
      setting: 'Shader Cache Size',
      recommendedValue: '10 GB',
      reason: 'Prevents shader compilation stutter in DX12 / Unreal Engine 5 games.'
    });
    settings.push({
      setting: 'G-Sync / VRR',
      recommendedValue: vrr ? 'Enabled (Fullscreen & Windowed)' : 'Off (No VRR Display)',
      reason: vrr ? 'Dynamic refresh synchronization for tear-free pacing.' : 'Display reported fixed refresh rate.'
    });
  } else {
    settings.push({
      setting: 'Resizable BAR',
      recommendedValue: 'Enabled (Mandatory for Arc)',
      reason: 'Intel Arc requires BIOS ReBAR + Above 4G Decoding for full performance.'
    });
    settings.push({
      setting: 'Low Latency Mode',
      recommendedValue: (modeKey === 'full_fps' || isCompetitive) ? 'On + Boost' : 'On',
      reason: 'Reduces CPU-to-GPU frame queue latency.'
    });
    settings.push({
      setting: 'Adaptive Sync / VRR',
      recommendedValue: vrr ? `Enabled (Cap ${capHz} FPS)` : 'Off (Fixed Refresh)',
      reason: vrr ? 'Synchronizes display refresh to frame output.' : 'Fixed refresh display detected.'
    });
    settings.push({
      setting: 'Texture Filtering',
      recommendedValue: modeKey === 'full_fps' ? 'Performance' : 'Quality',
      reason: 'Balances anisotropic clarity and memory bandwidth.'
    });
    settings.push({
      setting: 'Smooth Sync',
      recommendedValue: modeKey === 'full_fps' ? 'Off' : 'On (if tearing occurs)',
      reason: 'Reduces visible tearing on non-VRR monitors without full V-Sync stall.'
    });
  }

  const reqGB = Number(game?.storageGB) || 50;
  const drives = Array.isArray(specs?.storage?.allDrives) && specs.storage.allDrives.length > 0
    ? specs.storage.allDrives
    : (Array.isArray(specs?.drives) ? specs.drives : []);
  let storageAdvice = `Primary drive ${specs?.storage?.drive || 'C:'} has ${specs?.storage?.freeGB ?? 0} GB free (${reqGB} GB required).`;
  if (drives.length > 0) {
    let bestFit = null;
    let largest = drives[0];
    for (const d of drives) {
      if ((d.freeGB || 0) > (largest.freeGB || 0)) largest = d;
      if ((d.freeGB || 0) >= reqGB) {
        if (!bestFit) {
          bestFit = d;
        } else {
          const curIsOs = d.drive === 'C:' || d.drive === '/';
          const bestIsOs = bestFit.drive === 'C:' || bestFit.drive === '/';
          if ((bestIsOs && !curIsOs) || (curIsOs === bestIsOs && (d.freeGB || 0) > (bestFit.freeGB || 0))) {
            bestFit = d;
          }
        }
      }
    }
    if (bestFit) {
      storageAdvice = `Install on ${bestFit.drive} (${bestFit.label || bestFit.drive}) — ${bestFit.freeGB} GB free >= ${reqGB} GB required${game?.ssdRequired ? ' (SSD recommended).' : '.'}`;
    } else {
      storageAdvice = `Warning: Need ${reqGB} GB free; largest drive ${largest.drive} only has ${largest.freeGB} GB free.`;
    }
  }

  return {
    suiteName,
    suiteStatus,
    summary: `Tuned for ${gpuName || 'GPU'} on ${hz}Hz${vrr ? ' VRR' : ' Fixed-Hz'} display.`,
    settings,
    storageAdvice
  };
}

function analyzeGameCompatibility(specs, game, options = {}) {
  const cpuStatus = evaluateComponent(specs.cpu.score, game.minimum.cpuScore, game.recommended.cpuScore);
  const gpuStatus = evaluateComponent(specs.gpu.score, game.minimum.gpuScore, game.recommended.gpuScore);
  const ramStatus = evaluateComponent(specs.ram.totalGB, game.minimum.ramGB, game.recommended.ramGB);
  const vramStatus = evaluateComponent(specs.gpu.vramGB, game.minimum.vramGB, game.recommended.vramGB);
  const storagePass = specs.storage.freeGB >= game.storageGB;

  const rankOrder = ['BELOW_MINIMUM', 'MEETS_MINIMUM', 'MEETS_RECOMMENDED', 'EXCEEDS_RECOMMENDED'];
  const minRankIndex = Math.min(
    rankOrder.indexOf(cpuStatus),
    rankOrder.indexOf(gpuStatus),
    rankOrder.indexOf(ramStatus),
    rankOrder.indexOf(vramStatus)
  );
  const overallTier = rankOrder[minRankIndex];

  const ratios = [
    { component: 'GPU Compute', ratio: specs.gpu.score / game.recommended.gpuScore, detail: specs.gpu.name },
    { component: 'GPU VRAM', ratio: specs.gpu.vramGB / game.recommended.vramGB, detail: `${specs.gpu.vramGB} GB VRAM` },
    { component: 'CPU', ratio: specs.cpu.score / game.recommended.cpuScore, detail: specs.cpu.name },
    { component: 'System RAM', ratio: specs.ram.totalGB / game.recommended.ramGB, detail: `${specs.ram.totalGB} GB RAM` }
  ].sort((a, b) => a.ratio - b.ratio);

  const limitingFactor = ratios[0];
  let bottleneckNote = '';
  if (limitingFactor.ratio < 1.0) {
    bottleneckNote = `Your ${limitingFactor.component} (${limitingFactor.detail}) is the primary limiting factor against Recommended specs.`;
  } else {
    bottleneckNote = `All components meet or exceed Recommended specs! At higher resolutions/settings, ${limitingFactor.component} (${limitingFactor.detail}) will be the first component fully utilized.`;
  }

  const optimalConfig = buildOptimalSettings(specs, game, overallTier, options);
  const driverAdvisor = buildDriverAppRecommendations(specs, game, options.optimizationMode || 'optimal');

  return {
    gameId: game.id,
    gameTitle: game.title,
    overallTier,
    canRunMinimum: minRankIndex >= 1,
    canRunRecommended: minRankIndex >= 2,
    storagePass,
    bottleneck: {
      limitingComponent: limitingFactor.component,
      note: bottleneckNote
    },
    components: {
      cpu: {
        status: cpuStatus,
        userValue: `${specs.cpu.name} (${specs.cpu.threads} threads)`,
        userScore: specs.cpu.score,
        minRequired: game.minimum.cpu,
        minScore: game.minimum.cpuScore,
        recRequired: game.recommended.cpu,
        recScore: game.recommended.cpuScore
      },
      gpu: {
        status: gpuStatus,
        userValue: `${specs.gpu.name} (${specs.gpu.vramGB} GB)`,
        userScore: specs.gpu.score,
        minRequired: game.minimum.gpu,
        minScore: game.minimum.gpuScore,
        recRequired: game.recommended.gpu,
        recScore: game.recommended.gpuScore
      },
      vram: {
        status: vramStatus,
        userValue: `${specs.gpu.vramGB} GB`,
        minRequired: `${game.minimum.vramGB} GB`,
        recRequired: `${game.recommended.vramGB} GB`
      },
      ram: {
        status: ramStatus,
        userValue: `${specs.ram.totalGB} GB`,
        minRequired: `${game.minimum.ramGB} GB`,
        recRequired: `${game.recommended.ramGB} GB`
      },
      storage: {
        status: storagePass ? 'MEETS_RECOMMENDED' : 'BELOW_MINIMUM',
        userValue: `${specs.storage.freeGB} GB Free (${specs.storage.drive})`,
        required: `${game.storageGB} GB (${game.ssdRequired ? 'SSD Required' : 'HDD/SSD'})`
      }
    },
    optimalConfig,
    driverAdvisor
  };
}

module.exports = {
  analyzeGameCompatibility,
  buildDriverAppRecommendations,
  OPTIMIZATION_MODES,
  normalizeOptimizationMode,
  resolveDisplaySpec
};
