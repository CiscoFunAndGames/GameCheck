/**
 * Analyzes PC specs against a game's requirements and computes:
 * 1. Can I Run It verdict (Cannot Run / Minimum / Recommended / Ultra Ready)
 * 2. Component pass/fail breakdown & bottleneck detection
 * 3. Optimal in-game graphics configuration & estimated FPS at 1080p / 1440p / 4K
 */

function evaluateComponent(userScore, minScore, recScore) {
  if (userScore >= recScore * 1.15) return 'EXCEEDS_RECOMMENDED';
  if (userScore >= recScore * 0.95) return 'MEETS_RECOMMENDED';
  if (userScore >= minScore * 0.95) return 'MEETS_MINIMUM';
  return 'BELOW_MINIMUM';
}

function estimateFpsForResolution(specs, game, resolutionFactor) {
  // Base FPS at 1080p High when user matches Recommended specs (higher for competitive shooters/racers)
  const baseTarget = game.id === 'counter-strike-2' ? 210 : game.id === 'forza-horizon-5' ? 95 : 64;
  const gpuRatio = specs.gpu.score / Math.max(15, game.recommended.gpuScore);
  const cpuRatio = specs.cpu.score / Math.max(15, game.recommended.cpuScore);

  // At higher resolutions, GPU weight increases
  const gpuWeight = resolutionFactor === 1 ? 0.72 : resolutionFactor === 1.35 ? 0.84 : 0.92;
  const cpuWeight = 1 - gpuWeight;

  const combinedRatio = (gpuRatio / resolutionFactor) * gpuWeight + cpuRatio * cpuWeight;

  // VRAM penalty if game needs more VRAM than available at higher resolution
  const estVramNeeded = game.recommended.vramGB * (resolutionFactor === 1 ? 0.9 : resolutionFactor === 1.35 ? 1.15 : 1.45);
  const vramPenalty = specs.gpu.vramGB < estVramNeeded ? 0.78 : 1.0;

  const baseFps = Math.round(baseTarget * combinedRatio * vramPenalty);
  const lowFps = Math.max(12, Math.round(baseFps * 0.85));
  const highFps = Math.max(18, Math.round(baseFps * 1.12));

  return {
    avg: baseFps,
    range: `${lowFps} - ${highFps} FPS`
  };
}

function buildOptimalSettings(specs, game, overallTier) {
  const gpuRatio = specs.gpu.score / Math.max(15, game.recommended.gpuScore);
  const vramGB = specs.gpu.vramGB;
  const upscalerName = specs.gpu.vendor === 'nvidia' && game.supportsUpscaling.includes('DLSS')
    ? 'NVIDIA DLSS'
    : game.supportsUpscaling.includes('FSR')
      ? 'AMD FSR'
      : game.supportsUpscaling[0] || 'Native';

  let targetResolution = '1920x1080 (1080p)';
  let preset = 'Medium';
  let upscalingMode = 'Off (Native)';
  let textures = 'Medium';
  let shadows = 'Medium';
  let rayTracing = 'Off';
  let frameGen = 'Off';

  if (overallTier === 'BELOW_MINIMUM') {
    targetResolution = '1920x1080 (or 720p)';
    preset = 'Low';
    upscalingMode = upscalerName !== 'Native' ? `${upscalerName} - Performance` : '75% Render Scale';
    textures = vramGB >= 6 ? 'Medium' : 'Low';
    shadows = 'Low';
  } else if (overallTier === 'MEETS_MINIMUM') {
    targetResolution = '1920x1080 (1080p)';
    preset = 'Medium';
    upscalingMode = upscalerName !== 'Native' ? `${upscalerName} - Quality` : 'Off (Native)';
    textures = vramGB >= 8 ? 'High' : 'Medium';
    shadows = 'Medium';
  } else if (overallTier === 'MEETS_RECOMMENDED') {
    targetResolution = '1920x1080 (1080p)';
    preset = 'High';
    upscalingMode = gpuRatio >= 1.15 || upscalerName === 'Native'
      ? 'Off (Native 100%)'
      : `${upscalerName} - Quality`;
    textures = vramGB >= 8 ? 'High' : 'Medium';
    shadows = 'High';
    if (specs.gpu.upscaler === 'FSR 3' || specs.gpu.upscaler === 'DLSS 3') {
      frameGen = 'Optional (Enable for 120Hz+ monitors)';
    }
  } else {
    // EXCEEDS_RECOMMENDED
    if (gpuRatio >= 1.45 && vramGB >= 12) {
      targetResolution = '2560x1440 (1440p)';
      preset = 'Ultra';
      upscalingMode = upscalerName !== 'Native' ? `${upscalerName} - Quality` : 'Off (Native)';
      textures = 'Ultra';
      shadows = 'High / Ultra';
      rayTracing = game.supportsRT && specs.gpu.rtCapable ? 'Medium / High' : 'Off';
    } else {
      targetResolution = gpuRatio >= 1.3 ? '1080p Ultra / 1440p High' : '1920x1080 (1080p)';
      preset = 'High / Ultra Custom';
      upscalingMode = gpuRatio >= 1.25 ? 'Off (Native) at 1080p / Quality at 1440p' : `${upscalerName} - Quality`;
      textures = vramGB >= 10 ? 'Ultra' : 'High (Safe for 8GB VRAM)';
      shadows = 'High';
      rayTracing = game.supportsRT && specs.gpu.rtCapable && gpuRatio >= 1.5 ? 'Low / Medium' : 'Off (Recommended for max FPS)';
      if (specs.gpu.upscaler === 'FSR 3' || specs.gpu.upscaler === 'DLSS 3') {
        frameGen = 'On (for 100+ FPS smoothness)';
      }
    }
  }

  const fps1080p = estimateFpsForResolution(specs, game, 1.0);
  const fps1440p = estimateFpsForResolution(specs, game, 1.35);
  const fps4k = estimateFpsForResolution(specs, game, 2.05);

  return {
    targetResolution,
    preset,
    upscalingMode,
    textures,
    shadows,
    rayTracing,
    frameGen,
    estimatedFps: {
      '1080p': fps1080p,
      '1440p': fps1440p,
      '4K': fps4k
    },
    tuningTips: game.tuningTips || []
  };
}

function analyzeGameCompatibility(specs, game) {
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

  // Determine primary bottleneck
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

  const optimalConfig = buildOptimalSettings(specs, game, overallTier);

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
    optimalConfig
  };
}

module.exports = {
  analyzeGameCompatibility
};
