const os = require('os');
const fs = require('fs');
const path = require('path');
const { execSync, execFileSync } = require('child_process');

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
  { pattern: /gtx\s*1070\s*ti/i, score: 45, vram: 8, vendor: 'nvidia' },
  { pattern: /gtx\s*1070/i, score: 42, vram: 8, vendor: 'nvidia' },
  { pattern: /gtx\s*1080\s*ti/i, score: 54, vram: 11, vendor: 'nvidia' },
  { pattern: /gtx\s*1080/i, score: 47, vram: 8, vendor: 'nvidia' },
  { pattern: /gtx\s*1650\s*super/i, score: 33, vram: 4, vendor: 'nvidia' },
  { pattern: /gtx\s*1650/i, score: 29, vram: 4, vendor: 'nvidia' },
  { pattern: /gtx\s*1660\s*(super|ti)/i, score: 40, vram: 6, vendor: 'nvidia' },
  { pattern: /gtx\s*1660/i, score: 36, vram: 6, vendor: 'nvidia' },

  // NVIDIA RTX 2000
  { pattern: /rtx\s*2060\s*super/i, score: 50, vram: 8, vendor: 'nvidia', rt: true, upscaler: 'DLSS' },
  { pattern: /rtx\s*2060/i, score: 45, vram: 6, vendor: 'nvidia', rt: true, upscaler: 'DLSS' },
  { pattern: /rtx\s*2070\s*super/i, score: 56, vram: 8, vendor: 'nvidia', rt: true, upscaler: 'DLSS' },
  { pattern: /rtx\s*2070/i, score: 52, vram: 8, vendor: 'nvidia', rt: true, upscaler: 'DLSS' },
  { pattern: /rtx\s*2080\s*ti/i, score: 66, vram: 11, vendor: 'nvidia', rt: true, upscaler: 'DLSS' },
  { pattern: /rtx\s*2080\s*super/i, score: 62, vram: 8, vendor: 'nvidia', rt: true, upscaler: 'DLSS' },
  { pattern: /rtx\s*2080/i, score: 59, vram: 8, vendor: 'nvidia', rt: true, upscaler: 'DLSS' },

  // NVIDIA RTX 3000
  { pattern: /rtx\s*3050/i, score: 43, vram: 8, vendor: 'nvidia', rt: true, upscaler: 'DLSS' },
  { pattern: /rtx\s*3060\s*ti/i, score: 63, vram: 8, vendor: 'nvidia', rt: true, upscaler: 'DLSS' },
  { pattern: /rtx\s*3060/i, score: 54, vram: 12, vendor: 'nvidia', rt: true, upscaler: 'DLSS' },
  { pattern: /rtx\s*3070\s*ti/i, score: 71, vram: 8, vendor: 'nvidia', rt: true, upscaler: 'DLSS' },
  { pattern: /rtx\s*3070/i, score: 68, vram: 8, vendor: 'nvidia', rt: true, upscaler: 'DLSS' },
  { pattern: /rtx\s*3080\s*ti/i, score: 83, vram: 12, vendor: 'nvidia', rt: true, upscaler: 'DLSS' },
  { pattern: /rtx\s*3080/i, score: 79, vram: 10, vendor: 'nvidia', rt: true, upscaler: 'DLSS' },
  { pattern: /rtx\s*3090\s*ti/i, score: 89, vram: 24, vendor: 'nvidia', rt: true, upscaler: 'DLSS' },
  { pattern: /rtx\s*3090/i, score: 86, vram: 24, vendor: 'nvidia', rt: true, upscaler: 'DLSS' },

  // NVIDIA RTX 4000 / 5000
  { pattern: /rtx\s*4060\s*ti/i, score: 70, vram: 8, vendor: 'nvidia', rt: true, upscaler: 'DLSS 3' },
  { pattern: /rtx\s*4060/i, score: 62, vram: 8, vendor: 'nvidia', rt: true, upscaler: 'DLSS 3' },
  { pattern: /rtx\s*4070\s*ti\s*super/i, score: 87, vram: 16, vendor: 'nvidia', rt: true, upscaler: 'DLSS 3' },
  { pattern: /rtx\s*4070\s*super/i, score: 82, vram: 12, vendor: 'nvidia', rt: true, upscaler: 'DLSS 3' },
  { pattern: /rtx\s*4070\s*ti/i, score: 84, vram: 12, vendor: 'nvidia', rt: true, upscaler: 'DLSS 3' },
  { pattern: /rtx\s*4070/i, score: 77, vram: 12, vendor: 'nvidia', rt: true, upscaler: 'DLSS 3' },
  { pattern: /rtx\s*4080\s*super/i, score: 94, vram: 16, vendor: 'nvidia', rt: true, upscaler: 'DLSS 3' },
  { pattern: /rtx\s*4080/i, score: 92, vram: 16, vendor: 'nvidia', rt: true, upscaler: 'DLSS 3' },
  { pattern: /rtx\s*4090/i, score: 100, vram: 24, vendor: 'nvidia', rt: true, upscaler: 'DLSS 3' },
  { pattern: /rtx\s*5070\s*ti/i, score: 91, vram: 16, vendor: 'nvidia', rt: true, upscaler: 'DLSS 4' },
  { pattern: /rtx\s*5070/i, score: 86, vram: 12, vendor: 'nvidia', rt: true, upscaler: 'DLSS 4' },
  { pattern: /rtx\s*5080/i, score: 96, vram: 16, vendor: 'nvidia', rt: true, upscaler: 'DLSS 4' },
  { pattern: /rtx\s*5090/i, score: 105, vram: 32, vendor: 'nvidia', rt: true, upscaler: 'DLSS 4' },

  // AMD Radeon RX 400 / 500 / Vega / 5000
  { pattern: /rx\s*560/i, score: 21, vram: 4, vendor: 'amd', upscaler: 'FSR' },
  { pattern: /rx\s*470|rx\s*570/i, score: 29, vram: 4, vendor: 'amd', upscaler: 'FSR' },
  { pattern: /rx\s*480|rx\s*580/i, score: 33, vram: 8, vendor: 'amd', upscaler: 'FSR' },
  { pattern: /rx\s*590/i, score: 36, vram: 8, vendor: 'amd', upscaler: 'FSR' },
  { pattern: /vega\s*56/i, score: 42, vram: 8, vendor: 'amd', upscaler: 'FSR' },
  { pattern: /vega\s*64/i, score: 46, vram: 8, vendor: 'amd', upscaler: 'FSR' },
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
  { pattern: /ryzen\s*3\s*1[23]00|fx-\s*83|fx-\s*63|fx-\s*43/i, score: 25, cores: 4 },
  { pattern: /ryzen\s*5\s*1[456]00|ryzen\s*5\s*2500/i, score: 38, cores: 6 },
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
  { pattern: /ryzen\s*5\s*7600|ryzen\s*5\s*7500f/i, score: 84, cores: 6 },
  { pattern: /ryzen\s*7\s*7700/i, score: 88, cores: 8 },
  { pattern: /ryzen\s*7\s*7800x3d/i, score: 97, cores: 8 },
  { pattern: /ryzen\s*7\s*9800x3d/i, score: 100, cores: 8 },
  { pattern: /ryzen\s*9\s*79[05]0|ryzen\s*9\s*99[05]0/i, score: 94, cores: 12 },

  // Intel Core
  { pattern: /i3-[23467]\d{3}|i5-750|i5-[234]\d{3}|i7-[23]\d{3}/i, score: 25, cores: 4 },
  { pattern: /i7-47[79]0|i7-6800|i5-6[456]00|i5-7[456]00/i, score: 34, cores: 4 },
  { pattern: /i7-6700|i7-7700/i, score: 42, cores: 4 },
  { pattern: /i5-8[46]00|i5-9[46]00/i, score: 48, cores: 6 },
  { pattern: /i7-8700|i7-9700/i, score: 58, cores: 6 },
  { pattern: /i5-10[456]00|i5-11[456]00/i, score: 60, cores: 6 },
  { pattern: /i7-10700|i7-11700|i9-9900/i, score: 68, cores: 8 },
  { pattern: /i3-12100|i3-13100|i3-14100/i, score: 58, cores: 4 },
  { pattern: /i5-12[46]00/i, score: 74, cores: 6 },
  { pattern: /i7-12700/i, score: 83, cores: 12 },
  { pattern: /i5-13[456]00|i5-14[456]00/i, score: 84, cores: 10 },
  { pattern: /i7-13700|i7-14700|i9-12900/i, score: 91, cores: 16 },
  { pattern: /i9-13900|i9-14900/i, score: 95, cores: 24 }
];

// Common PCI Device ID lookup table for popular Linux AMD/NVIDIA/Intel GPUs
// Helps disambiguate generic lspci strings like "Navi 33 [Radeon RX 7600/7600 XT/7600M XT]"
const PCI_GPU_IDS = {
  '1002:7480': 'AMD Radeon RX 7600',
  '1002:7483': 'AMD Radeon RX 7600 XT',
  '1002:747e': 'AMD Radeon RX 7800 XT',
  '1002:7479': 'AMD Radeon RX 7700 XT',
  '1002:744c': 'AMD Radeon RX 7900 XTX',
  '1002:73ff': 'AMD Radeon RX 6600',
  '1002:73ef': 'AMD Radeon RX 6650 XT',
  '1002:73df': 'AMD Radeon RX 6700 XT',
  '1002:73bf': 'AMD Radeon RX 6800 XT',
  '1002:67df': 'AMD Radeon RX 580',
  '10de:2786': 'NVIDIA GeForce RTX 4070',
  '10de:2782': 'NVIDIA GeForce RTX 4070 Ti',
  '10de:2882': 'NVIDIA GeForce RTX 4060',
  '10de:2803': 'NVIDIA GeForce RTX 4060 Ti',
  '10de:2704': 'NVIDIA GeForce RTX 4080',
  '10de:2684': 'NVIDIA GeForce RTX 4090',
  '10de:2504': 'NVIDIA GeForce RTX 3060',
  '10de:2489': 'NVIDIA GeForce RTX 3060 Ti',
  '10de:2484': 'NVIDIA GeForce RTX 3070',
  '10de:2206': 'NVIDIA GeForce RTX 3080',
  '8086:56a0': 'Intel Arc A770',
  '8086:56a1': 'Intel Arc A750',
  '8086:56a5': 'Intel Arc A380',
  '8086:e20b': 'Intel Arc B580'
};

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
  const isIntegrated = /uhd\s*graphics|iris\s*xe|radeon\s*graphics|vega\s*[3678]|intel\(r\)\s*graphics|llvmpipe/i.test(name);
  const estScore = isIntegrated
    ? Math.min(24, Math.max(10, fallbackVram * 4))
    : Math.min(85, Math.max(15, fallbackVram * 7));
  return {
    score: estScore,
    vramGB: fallbackVram,
    vendor: /nvidia|geforce|rtx|gtx/i.test(name)
      ? 'nvidia'
      : /amd|radeon|rx|navi|vega/i.test(name)
        ? 'amd'
        : /intel|arc|uhd|iris/i.test(name)
          ? 'intel'
          : 'unknown',
    rtCapable: /rtx|rx\s*[6789]\d00|arc\s*[ab]\d/i.test(name),
    upscaler: /rtx/i.test(name) ? 'DLSS' : /arc/i.test(name) ? 'XeSS' : 'FSR'
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

function isVirtualAdapter(name = '') {
  return /virtual|meta|basic|parsec|remote|llvmpipe|softpipe|simpledrm|bochs|qxl|virtio|vmware|hyper-v| dummy/i.test(name);
}

function isIntegratedAdapter(name = '', vramMB = 0) {
  if (/rtx\s*\d|gtx\s*\d|radeon\s*rx\s*\d|arc\s*[ab]\d{3}|radeon\s*pro\s*w/i.test(name)) {
    return false;
  }
  if (/uhd\s*graphics|hd\s*graphics|iris|intel\(r\)\s*graphics|radeon\(tm\)\s*graphics|radeon\s*graphics|cezanne|rembrandt|raphael|phoenix|mendocino|barcelo|lucienne|renoir| Picasso/i.test(name)) {
    return true;
  }
  return vramMB > 0 && vramMB <= 1024;
}

function sortGPUsByPriority(gpus) {
  return [...gpus].sort((a, b) => {
    const aReal = isVirtualAdapter(a.name) ? 0 : 1;
    const bReal = isVirtualAdapter(b.name) ? 0 : 1;
    if (aReal !== bReal) return bReal - aReal;

    const aDiscrete = isIntegratedAdapter(a.name, a.vramMB) ? 0 : 1;
    const bDiscrete = isIntegratedAdapter(b.name, b.vramMB) ? 0 : 1;
    if (aDiscrete !== bDiscrete) return bDiscrete - aDiscrete;

    if ((b.vramMB || 0) !== (a.vramMB || 0)) {
      return (b.vramMB || 0) - (a.vramMB || 0);
    }

    const aScore = scoreGPU(a.name, a.vramGB).score;
    const bScore = scoreGPU(b.name, b.vramGB).score;
    return bScore - aScore;
  });
}

// ============================================================================
// WINDOWS HARDWARE DETECTION (Registry + PowerShell CIM)
// ============================================================================

function detectGPUsFromWindowsRegistry() {
  try {
    const cmd = `powershell -NoProfile -Command "Get-ItemProperty 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}\\0*' -ErrorAction SilentlyContinue | Select-Object DriverDesc, DriverVersion, @{N='VRAM_MB';E={[math]::Round($_.'HardwareInformation.qwMemorySize'/1MB)}} | ConvertTo-Json"`;
    const out = execSync(cmd, { encoding: 'utf8', timeout: 4000, stdio: ['ignore', 'pipe', 'ignore'] });
    if (!out || !out.trim()) return [];
    const parsed = JSON.parse(out);
    const list = Array.isArray(parsed) ? parsed : [parsed];
    const valid = list
      .filter((g) => g && g.DriverDesc)
      .map((g) => {
        const vramMB = Number(g.VRAM_MB) || 0;
        const vramGB = Math.max(0, Math.round(vramMB / 1024));
        const evalRes = scoreGPU(g.DriverDesc.trim(), vramGB || null);
        return {
          name: g.DriverDesc.trim(),
          driverVersion: g.DriverVersion || 'Unknown',
          vramMB: vramMB || evalRes.vramGB * 1024,
          vramGB: vramGB || evalRes.vramGB,
          vendor: evalRes.vendor
        };
      });

    return sortGPUsByPriority(valid);
  } catch (e) {
    return [];
  }
}

function detectGPUsFromWindowsCim() {
  try {
    const cmd = `powershell -NoProfile -Command "Get-CimInstance Win32_VideoController -ErrorAction SilentlyContinue | Select-Object Name, DriverVersion, AdapterRAM | ConvertTo-Json"`;
    const out = execSync(cmd, { encoding: 'utf8', timeout: 4000, stdio: ['ignore', 'pipe', 'ignore'] });
    if (!out || !out.trim()) return [];
    const parsed = JSON.parse(out);
    const list = Array.isArray(parsed) ? parsed : [parsed];
    const valid = list
      .filter((g) => g && g.Name)
      .map((g) => {
        const vramMB = g.AdapterRAM ? Math.round(Number(g.AdapterRAM) / (1024 * 1024)) : 0;
        const vramGB = Math.max(0, Math.round(vramMB / 1024));
        const evalRes = scoreGPU(g.Name.trim(), vramGB || null);
        return {
          name: g.Name.trim(),
          driverVersion: g.DriverVersion || 'Unknown',
          vramMB: vramMB || evalRes.vramGB * 1024,
          vramGB: vramGB || evalRes.vramGB,
          vendor: evalRes.vendor
        };
      });
    return sortGPUsByPriority(valid);
  } catch (e) {
    return [];
  }
}

function detectWindowsStorageDrives() {
  const drives = [];
  if (typeof fs.statfsSync === 'function') {
    const letters = 'CDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    for (const letter of letters) {
      try {
        const stats = fs.statfsSync(`${letter}:\\`);
        if (stats && stats.blocks > 0) {
          const freeGB = Math.round((stats.bavail * stats.bsize) / (1024 ** 3));
          const totalGB = Math.round((stats.blocks * stats.bsize) / (1024 ** 3));
          if (totalGB > 0) {
            const usedGB = Math.max(0, totalGB - freeGB);
            const usedPercent = Math.min(100, Math.max(0, Math.round((usedGB / totalGB) * 100)));
            drives.push({
              drive: `${letter}:`,
              label: `Local Disk (${letter}:)`,
              freeGB,
              totalGB,
              usedGB,
              usedPercent
            });
          }
        }
      } catch (e) {
        // drive not present
      }
    }
  }
  if (drives.length === 0) {
    return {
      drive: 'C:',
      label: 'Local Disk (C:)',
      freeGB: 150,
      totalGB: 500,
      usedGB: 350,
      usedPercent: 70,
      allDrives: [{ drive: 'C:', label: 'Local Disk (C:)', freeGB: 150, totalGB: 500, usedGB: 350, usedPercent: 70 }]
    };
  }
  const bestDrive = [...drives].sort((a, b) => b.freeGB - a.freeGB)[0];
  return {
    drive: bestDrive.drive,
    label: bestDrive.label,
    freeGB: bestDrive.freeGB,
    totalGB: bestDrive.totalGB,
    usedGB: bestDrive.usedGB,
    usedPercent: bestDrive.usedPercent,
    allDrives: drives
  };
}

// ============================================================================
// LINUX PURE PARSER HELPERS (Deterministic & Testable on Any Platform)
// ============================================================================

/**
 * Parses Linux `/proc/cpuinfo` text and optional `lscpu` text into structured CPU specs.
 */
function parseLinuxCpuInfo(cpuinfoText = '', lscpuText = '', fallbackCpus = null) {
  const hostCpus = Array.isArray(fallbackCpus) ? fallbackCpus : (os.cpus() || []);
  let modelName = '';
  let cpuCoresPerSocket = 0;
  let siblingsPerSocket = 0;
  let processorEntries = 0;
  let maxMHz = 0;
  const physicalIds = new Set();

  if (cpuinfoText && typeof cpuinfoText === 'string') {
    const lines = cpuinfoText.split(/\r?\n/);
    for (const line of lines) {
      const match = line.match(/^([^:]+?)\s*:\s*(.+)$/);
      if (!match) continue;
      const key = match[1].trim().toLowerCase();
      const val = match[2].trim();

      if (key === 'processor') {
        processorEntries += 1;
      } else if ((key === 'model name' || key === 'hardware' || key === 'processor') && !modelName && isNaN(Number(val))) {
        modelName = val;
      } else if (key === 'cpu cores') {
        const parsed = parseInt(val, 10);
        if (parsed > 0) cpuCoresPerSocket = parsed;
      } else if (key === 'siblings') {
        const parsed = parseInt(val, 10);
        if (parsed > 0) siblingsPerSocket = parsed;
      } else if (key === 'physical id') {
        physicalIds.add(val);
      } else if (key === 'cpu mhz') {
        const mhz = parseFloat(val);
        if (mhz > maxMHz) maxMHz = mhz;
      }
    }
  }

  let lscpuModel = '';
  let lscpuCoresPerSocket = 0;
  let lscpuSockets = 1;
  let lscpuThreads = 0;
  let lscpuMaxMHz = 0;

  if (lscpuText && typeof lscpuText === 'string') {
    const lines = lscpuText.split(/\r?\n/);
    for (const line of lines) {
      const match = line.match(/^([^:]+?):\s*(.+)$/);
      if (!match) continue;
      const key = match[1].trim().toLowerCase();
      const val = match[2].trim();

      if (key === 'model name' && !lscpuModel) {
        lscpuModel = val;
      } else if (key === 'core(s) per socket') {
        lscpuCoresPerSocket = parseInt(val, 10) || 0;
      } else if (key === 'socket(s)') {
        lscpuSockets = parseInt(val, 10) || 1;
      } else if (key === 'cpu(s)') {
        if (!lscpuThreads) lscpuThreads = parseInt(val, 10) || 0;
      } else if (key === 'cpu max mhz' || key === 'cpu mhz') {
        const normalized = parseFloat(val.replace(',', '.'));
        if (normalized > lscpuMaxMHz) lscpuMaxMHz = normalized;
      }
    }
  }

  const finalName = (modelName || lscpuModel || hostCpus[0]?.model || 'Unknown CPU')
    .replace(/\s+/g, ' ')
    .trim();

  const socketCount = physicalIds.size > 0 ? physicalIds.size : (lscpuSockets || 1);
  const threads = processorEntries || lscpuThreads || (siblingsPerSocket ? siblingsPerSocket * socketCount : 0) || hostCpus.length || 4;
  const cpuEval = scoreCPU(finalName, threads);

  const physicalCores = cpuCoresPerSocket > 0
    ? cpuCoresPerSocket * socketCount
    : lscpuCoresPerSocket > 0
      ? lscpuCoresPerSocket * socketCount
      : cpuEval.estimatedCores;

  // Also check if model name contains "@ X.XXGHz" when MHz is missing or throttled
  let speedMHz = lscpuMaxMHz || maxMHz || hostCpus[0]?.speed || 3000;
  const ghzInName = finalName.match(/@\s*(\d+(?:\.\d+)?)\s*GHz/i);
  if (ghzInName && speedMHz < 1200) {
    speedMHz = parseFloat(ghzInName[1]) * 1000;
  }

  return {
    name: finalName,
    cores: physicalCores,
    threads,
    speedMHz: Math.round(speedMHz),
    speedGHz: Number((speedMHz / 1000).toFixed(2)),
    score: cpuEval.score
  };
}

/**
 * Parses Linux `/proc/meminfo` text (in kB) into GB totals.
 */
function parseLinuxMemInfo(meminfoText = '', fallbackTotalBytes = null, fallbackFreeBytes = null) {
  let memTotalKB = null;
  let memAvailableKB = null;
  let memFreeKB = null;
  let buffersKB = 0;
  let cachedKB = 0;

  if (meminfoText && typeof meminfoText === 'string') {
    const lines = meminfoText.split(/\r?\n/);
    for (const line of lines) {
      const match = line.match(/^(\w+):\s*(\d+)/);
      if (!match) continue;
      const key = match[1];
      const val = parseInt(match[2], 10);
      if (key === 'MemTotal') memTotalKB = val;
      else if (key === 'MemAvailable') memAvailableKB = val;
      else if (key === 'MemFree') memFreeKB = val;
      else if (key === 'Buffers') buffersKB = val;
      else if (key === 'Cached') cachedKB = val;
    }
  }

  if (memTotalKB && memTotalKB > 0) {
    const totalGB = Math.max(1, Math.round(memTotalKB / (1024 * 1024)));
    const effectiveAvailKB = memAvailableKB !== null
      ? memAvailableKB
      : (memFreeKB !== null ? memFreeKB + buffersKB + cachedKB : Math.round(memTotalKB * 0.5));
    const freeGB = Math.max(0, Math.min(totalGB, Math.round(effectiveAvailKB / (1024 * 1024))));
    const usedGB = Math.max(0, totalGB - freeGB);
    return { totalGB, freeGB, usedGB };
  }

  const totalBytes = fallbackTotalBytes !== null ? fallbackTotalBytes : os.totalmem();
  const freeBytes = fallbackFreeBytes !== null ? fallbackFreeBytes : os.freemem();
  const totalGB = Math.max(1, Math.round(totalBytes / (1024 ** 3)));
  const freeGB = Math.max(0, Math.round(freeBytes / (1024 ** 3)));
  return {
    totalGB,
    freeGB,
    usedGB: Math.max(0, totalGB - freeGB)
  };
}

function parseSizeToGB(token, defaultUnit = 'M') {
  if (!token) return 0;
  const cleaned = String(token).trim().toUpperCase();
  const match = cleaned.match(/^([\d.]+)\s*([KMGTPE]?)(?:I?B)?$/);
  if (!match) return 0;
  const num = parseFloat(match[1]);
  if (isNaN(num)) return 0;
  const unit = match[2] || defaultUnit;
  if (unit === 'T') return num * 1024;
  if (unit === 'G') return num;
  if (unit === 'M') return num / 1024;
  if (unit === 'K') return num / (1024 * 1024);
  return num / 1024;
}

function isPseudoLinuxMount(source = '', fstype = '', target = '') {
  const pseudoFsTypes = /^(tmpfs|devtmpfs|squashfs|overlay|proc|sysfs|efivarfs|cgroup2?|securityfs|pstore|debugfs|tracefs|configfs|fusectl|mqueue|hugetlbfs|autofs|binfmt_misc|bpf|nsfs|ramfs|iso9660|udf|fuse\.portal|fuse\.gvfsd-fuse|tracefs)$/i;
  if (fstype && pseudoFsTypes.test(fstype)) return true;

  const pseudoSources = /^(tmpfs|devtmpfs|udev|none|overlay|shm|cgroup2?|proc|sysfs|efivarfs|portal|gvfsd-fuse|systemd-1)$/i;
  if (source && (pseudoSources.test(source) || /^\/dev\/(loop|sr|ram)\d*/i.test(source))) return true;

  if (!target || !target.startsWith('/')) return true;
  if (target === '/boot/efi' || target === '/boot' || target.startsWith('/boot/')) return true;
  if (target.startsWith('/snap/') || target === '/snap') return true;
  if (/^\/(proc|sys|dev|var\/lib\/docker|var\/lib\/containers|var\/lib\/flatpak)(\/|$)/.test(target)) return true;
  if (/^\/run(\/|$)/.test(target) && !/^\/run\/media\//.test(target)) return true;

  return false;
}

function formatLinuxMountLabel(target) {
  if (target === '/') return 'Root (/)';
  if (target === '/home') return 'Home (/home)';
  const base = path.posix.basename(target);
  return base ? `${base} (${target})` : target;
}

/**
 * Parses `df -BM -P` or `df -BM --output=source,fstype,size,used,avail,target` or `df -PT -BM`
 * into mounted physical/gaming drives, filtering out pseudo and read-only mounts.
 */
function parseLinuxDfOutput(dfText = '') {
  if (!dfText || typeof dfText !== 'string') return [];

  const lines = dfText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  const header = lines[0].toLowerCase();
  const defaultUnit = (header.includes('1k-blocks') || header.includes('1024-blocks')) ? 'K' : 'M';
  const hasFstypeColumn = header.includes('type') && !header.includes('capacity') && !header.includes('use%');
  const hasFstypeAndPercent = header.includes('type') && (header.includes('capacity') || header.includes('use%'));

  const drives = [];
  const seenTargets = new Set();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^filesystem\b/i.test(line)) continue;

    const parts = line.split(/\s+/);
    if (parts.length < 5) continue;

    let source = parts[0];
    let fstype = '';
    let sizeToken = '';
    let usedToken = '';
    let availToken = '';
    let target = '';

    // Check if second-to-last or a middle column has percentage like "45%"
    const percentIndex = parts.findIndex((p, idx) => idx >= 2 && /^\d+%$/.test(p));

    if (percentIndex !== -1) {
      // Standard df -P (`source size used avail use% target`) or df -PT (`source fstype size used avail use% target`)
      if (percentIndex >= 4 || hasFstypeAndPercent) {
        fstype = parts[1];
        sizeToken = parts[percentIndex - 3];
        usedToken = parts[percentIndex - 2];
        availToken = parts[percentIndex - 1];
      } else {
        sizeToken = parts[percentIndex - 3];
        usedToken = parts[percentIndex - 2];
        availToken = parts[percentIndex - 1];
      }
      target = parts.slice(percentIndex + 1).join(' ');
    } else if (parts.length >= 6 || hasFstypeColumn) {
      // `df -BM --output=source,fstype,size,used,avail,target`
      fstype = parts[1];
      sizeToken = parts[2];
      usedToken = parts[3];
      availToken = parts[4];
      target = parts.slice(5).join(' ');
    } else {
      continue;
    }

    if (isPseudoLinuxMount(source, fstype, target)) continue;
    if (seenTargets.has(target)) continue;

    const totalGB = Math.round(parseSizeToGB(sizeToken, defaultUnit));
    const usedGB = Math.round(parseSizeToGB(usedToken, defaultUnit));
    const freeGB = Math.round(parseSizeToGB(availToken, defaultUnit));

    if (totalGB <= 1) continue;

    seenTargets.add(target);
    const computedUsed = usedGB > 0 ? usedGB : Math.max(0, totalGB - freeGB);
    const usedPercent = totalGB > 0
      ? Math.min(100, Math.max(0, Math.round((computedUsed / totalGB) * 100)))
      : 0;

    drives.push({
      drive: target,
      label: formatLinuxMountLabel(target),
      totalGB,
      freeGB,
      usedGB: computedUsed,
      usedPercent,
      source,
      fstype: fstype || 'ext4'
    });
  }

  return drives;
}

/**
 * Cleans up raw `lspci` controller strings into human-readable GPU model names
 * that match `GPU_BENCHMARKS` accurately.
 */
function normalizeLspciGpuName(rawControllerDesc = '', pciId = '', knownVramGB = 0) {
  const normalizedPciId = String(pciId || '').toLowerCase().replace(/^0x/, '');
  if (normalizedPciId && PCI_GPU_IDS[normalizedPciId]) {
    return PCI_GPU_IDS[normalizedPciId];
  }

  // Extract all bracketed segments, e.g. [AMD/ATI] Navi 33 [Radeon RX 7600/7600 XT] [1002:7480]
  const brackets = [];
  const regex = /\[([^\]]+)\]/g;
  let m;
  while ((m = regex.exec(rawControllerDesc)) !== null) {
    const content = m[1].trim();
    if (!/^[0-9a-f]{4}:[0-9a-f]{4}$/i.test(content) && !/^03\d\d$/i.test(content) && !/^vga/i.test(content)) {
      brackets.push(content);
    }
  }

  const vendorPrefix = /nvidia/i.test(rawControllerDesc)
    ? 'NVIDIA'
    : /amd|advanced micro devices|ati/i.test(rawControllerDesc)
      ? 'AMD'
      : /intel/i.test(rawControllerDesc)
        ? 'Intel'
        : '';

  // Find a bracketed model name like "Radeon RX 7600/7600 XT" or "GeForce RTX 4070"
  const modelBracket = brackets.find((b) => /radeon|geforce|rtx|gtx|rx\s*\d|arc\s*[ab]\d|uhd|iris|vega/i.test(b));
  if (modelBracket) {
    let candidate = modelBracket.split(' / ')[0].trim();
    if (candidate.includes('/')) {
      // E.g. "Radeon RX 7600/7600 XT/7600M XT"
      const variants = candidate.split('/').map((s) => s.trim());
      if (knownVramGB >= 15 && variants.some((v) => /xt/i.test(v))) {
        const xtVar = variants.find((v) => /xt/i.test(v) && !/m\b/i.test(v)) || variants[1];
        const prefixMatch = variants[0].match(/^(.*?\b(?:RX|RTX|GTX)\s*)/i);
        candidate = prefixMatch && !/^(radeon|geforce|rx|rtx)/i.test(xtVar)
          ? `${prefixMatch[1]}${xtVar}`
          : xtVar;
      } else {
        candidate = variants[0];
      }
    }
    if (vendorPrefix && !new RegExp(`^${vendorPrefix}`, 'i').test(candidate)) {
      return `${vendorPrefix} ${candidate}`.replace(/\s+/g, ' ').trim();
    }
    return candidate.replace(/\s+/g, ' ').trim();
  }

  // Fallback: strip PCI IDs and revisions from raw string
  return rawControllerDesc
    .replace(/\[[0-9a-f]{4}:[0-9a-f]{4}\]/gi, '')
    .replace(/\(rev\s+[0-9a-f]+\)/gi, '')
    .replace(/\(prog-if[^)]*\)/gi, '')
    .replace(/Advanced Micro Devices,\s*Inc\.\s*\[AMD\/ATI\]/i, 'AMD')
    .replace(/NVIDIA Corporation/i, 'NVIDIA')
    .replace(/Intel Corporation/i, 'Intel')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parses Linux GPU detection sources (`nvidia-smi`, `/sys/class/drm/card*`, `lspci -vnn`,
 * `rocm-smi`, `glxinfo -B`, `/proc/driver/nvidia/version`, `/sys/module/amdgpu/version`).
 *
 * Returns a priority-sorted array of detected GPUs (discrete NVIDIA/AMD first),
 * with `.primaryGpu`, `.allDetected`, `.name`, `.vramGB`, `.vramMB`, `.driverVersion`, `.vendor`, `.score`
 * also attached on the returned array for convenience in both array and object assertions.
 */
function parseLinuxGpuInfo(inputs = {}) {
  if (typeof inputs === 'string') {
    const text = inputs;
    if (/vga compatible controller|3d controller|display controller/i.test(text)) {
      inputs = { lspciOutput: text };
    } else if (/opengl|mesa|video memory:/i.test(text)) {
      inputs = { glxinfoOutput: text };
    } else {
      inputs = { nvidiaSmiOutput: text };
    }
  }

  const {
    nvidiaSmiOutput = '',
    sysfsCards = [],
    lspciOutput = '',
    glxinfoOutput = '',
    rocmSmiOutput = '',
    nvidiaVersionText = '',
    amdgpuVersionText = ''
  } = inputs || {};

  // 1. Extract fallback driver versions
  let fallbackNvidiaDriver = '';
  if (nvidiaVersionText) {
    const nvMatch = nvidiaVersionText.match(/Kernel Module\s+([\d.]+)/i) || nvidiaVersionText.match(/([\d]{3}\.[\d.]+)/);
    if (nvMatch) fallbackNvidiaDriver = nvMatch[1];
  }

  let mesaDriver = '';
  let glxDeviceName = '';
  let glxVramMB = 0;
  if (glxinfoOutput) {
    const mesaMatch = glxinfoOutput.match(/Mesa\s+([\d.]+(?:-[\w.]+)?)/i);
    if (mesaMatch) mesaDriver = `Mesa ${mesaMatch[1]}`;

    const devMatch = glxinfoOutput.match(/Device:\s*([^\n(]+)/i);
    if (devMatch) glxDeviceName = devMatch[1].trim();

    const memMatch = glxinfoOutput.match(/Video memory:\s*(\d+)\s*MB/i)
      || glxinfoOutput.match(/Dedicated video memory:\s*(\d+)\s*MB/i);
    if (memMatch) glxVramMB = parseInt(memMatch[1], 10) || 0;
  }

  let amdgpuDriver = '';
  if (amdgpuVersionText && amdgpuVersionText.trim()) {
    const cleanVer = amdgpuVersionText.trim();
    amdgpuDriver = /^amdgpu/i.test(cleanVer) ? cleanVer : `amdgpu ${cleanVer}`;
  }

  // 2. Parse lspci -vnn blocks
  const lspciEntries = [];
  if (lspciOutput && typeof lspciOutput === 'string') {
    const lines = lspciOutput.split(/\r?\n/);
    let current = null;

    for (const line of lines) {
      const headerMatch = line.match(/^([0-9a-f]{2,4}:[0-9a-f]{2}:[0-9a-f]{2}\.[0-9a-f]|(?:[0-9a-f]{2}:[0-9a-f]{2}\.[0-9a-f]))\s+(?:VGA compatible controller|3D controller|Display controller)[^:]*:\s*(.+)$/i);
      if (headerMatch) {
        if (current) lspciEntries.push(current);
        const slot = headerMatch[1].replace(/^0000:/, '');
        const rawDesc = headerMatch[2].trim();
        const pciIdMatch = rawDesc.match(/\[([0-9a-f]{4}:[0-9a-f]{4})\]/i);
        current = {
          slot,
          rawDesc,
          pciId: pciIdMatch ? pciIdMatch[1].toLowerCase() : '',
          prefetchableMB: 0,
          kernelDriver: ''
        };
      } else if (current && (/^\s+/.test(line) || line.startsWith('\t'))) {
        const memMatch = line.match(/Memory at [0-9a-f]+ \([^)]*prefetchable\)\s*\[size=(\d+)([MG])\]/i);
        if (memMatch) {
          const val = parseInt(memMatch[1], 10);
          const unit = memMatch[2].toUpperCase();
          const mb = unit === 'G' ? val * 1024 : val;
          if (mb > current.prefetchableMB) current.prefetchableMB = mb;
        }
        const drvMatch = line.match(/Kernel driver in use:\s*(\S+)/i);
        if (drvMatch) {
          current.kernelDriver = drvMatch[1].trim();
        }
      } else if (line.trim() === '') {
        if (current) {
          lspciEntries.push(current);
          current = null;
        }
      }
    }
    if (current) lspciEntries.push(current);
  }

  const detectedGpus = [];

  // 3. Parse nvidia-smi output (Primary for NVIDIA on Linux)
  if (nvidiaSmiOutput && typeof nvidiaSmiOutput === 'string') {
    const lines = nvidiaSmiOutput
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !/^name\s*,/i.test(l) && !/failed|not found|no devices/i.test(l));

    for (const line of lines) {
      const parts = line.split(',').map((p) => p.trim());
      if (parts.length >= 2 && parts[0]) {
        const name = parts[0];
        const vramMB = parseInt(parts[1].replace(/[^\d]/g, ''), 10) || 0;
        const vramGB = vramMB > 0 ? Math.max(1, Math.round(vramMB / 1024)) : scoreGPU(name).vramGB;
        const driverVersion = parts[2] || fallbackNvidiaDriver || 'NVIDIA Linux Driver';
        const gpuEval = scoreGPU(name, vramGB);
        detectedGpus.push({
          name,
          vramMB: vramMB || vramGB * 1024,
          vramGB,
          driverVersion,
          vendor: 'nvidia',
          rtCapable: gpuEval.rtCapable,
          upscaler: gpuEval.upscaler,
          score: gpuEval.score
        });
      }
    }
  }

  // 4. Parse rocm-smi output (if present)
  const rocmModels = [];
  if (rocmSmiOutput && typeof rocmSmiOutput === 'string') {
    try {
      const parsedRocm = JSON.parse(rocmSmiOutput);
      for (const key of Object.keys(parsedRocm)) {
        const cardObj = parsedRocm[key];
        if (cardObj && typeof cardObj === 'object') {
          const name = cardObj['Card series'] || cardObj['Card model'] || cardObj['Card SKU'] || '';
          const vramTotalBytes = Number(cardObj['VRAM Total Memory (B)']) || 0;
          if (name || vramTotalBytes > 0) {
            rocmModels.push({
              name: name.trim(),
              vramMB: vramTotalBytes > 0 ? Math.round(vramTotalBytes / (1024 * 1024)) : 0
            });
          }
        }
      }
    } catch (e) {
      const seriesMatch = rocmSmiOutput.match(/Card series:\s*(.+)/i);
      if (seriesMatch) {
        rocmModels.push({ name: seriesMatch[1].trim(), vramMB: 0 });
      }
    }
  }

  // 5. Parse sysfs `/sys/class/drm/card*/device` cards + correlate with lspci / glxinfo
  const usedLspciSlots = new Set();

  if (Array.isArray(sysfsCards) && sysfsCards.length > 0) {
    for (const card of sysfsCards) {
      const vendorHex = String(card.vendor || '').toLowerCase().replace(/^0x/, '').trim();
      const deviceHex = String(card.device || '').toLowerCase().replace(/^0x/, '').trim();
      const ueventText = String(card.uevent || '');

      let pciId = (vendorHex && deviceHex) ? `${vendorHex}:${deviceHex}` : '';
      let pciSlot = String(card.pciSlot || '').replace(/^0000:/, '');
      let kernelDriver = String(card.driver || '');

      if (ueventText) {
        const idMatch = ueventText.match(/PCI_ID=([0-9a-fA-F]{4}:[0-9a-fA-F]{4})/);
        if (idMatch && !pciId) pciId = idMatch[1].toLowerCase();
        const slotMatch = ueventText.match(/PCI_SLOT_NAME=(?:0000:)?([0-9a-fA-F:.]+)/);
        if (slotMatch && !pciSlot) pciSlot = slotMatch[1];
        const drvMatch = ueventText.match(/DRIVER=(\S+)/);
        if (drvMatch && !kernelDriver) kernelDriver = drvMatch[1];
      }

      // Skip if this is an NVIDIA card already captured via nvidia-smi
      if ((vendorHex === '10de' || kernelDriver === 'nvidia') && detectedGpus.some((g) => g.vendor === 'nvidia')) {
        continue;
      }

      const rawVramBytes = Number(card.vramBytes || card.memInfoVramTotal || card.mem_info_vram_total || 0);
      let vramMB = rawVramBytes > 0 ? Math.round(rawVramBytes / (1024 * 1024)) : (Number(card.vramMB) || 0);

      // Correlate with lspci entry by slot or pciId
      const matchingLspci = lspciEntries.find(
        (entry) => (pciSlot && entry.slot === pciSlot) || (pciId && entry.pciId === pciId)
      );
      if (matchingLspci) {
        usedLspciSlots.add(matchingLspci.slot);
        if (!vramMB && matchingLspci.prefetchableMB >= 512) {
          vramMB = matchingLspci.prefetchableMB;
        }
        if (!kernelDriver && matchingLspci.kernelDriver) {
          kernelDriver = matchingLspci.kernelDriver;
        }
      }

      if (!vramMB && glxVramMB > 0 && vendorHex !== '10de') {
        vramMB = glxVramMB;
      }

      const vramGB = vramMB > 0 ? Math.max(1, Math.round(vramMB / 1024)) : 0;

      // Resolve best GPU model name
      let gpuName = card.productName || card.name || '';
      if (!gpuName && matchingLspci) {
        gpuName = normalizeLspciGpuName(matchingLspci.rawDesc, pciId || matchingLspci.pciId, vramGB);
      }
      if (!gpuName && pciId && PCI_GPU_IDS[pciId]) {
        gpuName = PCI_GPU_IDS[pciId];
      }
      if (!gpuName && rocmModels.length > 0 && (vendorHex === '1002' || kernelDriver === 'amdgpu')) {
        gpuName = rocmModels[0].name;
        if (!vramMB && rocmModels[0].vramMB) vramMB = rocmModels[0].vramMB;
      }
      if (!gpuName && glxDeviceName) {
        gpuName = glxDeviceName;
      }
      if (!gpuName) {
        gpuName = vendorHex === '1002'
          ? 'AMD Radeon GPU'
          : vendorHex === '10de'
            ? 'NVIDIA GeForce GPU'
            : vendorHex === '8086'
              ? 'Intel Graphics'
              : 'Linux DRM GPU';
      }

      const evalRes = scoreGPU(gpuName, vramGB || null);
      const finalVramGB = vramGB || evalRes.vramGB;
      const finalVramMB = vramMB || finalVramGB * 1024;

      const driverVersion = (vendorHex === '10de' || evalRes.vendor === 'nvidia')
        ? (fallbackNvidiaDriver || kernelDriver || 'nvidia')
        : (mesaDriver || amdgpuDriver || (kernelDriver ? `${kernelDriver} (Linux DRM)` : 'Mesa / Linux DRM'));

      detectedGpus.push({
        name: gpuName,
        vramMB: finalVramMB,
        vramGB: finalVramGB,
        driverVersion,
        vendor: evalRes.vendor,
        rtCapable: evalRes.rtCapable,
        upscaler: evalRes.upscaler,
        score: evalRes.score
      });
    }
  }

  // 6. Any remaining lspci GPUs not already matched by nvidia-smi or sysfs
  for (const entry of lspciEntries) {
    if (usedLspciSlots.has(entry.slot)) continue;
    const isNvidiaEntry = /nvidia/i.test(entry.rawDesc) || entry.pciId.startsWith('10de:');
    if (isNvidiaEntry && detectedGpus.some((g) => g.vendor === 'nvidia')) continue;

    const vramMB = entry.prefetchableMB >= 512 ? entry.prefetchableMB : (glxVramMB || 0);
    const vramGB = vramMB > 0 ? Math.max(1, Math.round(vramMB / 1024)) : 0;
    const gpuName = normalizeLspciGpuName(entry.rawDesc, entry.pciId, vramGB);
    const evalRes = scoreGPU(gpuName, vramGB || null);
    const finalVramGB = vramGB || evalRes.vramGB;
    const finalVramMB = vramMB || finalVramGB * 1024;

    const driverVersion = evalRes.vendor === 'nvidia'
      ? (fallbackNvidiaDriver || entry.kernelDriver || 'nvidia')
      : (mesaDriver || amdgpuDriver || entry.kernelDriver || 'Mesa / Linux DRM');

    detectedGpus.push({
      name: gpuName,
      vramMB: finalVramMB,
      vramGB: finalVramGB,
      driverVersion,
      vendor: evalRes.vendor,
      rtCapable: evalRes.rtCapable,
      upscaler: evalRes.upscaler,
      score: evalRes.score
    });
  }

  // 7. Fallback to glxinfo -B or rocm-smi if neither nvidia-smi, sysfs, nor lspci produced results
  if (detectedGpus.length === 0 && (glxDeviceName || rocmModels.length > 0)) {
    const rawName = glxDeviceName || rocmModels[0].name;
    const rawVramMB = glxVramMB || (rocmModels[0] && rocmModels[0].vramMB) || 0;
    const vramGB = rawVramMB > 0 ? Math.max(1, Math.round(rawVramMB / 1024)) : 0;
    const evalRes = scoreGPU(rawName, vramGB || null);
    const finalVramGB = vramGB || evalRes.vramGB;
    detectedGpus.push({
      name: rawName,
      vramMB: rawVramMB || finalVramGB * 1024,
      vramGB: finalVramGB,
      driverVersion: mesaDriver || amdgpuDriver || fallbackNvidiaDriver || 'Mesa / Linux',
      vendor: evalRes.vendor,
      rtCapable: evalRes.rtCapable,
      upscaler: evalRes.upscaler,
      score: evalRes.score
    });
  }

  const sorted = sortGPUsByPriority(detectedGpus);
  const primary = sorted[0] || {
    name: 'Integrated / Unknown GPU',
    driverVersion: mesaDriver || amdgpuDriver || fallbackNvidiaDriver || 'N/A',
    vramMB: 2048,
    vramGB: 2,
    vendor: 'unknown',
    rtCapable: false,
    upscaler: 'FSR',
    score: scoreGPU('Integrated / Unknown GPU', 2).score
  };

  Object.defineProperties(sorted, {
    primary: { value: primary, enumerable: false },
    primaryGpu: { value: primary, enumerable: false },
    allDetected: { value: sorted, enumerable: false },
    name: { value: primary.name, enumerable: false },
    vramGB: { value: primary.vramGB, enumerable: false },
    vramMB: { value: primary.vramMB, enumerable: false },
    driverVersion: { value: primary.driverVersion, enumerable: false },
    vendor: { value: primary.vendor, enumerable: false },
    rtCapable: { value: primary.rtCapable, enumerable: false },
    upscaler: { value: primary.upscaler, enumerable: false },
    score: { value: primary.score, enumerable: false }
  });

  return sorted;
}

// ============================================================================
// DISPLAY / MONITOR DETECTION (Native Win32 Probe + Linux xrandr/DRM)
// ============================================================================

function computeAspectRatio(width, height) {
  if (!width || !height) return '16:9';
  const ratio = width / height;
  if (Math.abs(ratio - 16 / 9) < 0.05) return '16:9';
  if (Math.abs(ratio - 16 / 10) < 0.05) return '16:10';
  if (Math.abs(ratio - 21 / 9) < 0.12) return '21:9';
  if (Math.abs(ratio - 32 / 9) < 0.15) return '32:9';
  if (Math.abs(ratio - 4 / 3) < 0.05) return '4:3';
  const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));
  const g = gcd(width, height) || 1;
  return `${Math.round(width / g)}:${Math.round(height / g)}`;
}

function classifyResolutionTier(width, height) {
  const w = Number(width) || 1920;
  const h = Number(height) || 1080;
  const pixels = w * h;
  if (h >= 2000 || w >= 3400 || pixels >= 6000000) return '4K';
  if (h >= 1350 || w >= 2400 || pixels >= 3000000) return '1440p';
  return '1080p';
}

function formatDisplayObject(raw = {}, index = 0) {
  const width = Math.max(640, Number(raw.width) || 1920);
  const height = Math.max(480, Number(raw.height) || 1080);
  const refreshRateHz = Math.max(30, Math.round(Number(raw.refreshRateHz) || 60));
  const tier = raw.tier || classifyResolutionTier(width, height);
  const aspectRatio = raw.aspectRatio || computeAspectRatio(width, height);
  const bitsPerPixel = Number(raw.bitsPerPixel) || 32;
  const isPrimary = raw.isPrimary !== undefined ? Boolean(raw.isPrimary) : index === 0;
  const vrrCapable = raw.vrrCapable !== undefined ? Boolean(raw.vrrCapable) : refreshRateHz >= 75;
  const name = String(raw.name || 'Primary Display').trim();
  const deviceName = String(raw.deviceName || `DISPLAY${index + 1}`).trim();
  const resolutionLabel = `${width}x${height} (${tier})`;
  const probeEngine = raw.probeEngine || (process.platform === 'win32' ? 'native-cpp17-win32-probe' : 'linux-drm-xrandr');

  return {
    id: raw.id || `display-${index + 1}`,
    name,
    deviceName,
    width,
    height,
    resolutionLabel,
    tier,
    refreshRateHz,
    aspectRatio,
    bitsPerPixel,
    isPrimary,
    vrrCapable,
    probeEngine
  };
}

function detectWindowsDisplays() {
  const probePath = path.join(__dirname, '..', 'bin', 'rigcheck-native-probe.exe');
  try {
    if (fs.existsSync(probePath)) {
      const out = execFileSync(probePath, [], {
        encoding: 'utf8',
        timeout: 2500,
        stdio: ['ignore', 'pipe', 'ignore']
      });
      if (out && out.trim()) {
        const parsed = JSON.parse(out.trim());
        if (parsed && Array.isArray(parsed.displays) && parsed.displays.length > 0) {
          const list = parsed.displays.map((d, idx) => formatDisplayObject(d, idx));
          list.sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0));
          return list;
        }
      }
    }
  } catch (e) {
    // fallback below
  }

  try {
    const cmd = `powershell -NoProfile -Command "Get-CimInstance Win32_VideoController -ErrorAction SilentlyContinue | Where-Object { $_.CurrentHorizontalResolution -gt 0 } | Select-Object Name, CurrentHorizontalResolution, CurrentVerticalResolution, CurrentRefreshRate, CurrentBitsPerPixel | ConvertTo-Json"`;
    const out = execSync(cmd, { encoding: 'utf8', timeout: 3500, stdio: ['ignore', 'pipe', 'ignore'] });
    if (out && out.trim()) {
      const parsed = JSON.parse(out);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      const list = arr
        .filter((d) => d && d.CurrentHorizontalResolution)
        .map((d, idx) => formatDisplayObject({
          id: `display-${idx + 1}`,
          name: 'Windows Display',
          deviceName: `\\\\.\\DISPLAY${idx + 1}`,
          width: Number(d.CurrentHorizontalResolution) || 1920,
          height: Number(d.CurrentVerticalResolution) || 1080,
          refreshRateHz: Number(d.CurrentRefreshRate) || 60,
          bitsPerPixel: Number(d.CurrentBitsPerPixel) || 32,
          isPrimary: idx === 0,
          probeEngine: 'win32-cim-fallback'
        }, idx));
      if (list.length > 0) return list;
    }
  } catch (e) {
    // fallback below
  }

  return [
    formatDisplayObject({
      id: 'display-1',
      name: 'Standard 1080p Monitor',
      deviceName: '\\\\.\\DISPLAY1',
      width: 1920,
      height: 1080,
      refreshRateHz: 60,
      bitsPerPixel: 32,
      isPrimary: true,
      probeEngine: 'fallback-default'
    }, 0)
  ];
}

/**
 * Parses Linux `xrandr --current` output and/or `/sys/class/drm/card*-*` connectors
 * into structured display objects.
 */
function parseLinuxDisplayInfo(inputs = {}) {
  if (typeof inputs === 'string') {
    inputs = { xrandrOutput: inputs };
  }
  const { xrandrOutput = '', drmConnectors = [] } = inputs || {};
  const displays = [];

  if (xrandrOutput && typeof xrandrOutput === 'string') {
    const lines = xrandrOutput.split(/\r?\n/);
    let currentConnector = null;

    for (const line of lines) {
      // Match e.g.: "DP-1 connected primary 2560x1440+0+0 (normal left inverted right x axis y axis) 597mm x 336mm"
      // or: "HDMI-A-1 connected 1920x1080+2560+0 ..."
      const connMatch = line.match(/^([A-Za-z0-9_-]+)\s+connected\s+(primary\s+)?(?:(\d{3,5})x(\d{3,5})\+\d+\+\d+)?/i);
      if (connMatch) {
        if (currentConnector) {
          displays.push(formatDisplayObject(currentConnector, displays.length));
        }
        const outputName = connMatch[1];
        const isPrimary = Boolean(connMatch[2]);
        const width = connMatch[3] ? parseInt(connMatch[3], 10) : 0;
        const height = connMatch[4] ? parseInt(connMatch[4], 10) : 0;
        currentConnector = {
          name: `${outputName} Display`,
          deviceName: outputName,
          width: width || 1920,
          height: height || 1080,
          refreshRateHz: 60,
          bitsPerPixel: 32,
          isPrimary,
          probeEngine: 'linux-xrandr',
          foundActiveMode: false
        };
      } else if (/^[A-Za-z0-9_-]+\s+disconnected/i.test(line)) {
        if (currentConnector) {
          displays.push(formatDisplayObject(currentConnector, displays.length));
          currentConnector = null;
        }
      } else if (currentConnector && /^\s+\d{3,5}x\d{3,5}/.test(line) && line.includes('*')) {
        // Active mode line has '*', e.g.: "   2560x1440     165.00*+  144.00    60.00"
        const modeMatch = line.match(/^\s+(\d{3,5})x(\d{3,5})\s+(.+)$/);
        if (modeMatch) {
          const modeW = parseInt(modeMatch[1], 10);
          const modeH = parseInt(modeMatch[2], 10);
          const ratesStr = modeMatch[3];
          const activeRateMatch = ratesStr.match(/([\d.]+)\s*\*/);
          if (modeW > 0 && modeH > 0) {
            currentConnector.width = modeW;
            currentConnector.height = modeH;
          }
          if (activeRateMatch) {
            currentConnector.refreshRateHz = Math.round(parseFloat(activeRateMatch[1]));
          }
          currentConnector.foundActiveMode = true;
        }
      }
    }
    if (currentConnector) {
      displays.push(formatDisplayObject(currentConnector, displays.length));
    }
  }

  if (displays.length === 0 && Array.isArray(drmConnectors) && drmConnectors.length > 0) {
    for (const conn of drmConnectors) {
      if (conn.status && conn.status.toLowerCase() !== 'connected') continue;
      const modeStr = String(conn.mode || (Array.isArray(conn.modes) ? conn.modes[0] : '') || '1920x1080');
      const m = modeStr.match(/(\d{3,5})x(\d{3,5})(?:[@p](\d+))?/);
      const width = m ? parseInt(m[1], 10) : 1920;
      const height = m ? parseInt(m[2], 10) : 1080;
      const hz = Number(conn.refreshRateHz) || (m && m[3] ? parseInt(m[3], 10) : 60);
      displays.push(formatDisplayObject({
        name: conn.name || `${conn.connector || 'DRM'} Display`,
        deviceName: conn.connector || `card0-DP-${displays.length + 1}`,
        width,
        height,
        refreshRateHz: hz,
        isPrimary: displays.length === 0,
        probeEngine: 'linux-drm-sysfs'
      }, displays.length));
    }
  }

  if (displays.length === 0) {
    displays.push(formatDisplayObject({
      name: 'Linux Primary Display',
      deviceName: 'DP-1',
      width: 1920,
      height: 1080,
      refreshRateHz: 60,
      isPrimary: true,
      probeEngine: 'linux-default'
    }, 0));
  }

  displays.sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0));
  if (!displays.some((d) => d.isPrimary)) {
    displays[0].isPrimary = true;
  }

  const primary = displays[0];
  Object.defineProperties(displays, {
    primary: { value: primary, enumerable: false },
    primaryDisplay: { value: primary, enumerable: false }
  });
  return displays;
}

function readLinuxDrmConnectors(drmRoot = '/sys/class/drm') {
  const connectors = [];
  try {
    if (!fs.existsSync(drmRoot)) return connectors;
    const entries = fs.readdirSync(drmRoot);
    for (const entry of entries) {
      if (!/^card\d+-/.test(entry)) continue;
      const connDir = path.join(drmRoot, entry);
      const status = safeReadFile(path.join(connDir, 'status')).trim();
      if (status !== 'connected') continue;
      const modesRaw = safeReadFile(path.join(connDir, 'modes')).trim();
      const firstMode = modesRaw.split(/\r?\n/)[0] || '1920x1080';
      connectors.push({
        connector: entry.replace(/^card\d+-/, ''),
        status,
        mode: firstMode
      });
    }
  } catch (e) {
    // ignore
  }
  return connectors;
}

// ============================================================================
// LIVE LINUX PROBING & FULL SPEC ASSEMBLER
// ============================================================================

function safeReadFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (e) {
    return '';
  }
}

function safeExec(cmd, timeout = 3000) {
  try {
    return execSync(cmd, {
      encoding: 'utf8',
      timeout,
      stdio: ['ignore', 'pipe', 'ignore']
    });
  } catch (e) {
    return '';
  }
}

function readLinuxSysfsCards(sysfsRoot = '/sys/class/drm') {
  const cards = [];
  try {
    if (!fs.existsSync(sysfsRoot)) return cards;
    const entries = fs.readdirSync(sysfsRoot);
    for (const entry of entries) {
      if (!/^card\d+$/.test(entry)) continue;
      const deviceDir = path.join(sysfsRoot, entry, 'device');
      if (!fs.existsSync(deviceDir)) continue;

      const vendor = safeReadFile(path.join(deviceDir, 'vendor')).trim();
      const device = safeReadFile(path.join(deviceDir, 'device')).trim();
      const vramTotalStr = safeReadFile(path.join(deviceDir, 'mem_info_vram_total')).trim();
      const uevent = safeReadFile(path.join(deviceDir, 'uevent')).trim();
      const productName = safeReadFile(path.join(deviceDir, 'product_name')).trim()
        || safeReadFile(path.join(deviceDir, 'label')).trim();

      if (vendor || device || vramTotalStr || uevent) {
        cards.push({
          card: entry,
          vendor,
          device,
          vramBytes: vramTotalStr ? parseInt(vramTotalStr, 10) : 0,
          uevent,
          productName
        });
      }
    }
  } catch (e) {
    // ignore sysfs read errors
  }
  return cards;
}

function parseLinuxOsRelease(osReleaseText = '') {
  if (osReleaseText) {
    const prettyMatch = osReleaseText.match(/^PRETTY_NAME=["']?([^"'\r\n]+)["']?/m);
    if (prettyMatch) {
      return `${prettyMatch[1].trim()} (${os.release()})`;
    }
    const nameMatch = osReleaseText.match(/^NAME=["']?([^"'\r\n]+)["']?/m);
    const verMatch = osReleaseText.match(/^VERSION_ID=["']?([^"'\r\n]+)["']?/m);
    if (nameMatch) {
      return `${nameMatch[1].trim()}${verMatch ? ' ' + verMatch[1].trim() : ''} (${os.release()})`;
    }
  }
  return `Linux ${os.release()}`;
}

/**
 * Full Linux hardware detector. Reads live `/proc`, `/sys`, and CLI tools on Linux,
 * or accepts deterministic `overrides` for cross-platform unit testing.
 */
function detectLinuxSpecs(overrides = null) {
  const isMocked = Boolean(overrides && typeof overrides === 'object');

  const cpuinfoText = isMocked && overrides.cpuinfoText !== undefined
    ? overrides.cpuinfoText
    : safeReadFile('/proc/cpuinfo');
  const lscpuText = isMocked && overrides.lscpuText !== undefined
    ? overrides.lscpuText
    : (!cpuinfoText || !/model name/i.test(cpuinfoText) ? safeExec('lscpu') : '');

  const meminfoText = isMocked && overrides.meminfoText !== undefined
    ? overrides.meminfoText
    : safeReadFile('/proc/meminfo');

  const dfText = isMocked && overrides.dfText !== undefined
    ? overrides.dfText
    : (safeExec('df -BM --output=source,fstype,size,used,avail,target') || safeExec('df -BM -P'));

  const gpuInputs = isMocked && overrides.gpuInputs !== undefined
    ? overrides.gpuInputs
    : {
        nvidiaSmiOutput: isMocked && overrides.nvidiaSmiOutput !== undefined
          ? overrides.nvidiaSmiOutput
          : safeExec('nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv,noheader,nounits'),
        sysfsCards: isMocked && overrides.sysfsCards !== undefined
          ? overrides.sysfsCards
          : readLinuxSysfsCards(),
        lspciOutput: isMocked && overrides.lspciOutput !== undefined
          ? overrides.lspciOutput
          : safeExec('lspci -vnn'),
        glxinfoOutput: isMocked && overrides.glxinfoOutput !== undefined
          ? overrides.glxinfoOutput
          : safeExec('glxinfo -B'),
        rocmSmiOutput: isMocked && overrides.rocmSmiOutput !== undefined
          ? overrides.rocmSmiOutput
          : '',
        nvidiaVersionText: isMocked && overrides.nvidiaVersionText !== undefined
          ? overrides.nvidiaVersionText
          : safeReadFile('/proc/driver/nvidia/version'),
        amdgpuVersionText: isMocked && overrides.amdgpuVersionText !== undefined
          ? overrides.amdgpuVersionText
          : safeReadFile('/sys/module/amdgpu/version')
      };

  const osReleaseText = isMocked && overrides.osReleaseText !== undefined
    ? overrides.osReleaseText
    : safeReadFile('/etc/os-release');

  const cpu = parseLinuxCpuInfo(cpuinfoText, lscpuText);
  const ram = parseLinuxMemInfo(meminfoText);
  const parsedDrives = parseLinuxDfOutput(dfText);

  let storage;
  if (parsedDrives.length > 0) {
    const bestDrive = [...parsedDrives].sort((a, b) => b.freeGB - a.freeGB)[0];
    storage = {
      drive: bestDrive.drive,
      label: bestDrive.label,
      freeGB: bestDrive.freeGB,
      totalGB: bestDrive.totalGB,
      usedGB: bestDrive.usedGB,
      usedPercent: bestDrive.usedPercent,
      allDrives: parsedDrives
    };
  } else {
    // Fallback to fs.statfsSync('/') if df is unavailable
    let freeGB = 150;
    let totalGB = 500;
    if (typeof fs.statfsSync === 'function') {
      try {
        const stats = fs.statfsSync('/');
        if (stats && stats.blocks > 0) {
          freeGB = Math.round((stats.bavail * stats.bsize) / (1024 ** 3));
          totalGB = Math.round((stats.blocks * stats.bsize) / (1024 ** 3));
        }
      } catch (e) {
        // ignore
      }
    }
    const usedGB = Math.max(0, totalGB - freeGB);
    const usedPercent = totalGB > 0 ? Math.round((usedGB / totalGB) * 100) : 0;
    const rootEntry = { drive: '/', label: 'Root (/)', freeGB, totalGB, usedGB, usedPercent };
    storage = {
      drive: '/',
      label: 'Root (/)',
      freeGB,
      totalGB,
      usedGB,
      usedPercent,
      allDrives: [rootEntry]
    };
  }

  const gpus = parseLinuxGpuInfo(gpuInputs);
  const primaryGpu = gpus.primaryGpu;
  const gpuEval = scoreGPU(primaryGpu.name, primaryGpu.vramGB);

  const displayInputs = isMocked && overrides.displayInputs !== undefined
    ? overrides.displayInputs
    : {
        xrandrOutput: isMocked && overrides.xrandrOutput !== undefined
          ? overrides.xrandrOutput
          : safeExec('xrandr --current'),
        drmConnectors: isMocked && overrides.drmConnectors !== undefined
          ? overrides.drmConnectors
          : readLinuxDrmConnectors()
      };
  const linuxDisplays = parseLinuxDisplayInfo(displayInputs);
  const primaryDisplay = linuxDisplays.primaryDisplay || linuxDisplays[0];

  return {
    detectedAt: new Date().toISOString(),
    platform: 'linux',
    os: parseLinuxOsRelease(osReleaseText),
    cpu: {
      name: cpu.name,
      cores: cpu.cores,
      threads: cpu.threads,
      speedGHz: cpu.speedGHz,
      score: cpu.score
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
      allDetected: Array.from(gpus)
    },
    ram: {
      totalGB: ram.totalGB,
      freeGB: ram.freeGB
    },
    storage,
    display: primaryDisplay,
    displays: Array.from(linuxDisplays)
  };
}

function detectWindowsSpecs() {
  const cpus = os.cpus() || [];
  const cpuModel = (cpus[0]?.model || 'Unknown CPU').trim();
  const threads = cpus.length || 4;
  const baseSpeedMHz = cpus[0]?.speed || 3000;
  const totalRamGB = Math.round(os.totalmem() / (1024 ** 3));
  const freeRamGB = Math.round(os.freemem() / (1024 ** 3));

  let gpus = detectGPUsFromWindowsRegistry();
  if (gpus.length === 0) {
    gpus = detectGPUsFromWindowsCim();
  }
  const primaryGpu = gpus[0] || {
    name: 'Integrated / Unknown GPU',
    driverVersion: 'N/A',
    vramMB: 2048,
    vramGB: 2
  };

  const cpuEval = scoreCPU(cpuModel, threads);
  const gpuEval = scoreGPU(primaryGpu.name, primaryGpu.vramGB);
  const storage = detectWindowsStorageDrives();
  const displays = detectWindowsDisplays();
  const primaryDisplay = displays[0];

  const osRelease = os.release();
  const buildNum = parseInt(osRelease.split('.')[2] || '0', 10);
  const osName = os.platform() === 'win32'
    ? (buildNum >= 22000 ? `Windows 11 (Build ${buildNum})` : `Windows 10 (Build ${buildNum})`)
    : `${os.type()} ${osRelease}`;

  return {
    detectedAt: new Date().toISOString(),
    platform: 'win32',
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
      usedGB: storage.usedGB,
      usedPercent: storage.usedPercent,
      allDrives: storage.allDrives
    },
    display: primaryDisplay,
    displays
  };
}

function detectDisplays() {
  if (process.platform === 'linux') {
    return Array.from(parseLinuxDisplayInfo({
      xrandrOutput: safeExec('xrandr --current'),
      drmConnectors: readLinuxDrmConnectors()
    }));
  }
  return detectWindowsDisplays();
}

function detectStorageDrives() {
  if (process.platform === 'linux') {
    const specs = detectLinuxSpecs();
    return specs.storage;
  }
  return detectWindowsStorageDrives();
}

function detectDriverSuites(specs = {}) {
  const suites = [];
  const gpuName = String(specs?.gpu?.name || '').toLowerCase();
  let gpuVendor = String(specs?.gpu?.vendor || '').toLowerCase();
  if (!gpuVendor || gpuVendor === 'unknown') {
    if (/nvidia|geforce|rtx|gtx/.test(gpuName)) gpuVendor = 'nvidia';
    else if (/amd|radeon|\brx\s*\d/.test(gpuName)) gpuVendor = 'amd';
    else if (/intel|\barc\b|uhd|iris/.test(gpuName)) gpuVendor = 'intel';
  }
  const driverVersion = specs?.gpu?.driverVersion || 'N/A';

  if (process.platform === 'win32') {
    const hasFile = (p) => {
      try { return fs.existsSync(p); } catch { return false; }
    };
    const amdExe = 'C:\\Program Files\\AMD\\CNext\\CNext\\RadeonSoftware.exe';
    if (hasFile(amdExe) || gpuVendor === 'amd') {
      suites.push({
        id: 'amd_adrenalin',
        name: 'AMD Software: Adrenalin Edition',
        detected: true,
        installStatus: hasFile(amdExe) ? 'INSTALLED' : 'DRIVER_ONLY',
        version: gpuVendor === 'amd' ? driverVersion : 'N/A',
        exePath: hasFile(amdExe) ? amdExe : ''
      });
    }

    const nvApp = 'C:\\Program Files\\NVIDIA Corporation\\NVIDIA App\\NVIDIA App.exe';
    const nvCp = 'C:\\Program Files\\NVIDIA Corporation\\Control Panel Client\\nvcplui.exe';
    if (hasFile(nvApp) || hasFile(nvCp) || gpuVendor === 'nvidia') {
      suites.push({
        id: 'nvidia_app',
        name: 'NVIDIA App / Control Panel',
        detected: true,
        installStatus: (hasFile(nvApp) || hasFile(nvCp)) ? 'INSTALLED' : 'DRIVER_ONLY',
        version: gpuVendor === 'nvidia' ? driverVersion : 'N/A',
        exePath: hasFile(nvApp) ? nvApp : (hasFile(nvCp) ? nvCp : '')
      });
    }

    const igsExe = 'C:\\Program Files\\Intel\\Intel Graphics Software\\IntelGraphicsSoftware.exe';
    const arcExe = 'C:\\Program Files\\Intel\\Intel Arc Control\\ArcControl.exe';
    if (hasFile(igsExe) || hasFile(arcExe) || gpuVendor === 'intel') {
      suites.push({
        id: 'intel_arc',
        name: 'Intel Arc Control / Graphics Software',
        detected: true,
        installStatus: (hasFile(igsExe) || hasFile(arcExe)) ? 'INSTALLED' : 'DRIVER_ONLY',
        version: gpuVendor === 'intel' ? driverVersion : 'N/A',
        exePath: hasFile(igsExe) ? igsExe : (hasFile(arcExe) ? arcExe : '')
      });
    }
  } else {
    const hasPath = (p) => {
      try { return fs.existsSync(p); } catch { return false; }
    };
    if (gpuVendor === 'amd' || hasPath('/sys/module/amdgpu') || hasPath('/usr/bin/corectrl') || hasPath('/usr/bin/lact')) {
      const exe = hasPath('/usr/bin/lact') ? '/usr/bin/lact' : (hasPath('/usr/bin/corectrl') ? '/usr/bin/corectrl' : '');
      suites.push({
        id: 'amd_adrenalin',
        name: exe.includes('lact') ? 'AMD amdgpu / LACT' : (exe.includes('corectrl') ? 'AMD amdgpu / CoreCtrl' : 'AMD amdgpu Kernel Driver'),
        detected: true,
        installStatus: exe ? 'INSTALLED' : 'DRIVER_ONLY',
        version: driverVersion,
        exePath: exe
      });
    }
    if (gpuVendor === 'nvidia' || hasPath('/usr/bin/nvidia-settings') || hasPath('/sys/module/nvidia')) {
      const exe = hasPath('/usr/bin/nvidia-settings') ? '/usr/bin/nvidia-settings' : '';
      suites.push({
        id: 'nvidia_app',
        name: 'NVIDIA Settings (Linux)',
        detected: true,
        installStatus: exe ? 'INSTALLED' : 'DRIVER_ONLY',
        version: driverVersion,
        exePath: exe
      });
    }
    if (gpuVendor === 'intel' || hasPath('/sys/module/i915') || hasPath('/sys/module/xe')) {
      suites.push({
        id: 'intel_arc',
        name: hasPath('/sys/module/xe') ? 'Intel Xe / Arc Linux Driver' : 'Intel i915 Linux Driver',
        detected: true,
        installStatus: 'DRIVER_ONLY',
        version: driverVersion,
        exePath: ''
      });
    }
  }
  return suites;
}

function detectSystemSpecs() {
  const specs = (process.platform === 'linux') ? detectLinuxSpecs() : detectWindowsSpecs();
  specs.driverSuites = detectDriverSuites(specs);
  return specs;
}

module.exports = {
  detectSystemSpecs,
  detectDriverSuites,
  detectLinuxSpecs,
  detectWindowsSpecs,
  detectStorageDrives,
  detectDisplays,
  detectWindowsDisplays,
  parseLinuxCpuInfo,
  parseLinuxMemInfo,
  parseLinuxDfOutput,
  parseLinuxGpuInfo,
  parseLinuxDisplayInfo,
  formatDisplayObject,
  sortGPUsByPriority,
  scoreCPU,
  scoreGPU,
  GPU_BENCHMARKS,
  CPU_BENCHMARKS
};
