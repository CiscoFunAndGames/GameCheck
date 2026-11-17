const os = require('os');
const fs = require('fs');
const { execSync } = require('child_process');

/**
 * Normalized 0-100 Benchmark Score Table & Heuristic Estimator for CPUs and GPUs
 * Allows comparing real detected hardware (or Steam requirement strings) on a common scale.
 */
const GPU_BENCHMARKS = [
  // NVIDIA GTX 900 / 1000 / 1600
  { pattern: /gt\s*710|gt\s*730/i, score: 8, vram: 2, vendor: 'nvidia' },
  { pattern: /gtx\s*750/i, score: 15, vram: 2, vendor: 'nvidia' },
  { pattern: /gtx\s*960/i, score: 22, vram: 4, vendor: 'nvidia' },
  { pattern: /gtx\s*970/i, score: 28, vram: 4, vendor: 'nvidia' },
  { pattern: /gtx\s*1050\s*ti/i, score: 24, vram: 4, vendor: 'nvidia' },
  { pattern: /gtx\s*1050/i, score: 20, vram: 2, vendor: 'nvidia' },
  { pattern: /gtx\s*1060/i, score: 33, vram: 6, vendor: 'nvidia' },
  { pattern: /gtx\s*1070/i, score: 42, vram: 8, vendor: 'nvidia' },
  { pattern: /gtx\s*1080\s*ti/i, score: 54, vram: 11, vendor: 'nvidia' },
  { pattern: /gtx\s*1080/i, score: 47, vram: 8, vendor: 'nvidia' },
  { pattern: /gtx\s*1650/i, score: 29, vram: 4, vendor: 'nvidia' },
  { pattern: /gtx\s*1660\s*(super|ti)/i, score: 40, vram: 6, vendor: 'nvidia' },
  { pattern: /gtx\s*1660/i, score: 36, vram: 6, vendor: 'nvidia' },

  // NVIDIA RTX 2000
  { pattern: /rtx\s*2060\s*super/i, score: 50, vram: 8, vendor: 'nvidia', rt: true, upscaler: 'DLSS' },
  { pattern: /rtx\s*2060/i, score: 45, vram: 6, vendor: 'nvidia', rt: true, upscaler: 'DLSS' },
  { pattern: /rtx\s*2070\s*super/i, score: 56, vram: 8, vendor: 'nvidia', rt: true, upscaler: 'DLSS' },
  { pattern: /rtx\s*2070/i, score: 52, vram: 8, vendor: 'nvidia', rt: true, upscaler: 'DLSS' },
  { pattern: /rtx\s*2080\s*ti/i, score: 66, vram: 11, vendor: 'nvidia', rt: true, upscaler: 'DLSS' },
  { pattern: /rtx\s*2080/i, score: 59, vram: 8, vendor: 'nvidia', rt: true, upscaler: 'DLSS' },

  // NVIDIA RTX 3000
  { pattern: /rtx\s*3050/i, score: 43, vram: 8, vendor: 'nvidia', rt: true, upscaler: 'DLSS' },
  { pattern: /rtx\s*3060\s*ti/i, score: 63, vram: 8, vendor: 'nvidia', rt: true, upscaler: 'DLSS' },
  { pattern: /rtx\s*3060/i, score: 54, vram: 12, vendor: 'nvidia', rt: true, upscaler: 'DLSS' },
  { pattern: /rtx\s*3070\s*ti/i, score: 71, vram: 8, vendor: 'nvidia', rt: true, upscaler: 'DLSS' },
  { pattern: /rtx\s*3070/i, score: 68, vram: 8, vendor: 'nvidia', rt: true, upscaler: 'DLSS' },
  { pattern: /rtx\s*3080\s*ti/i, score: 83, vram: 12, vendor: 'nvidia', rt: true, upscaler: 'DLSS' },
  { pattern: /rtx\s*3080/i, score: 79, vram: 10, vendor: 'nvidia', rt: true, upscaler: 'DLSS' },
  { pattern: /rtx\s*3090/i, score: 86, vram: 24, vendor: 'nvidia', rt: true, upscaler: 'DLSS' },

  // NVIDIA RTX 4000 / 5000
  { pattern: /rtx\s*4060\s*ti/i, score: 70, vram: 8, vendor: 'nvidia', rt: true, upscaler: 'DLSS 3' },
  { pattern: /rtx\s*4060/i, score: 62, vram: 8, vendor: 'nvidia', rt: true, upscaler: 'DLSS 3' },
  { pattern: /rtx\s*4070\s*ti\s*super/i, score: 87, vram: 16, vendor: 'nvidia', rt: true, upscaler: 'DLSS 3' },
  { pattern: /rtx\s*4070\s*super/i, score: 82, vram: 12, vendor: 'nvidia', rt: true, upscaler: 'DLSS 3' },
  { pattern: /rtx\s*4070\s*ti/i, score: 84, vram: 12, vendor: 'nvidia', rt: true, upscaler: 'DLSS 3' },
  { pattern: /rtx\s*4070/i, score: 77, vram: 12, vendor: 'nvidia', rt: true, upscaler: 'DLSS 3' },
  { pattern: /rtx\s*4080/i, score: 92, vram: 16, vendor: 'nvidia', rt: true, upscaler: 'DLSS 3' },
  { pattern: /rtx\s*4090/i, score: 100, vram: 24, vendor: 'nvidia', rt: true, upscaler: 'DLSS 3' },
  { pattern: /rtx\s*5070/i, score: 86, vram: 12, vendor: 'nvidia', rt: true, upscaler: 'DLSS 4' },
  { pattern: /rtx\s*5080/i, score: 96, vram: 16, vendor: 'nvidia', rt: true, upscaler: 'DLSS 4' },
  { pattern: /rtx\s*5090/i, score: 105, vram: 32, vendor: 'nvidia', rt: true, upscaler: 'DLSS 4' },

  // AMD Radeon RX 400 / 500 / 5000
  { pattern: /rx\s*470|rx\s*570/i, score: 29, vram: 4, vendor: 'amd', upscaler: 'FSR' },
  { pattern: /rx\s*480|rx\s*580/i, score: 33, vram: 8, vendor: 'amd', upscaler: 'FSR' },
  { pattern: /rx\s*590/i, score: 36, vram: 8, vendor: 'amd', upscaler: 'FSR' },
  { pattern: /rx\s*5500\s*xt/i, score: 36, vram: 8, vendor: 'amd', upscaler: 'FSR' },
  { pattern: /rx\s*5600\s*xt/i, score: 46, vram: 6, vendor: 'amd', upscaler: 'FSR' },
  { pattern: /rx\s*5700\s*xt/i, score: 53, vram: 8, vendor: 'amd', upscaler: 'FSR' },
  { pattern: /rx\s*5700/i, score: 49, vram: 8, vendor: 'amd', upscaler: 'FSR' },

  // AMD Radeon RX 6000
  { pattern: /rx\s*6500\s*xt/i, score: 35, vram: 4, vendor: 'amd', rt: false, upscaler: 'FSR' },
  { pattern: /rx\s*6600\s*xt|rx\s*6650\s*xt/i, score: 57, vram: 8, vendor: 'amd', rt: true, upscaler: 'FSR' },
  { pattern: /rx\s*6600/i, score: 51, vram: 8, vendor: 'amd', rt: true, upscaler: 'FSR' },
  { pattern: /rx\s*6700\s*xt|rx\s*6750\s*xt/i, score: 66, vram: 12, vendor: 'amd', rt: true, upscaler: 'FSR' },
  { pattern: /rx\s*6700/i, score: 61, vram: 10, vendor: 'amd', rt: true, upscaler: 'FSR' },
  { pattern: /rx\s*6800\s*xt/i, score: 77, vram: 16, vendor: 'amd', rt: true, upscaler: 'FSR' },
  { pattern: /rx\s*6800/i, score: 72, vram: 16, vendor: 'amd', rt: true, upscaler: 'FSR' },
  { pattern: /rx\s*6900\s*xt|rx\s*6950\s*xt/i, score: 82, vram: 16, vendor: 'amd', rt: true, upscaler: 'FSR' },

  // AMD Radeon RX 7000 / 9000
  { pattern: /rx\s*7600\s*xt/i, score: 64, vram: 16, vendor: 'amd', rt: true, upscaler: 'FSR 3' },
  { pattern: /rx\s*7600/i, score: 61, vram: 8, vendor: 'amd', rt: true, upscaler: 'FSR 3' },
  { pattern: /rx\s*7700\s*xt/i, score: 73, vram: 12, vendor: 'amd', rt: true, upscaler: 'FSR 3' },
  { pattern: /rx\s*7800\s*xt/i, score: 80, vram: 16, vendor: 'amd', rt: true, upscaler: 'FSR 3' },
  { pattern: /rx\s*7900\s*gre/i, score: 83, vram: 16, vendor: 'amd', rt: true, upscaler: 'FSR 3' },
  { pattern: /rx\s*7900\s*xtx/i, score: 94, vram: 24, vendor: 'amd', rt: true, upscaler: 'FSR 3' },
  { pattern: /rx\s*7900\s*xt/i, score: 88, vram: 20, vendor: 'amd', rt: true, upscaler: 'FSR 3' },
  { pattern: /rx\s*9070\s*xt/i, score: 89, vram: 16, vendor: 'amd', rt: true, upscaler: 'FSR 4' },
  { pattern: /rx\s*9070/i, score: 83, vram: 16, vendor: 'amd', rt: true, upscaler: 'FSR 4' },

  // Intel Arc
  { pattern: /arc\s*a380/i, score: 27, vram: 6, vendor: 'intel', rt: true, upscaler: 'XeSS' },
  { pattern: /arc\s*a580/i, score: 48, vram: 8, vendor: 'intel', rt: true, upscaler: 'XeSS' },
  { pattern: /arc\s*a750/i, score: 54, vram: 8, vendor: 'intel', rt: true, upscaler: 'XeSS' },
  { pattern: /arc\s*a770/i, score: 58, vram: 16, vendor: 'intel', rt: true, upscaler: 'XeSS' },
  { pattern: /arc\s*b580/i, score: 66, vram: 12, vendor: 'intel', rt: true, upscaler: 'XeSS' }
];

const CPU_BENCHMARKS = [
  // AMD Ryzen
  { pattern: /ryzen\s*3\s*1[23]00|fx-\s*83/i, score: 25, cores: 4 },
  { pattern: /ryzen\s*5\s*1[456]00/i, score: 38, cores: 6 },
  { pattern: /ryzen\s*5\s*2600/i, score: 45, cores: 6 },
  { pattern: /ryzen\s*7\s*2700/i, score: 50, cores: 8 },
  { pattern: /ryzen\s*3\s*3[13]00/i, score: 46, cores: 4 },
  { pattern: /ryzen\s*5\s*3600/i, score: 58, cores: 6 },
  { pattern: /ryzen\s*7\s*3700x|ryzen\s*7\s*3800x/i, score: 64, cores: 8 },
  { pattern: /ryzen\s*5\s*5500/i, score: 62, cores: 6 },
  { pattern: /ryzen\s*5\s*5600/i, score: 72, cores: 6 },
  { pattern: /ryzen\s*7\s*5700x3d|ryzen\s*7\s*5800x3d/i, score: 88, cores: 8 },
  { pattern: /ryzen\s*7\s*5700x|ryzen\s*7\s*5800x/i, score: 78, cores: 8 },
  { pattern: /ryzen\s*9\s*5900x|ryzen\s*9\s*5950x/i, score: 82, cores: 12 },
  { pattern: /ryzen\s*5\s*7600/i, score: 84, cores: 6 },
  { pattern: /ryzen\s*7\s*7700/i, score: 88, cores: 8 },
  { pattern: /ryzen\s*7\s*7800x3d/i, score: 97, cores: 8 },
  { pattern: /ryzen\s*7\s*9800x3d/i, score: 100, cores: 8 },
  { pattern: /ryzen\s*9\s*79[05]0|ryzen\s*9\s*99[05]0/i, score: 94, cores: 12 },

  // Intel Core
  { pattern: /i5-[234]\d{3}|i7-[23]\d{3}/i, score: 25, cores: 4 },
  { pattern: /i7-47[79]0|i5-6[56]00|i5-7[456]00/i, score: 34, cores: 4 },
  { pattern: /i7-6700|i7-7700/i, score: 42, cores: 4 },
  { pattern: /i5-8[46]00|i5-9[46]00/i, score: 48, cores: 6 },
  { pattern: /i7-8700|i7-9700/i, score: 58, cores: 6 },
  { pattern: /i5-10[46]00|i5-11[46]00/i, score: 60, cores: 6 },
  { pattern: /i7-10700|i7-11700|i9-9900/i, score: 68, cores: 8 },
  { pattern: /i3-12100|i3-13100/i, score: 58, cores: 4 },
  { pattern: /i5-12[46]00/i, score: 74, cores: 6 },
  { pattern: /i7-12700/i, score: 83, cores: 12 },
  { pattern: /i5-13[46]00|i5-14[46]00/i, score: 84, cores: 10 },
  { pattern: /i7-13700|i7-14700|i9-12900/i, score: 91, cores: 16 },
  { pattern: /i9-13900|i9-14900/i, score: 95, cores: 24 }
];

function scoreGPU(name = '', vramGB = null) {
  for (const item of GPU_BENCHMARKS) {
    if (item.pattern.test(name)) {
      return {
        score: item.score,
        vramGB: vramGB || item.vram || 4,
        vendor: item.vendor,
        rtCapable: Boolean(item.rt),
        upscaler: item.upscaler || 'FSR'
      };
    }
  }
  // Fallback heuristic based on VRAM if unknown model
  const fallbackVram = vramGB || 4;
  const estScore = Math.min(85, Math.max(15, fallbackVram * 7));
  return {
    score: estScore,
    vramGB: fallbackVram,
    vendor: /nvidia|rtx|gtx/i.test(name) ? 'nvidia' : /amd|radeon|rx/i.test(name) ? 'amd' : 'unknown',
    rtCapable: /rtx|rx\s*[6789]\d00|arc/i.test(name),
    upscaler: /rtx/i.test(name) ? 'DLSS' : 'FSR'
  };
}

function scoreCPU(name = '', threads = 8) {
  for (const item of CPU_BENCHMARKS) {
    if (item.pattern.test(name)) {
      return {
        score: item.score,
        estimatedCores: item.cores
      };
    }
  }
  const estScore = Math.min(90, Math.max(25, threads * 4.5));
  return {
    score: Math.round(estScore),
    estimatedCores: Math.max(2, Math.floor(threads / 2))
  };
}

function detectGPUsFromWindowsRegistry() {
  try {
    const cmd = `powershell -NoProfile -Command "Get-ItemProperty 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}\\0*' -ErrorAction SilentlyContinue | Select-Object DriverDesc, DriverVersion, @{N='VRAM_MB';E={[math]::Round($_.'HardwareInformation.qwMemorySize'/1MB)}} | ConvertTo-Json"`;
    const out = execSync(cmd, { encoding: 'utf8', timeout: 4000 });
    if (!out || !out.trim()) return [];
    const parsed = JSON.parse(out);
    const list = Array.isArray(parsed) ? parsed : [parsed];
    // Filter out virtual/remote display adapters when a real GPU exists
    const valid = list
      .filter((g) => g && g.DriverDesc)
      .map((g) => ({
        name: g.DriverDesc.trim(),
        driverVersion: g.DriverVersion || 'Unknown',
        vramMB: Number(g.VRAM_MB) || 0,
        vramGB: Math.max(0, Math.round((Number(g.VRAM_MB) || 0) / 1024))
      }));

    // Sort by VRAM descending and real GPU priority
    valid.sort((a, b) => {
      const aVirtual = /virtual|meta|basic|parsec|remote/i.test(a.name) ? 0 : 1;
      const bVirtual = /virtual|meta|basic|parsec|remote/i.test(b.name) ? 0 : 1;
      if (aVirtual !== bVirtual) return bVirtual - aVirtual;
      return b.vramMB - a.vramMB;
    });
    return valid;
  } catch (e) {
    return [];
  }
}

function detectStorageDrives() {
  const drives = [];
  if (typeof fs.statfsSync === 'function') {
    for (const letter of ['C', 'D', 'E', 'F', 'G', 'H']) {
      try {
        const stats = fs.statfsSync(`${letter}:\\`);
        if (stats && stats.blocks > 0) {
          const freeGB = Math.round((stats.bavail * stats.bsize) / (1024 ** 3));
          const totalGB = Math.round((stats.blocks * stats.bsize) / (1024 ** 3));
          drives.push({ drive: `${letter}:`, freeGB, totalGB });
        }
      } catch (e) {
        // drive not present
      }
    }
  }
  if (drives.length === 0) {
    return {
      drive: 'C:',
      freeGB: 150,
      totalGB: 500,
      allDrives: [{ drive: 'C:', freeGB: 150, totalGB: 500 }]
    };
  }
  const bestDrive = [...drives].sort((a, b) => b.freeGB - a.freeGB)[0];
  return {
    drive: bestDrive.drive,
    freeGB: bestDrive.freeGB,
    totalGB: bestDrive.totalGB,
    allDrives: drives
  };
}

function detectSystemSpecs() {
  const cpus = os.cpus() || [];
  const cpuModel = (cpus[0]?.model || 'Unknown CPU').trim();
  const threads = cpus.length || 4;
  const baseSpeedMHz = cpus[0]?.speed || 3000;
  const totalRamGB = Math.round(os.totalmem() / (1024 ** 3));
  const freeRamGB = Math.round(os.freemem() / (1024 ** 3));

  const gpus = detectGPUsFromWindowsRegistry();
  const primaryGpu = gpus[0] || {
    name: 'Integrated / Unknown GPU',
    driverVersion: 'N/A',
    vramMB: 2048,
    vramGB: 2
  };

  const cpuEval = scoreCPU(cpuModel, threads);
  const gpuEval = scoreGPU(primaryGpu.name, primaryGpu.vramGB);
  const storage = detectStorageDrives();

  const osRelease = os.release();
  const buildNum = parseInt(osRelease.split('.')[2] || '0', 10);
  const osName = os.platform() === 'win32'
    ? (buildNum >= 22000 ? `Windows 11 (Build ${buildNum})` : `Windows 10 (Build ${buildNum})`)
    : `${os.type()} ${osRelease}`;

  return {
    detectedAt: new Date().toISOString(),
    os: osName,
    cpu: {
      name: cpuModel,
      cores: cpuEval.estimatedCores,
      threads,
      speedGHz: Number((baseSpeedMHz / 1000).toFixed(2)),
      score: cpuEval.score
    },
    gpu: {
      name: primaryGpu.name,
      vramGB: gpuEval.vramGB,
      vramMB: primaryGpu.vramMB,
      driverVersion: primaryGpu.driverVersion,
      vendor: gpuEval.vendor,
      rtCapable: gpuEval.rtCapable,
      upscaler: gpuEval.upscaler,
      score: gpuEval.score,
      allDetected: gpus
    },
    ram: {
      totalGB: totalRamGB,
      freeGB: freeRamGB
    },
    storage: {
      drive: storage.drive,
      freeGB: storage.freeGB,
      totalGB: storage.totalGB,
      allDrives: storage.allDrives
    }
  };
}

module.exports = {
  detectSystemSpecs,
  scoreCPU,
  scoreGPU,
  GPU_BENCHMARKS,
  CPU_BENCHMARKS
};
