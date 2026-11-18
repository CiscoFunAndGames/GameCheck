const assert = require('assert');
const {
  detectSystemSpecs,
  detectLinuxSpecs,
  parseLinuxCpuInfo,
  parseLinuxMemInfo,
  parseLinuxDfOutput,
  parseLinuxGpuInfo,
  parseLinuxDisplayInfo,
  scoreCPU,
  scoreGPU,
  CPU_BENCHMARKS,
  GPU_BENCHMARKS
} = require('../src/hardware');
const { analyzeGameCompatibility } = require('../src/analyzer');
const { getGameById } = require('../src/games-db');
const { getPerSettingImpact, exportGameConfigFiles } = require('../src/config-exporter');

function runHardwareTests() {
  console.log('--- Running Cross-Platform Hardware Detector Tests (test/hardware.test.js) ---');

  // 1. Verify exports & benchmark tables
  assert.ok(Array.isArray(CPU_BENCHMARKS) && CPU_BENCHMARKS.length > 10, 'CPU_BENCHMARKS should be populated');
  assert.ok(Array.isArray(GPU_BENCHMARKS) && GPU_BENCHMARKS.length > 20, 'GPU_BENCHMARKS should be populated');

  const r5Score = scoreCPU('AMD Ryzen 5 5500', 12);
  assert.strictEqual(r5Score.score, 62, 'Ryzen 5 5500 should score 62');
  assert.strictEqual(r5Score.estimatedCores, 6, 'Ryzen 5 5500 should have 6 cores');

  const rx7600Score = scoreGPU('AMD Radeon RX 7600', 8);
  assert.strictEqual(rx7600Score.score, 61, 'RX 7600 should score 61');
  assert.strictEqual(rx7600Score.vramGB, 8, 'RX 7600 should have 8 GB VRAM');
  assert.strictEqual(rx7600Score.vendor, 'amd', 'RX 7600 vendor should be amd');
  assert.strictEqual(rx7600Score.rtCapable, true, 'RX 7600 should be RT capable');
  assert.strictEqual(rx7600Score.upscaler, 'FSR 3', 'RX 7600 upscaler should be FSR 3');

  const rtx4070Score = scoreGPU('NVIDIA GeForce RTX 4070', 12);
  assert.strictEqual(rtx4070Score.score, 77, 'RTX 4070 should score 77');
  assert.strictEqual(rtx4070Score.vramGB, 12, 'RTX 4070 should have 12 GB VRAM');
  assert.strictEqual(rtx4070Score.vendor, 'nvidia', 'RTX 4070 vendor should be nvidia');
  assert.strictEqual(rtx4070Score.upscaler, 'DLSS 3', 'RTX 4070 upscaler should be DLSS 3');

  console.log('  [PASS] Benchmark tables & scoreCPU / scoreGPU heuristics');

  // 2. Test parseLinuxCpuInfo (/proc/cpuinfo + lscpu fallback)
  const sampleProcCpuinfo = Array.from({ length: 12 }, (_, idx) => `
processor\t: ${idx}
vendor_id\t: AuthenticAMD
cpu family\t: 25
model\t\t: 80
model name\t: AMD Ryzen 5 5600X 6-Core Processor
stepping\t: 0
cpu MHz\t\t: ${idx % 2 === 0 ? '4650.000' : '3700.000'}
cache size\t: 512 KB
physical id\t: 0
siblings\t: 12
core id\t\t: ${idx % 6}
cpu cores\t: 6
`).join('\n');

  const parsedCpu = parseLinuxCpuInfo(sampleProcCpuinfo);
  assert.strictEqual(parsedCpu.name, 'AMD Ryzen 5 5600X 6-Core Processor');
  assert.strictEqual(parsedCpu.cores, 6);
  assert.strictEqual(parsedCpu.threads, 12);
  assert.strictEqual(parsedCpu.speedGHz, 4.65);
  assert.strictEqual(parsedCpu.score, 72);

  // Test lscpu fallback when /proc/cpuinfo is empty
  const sampleLscpu = `
Architecture:             x86_64
CPU op-mode(s):           32-bit, 64-bit
CPU(s):                   16
Thread(s) per core:       2
Core(s) per socket:       8
Socket(s):                1
Vendor ID:                AuthenticAMD
Model name:               AMD Ryzen 7 7800X3D 8-Core Processor
CPU max MHz:              5050.0000
CPU min MHz:              3000.0000
`;
  const parsedLscpu = parseLinuxCpuInfo('', sampleLscpu);
  assert.strictEqual(parsedLscpu.name, 'AMD Ryzen 7 7800X3D 8-Core Processor');
  assert.strictEqual(parsedLscpu.cores, 8);
  assert.strictEqual(parsedLscpu.threads, 16);
  assert.strictEqual(parsedLscpu.speedGHz, 5.05);
  assert.strictEqual(parsedLscpu.score, 97);

  console.log('  [PASS] parseLinuxCpuInfo (/proc/cpuinfo & lscpu fallback)');

  // 3. Test parseLinuxMemInfo (/proc/meminfo in kB -> GB)
  const sampleMeminfo = `
MemTotal:       32845824 kB
MemFree:         8421376 kB
MemAvailable:   24117248 kB
Buffers:          512000 kB
Cached:         14800000 kB
SwapTotal:       8388604 kB
SwapFree:        8388604 kB
`;
  const parsedMem = parseLinuxMemInfo(sampleMeminfo);
  assert.strictEqual(parsedMem.totalGB, 31);
  assert.strictEqual(parsedMem.freeGB, 23);
  assert.strictEqual(parsedMem.usedGB, 8);

  console.log('  [PASS] parseLinuxMemInfo (/proc/meminfo kB -> GB)');

  // 4. Test parseLinuxDfOutput (df -BM filtering & mount extraction)
  const sampleDfOutput = `
Filesystem     Type     1M-blocks    Used   Avail Mounted on
devtmpfs       devtmpfs     16384M      0M  16384M /dev
tmpfs          tmpfs        16384M    120M  16264M /dev/shm
tmpfs          tmpfs         6554M      2M   6552M /run
/dev/nvme0n1p2 ext4        953869M 412300M 493100M /
efivarfs       efivarfs         1M      1M      0M /sys/firmware/efi/efivars
/dev/nvme0n1p1 vfat           511M      6M    505M /boot/efi
/dev/loop0     squashfs       128M    128M      0M /snap/core22/1621
/dev/nvme1n1p1 ext4       1907729M 650000M 1257729M /mnt/games
/dev/sda1      btrfs       476940M 120000M 356940M /run/media/gamer/SteamDeckSD
`;
  const parsedDrives = parseLinuxDfOutput(sampleDfOutput);
  assert.strictEqual(parsedDrives.length, 3, 'Should filter out devtmpfs, tmpfs, efivarfs, /boot/efi, and /snap/*');
  assert.strictEqual(parsedDrives[0].drive, '/');
  assert.strictEqual(parsedDrives[0].totalGB, 932);
  assert.strictEqual(parsedDrives[0].freeGB, 482);
  assert.ok(parsedDrives[0].usedPercent > 0 && parsedDrives[0].usedPercent < 100);

  assert.strictEqual(parsedDrives[1].drive, '/mnt/games');
  assert.strictEqual(parsedDrives[1].totalGB, 1863);
  assert.strictEqual(parsedDrives[1].freeGB, 1228);

  assert.strictEqual(parsedDrives[2].drive, '/run/media/gamer/SteamDeckSD');
  assert.strictEqual(parsedDrives[2].freeGB, 349);

  // Also test standard POSIX `df -BM -P` format
  const sampleDfPosix = `
Filesystem     1048576-blocks    Used Available Capacity Mounted on
tmpfs                  16384M     10M    16374M       1% /run
/dev/nvme0n1p3        512000M 204800M   307200M      40% /
/dev/nvme0n1p4       1024000M 256000M   768000M      25% /home
`;
  const parsedPosixDrives = parseLinuxDfOutput(sampleDfPosix);
  assert.strictEqual(parsedPosixDrives.length, 2);
  assert.strictEqual(parsedPosixDrives[0].drive, '/');
  assert.strictEqual(parsedPosixDrives[0].totalGB, 500);
  assert.strictEqual(parsedPosixDrives[0].freeGB, 300);
  assert.strictEqual(parsedPosixDrives[1].drive, '/home');
  assert.strictEqual(parsedPosixDrives[1].totalGB, 1000);
  assert.strictEqual(parsedPosixDrives[1].freeGB, 750);

  console.log('  [PASS] parseLinuxDfOutput (mount parsing & pseudo-FS filtering)');

  // 5. Test parseLinuxGpuInfo: AMD Radeon RX 7600 via sysfs + lspci + glxinfo (with iGPU present)
  const amdSysfsCards = [
    {
      card: 'card0',
      vendor: '0x8086',
      device: '0x4680',
      vramBytes: 0,
      uevent: 'DRIVER=i915\nPCI_ID=8086:4680\nPCI_SLOT_NAME=0000:00:02.0'
    },
    {
      card: 'card1',
      vendor: '0x1002',
      device: '0x7480',
      vramBytes: 8589934592, // 8 GB exact VRAM from mem_info_vram_total
      uevent: 'DRIVER=amdgpu\nPCI_ID=1002:7480\nPCI_SLOT_NAME=0000:03:00.0'
    }
  ];

  const amdLspciOutput = `
00:02.0 VGA compatible controller [0300]: Intel Corporation AlderLake-S GT1 [UHD Graphics 770] [8086:4680] (rev 0c)
\tDeviceName: Onboard - Video
\tKernel driver in use: i915

03:00.0 VGA compatible controller [0300]: Advanced Micro Devices, Inc. [AMD/ATI] Navi 33 [Radeon RX 7600/7600 XT/7600M XT/7600S/7700S / PRO W7600] [1002:7480] (rev cf)
\tSubsystem: Sapphire Technology Limited Device [1da2:e452]
\tMemory at e000000000 (64-bit, prefetchable) [size=8G]
\tMemory at f0000000 (64-bit, prefetchable) [size=256M]
\tKernel driver in use: amdgpu
`;

  const amdGlxinfoOutput = `
Extended renderer info (GLX_MESA_query_renderer):
    Vendor: AMD (0x1002)
    Device: AMD Radeon RX 7600 (radeonsi, navi33, LLVM 17.0.6, DRM 3.57, 6.8.0-45-generic) (0x7480)
    Version: 24.0.9
    Accelerated: yes
    Video memory: 8192MB
OpenGL version string: 4.6 (Compatibility Profile) Mesa 24.0.9-0ubuntu0.1
`;

  const amdGpus = parseLinuxGpuInfo({
    sysfsCards: amdSysfsCards,
    lspciOutput: amdLspciOutput,
    glxinfoOutput: amdGlxinfoOutput
  });

  assert.ok(Array.isArray(amdGpus) && amdGpus.length === 2, 'Should detect both discrete AMD and integrated Intel GPUs');
  assert.strictEqual(amdGpus[0].name, 'AMD Radeon RX 7600', 'Discrete AMD Radeon RX 7600 should be sorted first');
  assert.strictEqual(amdGpus[0].vramGB, 8);
  assert.strictEqual(amdGpus[0].vramMB, 8192);
  assert.strictEqual(amdGpus[0].vendor, 'amd');
  assert.strictEqual(amdGpus[0].driverVersion, 'Mesa 24.0.9-0ubuntu0.1');
  assert.strictEqual(amdGpus[0].score, 61);
  assert.ok(/UHD Graphics 770/i.test(amdGpus[1].name), 'Integrated GPU should be sorted second');

  console.log('  [PASS] parseLinuxGpuInfo (AMD RX 7600 via sysfs + lspci + glxinfo & multi-GPU sorting)');

  // 6. Test parseLinuxGpuInfo: NVIDIA GeForce RTX 4070 via nvidia-smi
  const nvidiaSmiCsv = 'NVIDIA GeForce RTX 4070, 12282, 550.54.14\n';
  const nvidiaGpus = parseLinuxGpuInfo({
    nvidiaSmiOutput: nvidiaSmiCsv
  });

  assert.strictEqual(nvidiaGpus.length, 1);
  assert.strictEqual(nvidiaGpus[0].name, 'NVIDIA GeForce RTX 4070');
  assert.strictEqual(nvidiaGpus[0].vramGB, 12);
  assert.strictEqual(nvidiaGpus[0].vramMB, 12282);
  assert.strictEqual(nvidiaGpus[0].driverVersion, '550.54.14');
  assert.strictEqual(nvidiaGpus[0].vendor, 'nvidia');
  assert.strictEqual(nvidiaGpus[0].score, 77);

  console.log('  [PASS] parseLinuxGpuInfo (NVIDIA RTX 4070 via nvidia-smi)');

  // 7. Test end-to-end detectLinuxSpecs with simulated Linux system
  const simulatedLinuxSpecs = detectLinuxSpecs({
    osReleaseText: 'NAME="Ubuntu"\nVERSION_ID="24.04"\nPRETTY_NAME="Ubuntu 24.04.1 LTS"\n',
    cpuinfoText: sampleProcCpuinfo,
    meminfoText: sampleMeminfo,
    dfText: sampleDfOutput,
    sysfsCards: amdSysfsCards,
    lspciOutput: amdLspciOutput,
    glxinfoOutput: amdGlxinfoOutput
  });

  assert.strictEqual(simulatedLinuxSpecs.platform, 'linux');
  assert.ok(simulatedLinuxSpecs.os.includes('Ubuntu 24.04.1 LTS'));
  assert.strictEqual(simulatedLinuxSpecs.cpu.name, 'AMD Ryzen 5 5600X 6-Core Processor');
  assert.strictEqual(simulatedLinuxSpecs.cpu.cores, 6);
  assert.strictEqual(simulatedLinuxSpecs.cpu.threads, 12);
  assert.strictEqual(simulatedLinuxSpecs.gpu.name, 'AMD Radeon RX 7600');
  assert.strictEqual(simulatedLinuxSpecs.gpu.vramGB, 8);
  assert.strictEqual(simulatedLinuxSpecs.ram.totalGB, 31);
  assert.strictEqual(simulatedLinuxSpecs.storage.drive, '/mnt/games');
  assert.strictEqual(simulatedLinuxSpecs.storage.freeGB, 1228);
  assert.strictEqual(simulatedLinuxSpecs.storage.allDrives.length, 3);

  console.log('  [PASS] detectLinuxSpecs (Full simulated Linux rig end-to-end)');

  // 8. Test parseLinuxDisplayInfo (xrandr + DRM sysfs)
  const sampleXrandr = `
Screen 0: minimum 320 x 200, current 4480 x 1440, maximum 16384 x 16384
DP-1 connected primary 2560x1440+0+0 (normal left inverted right x axis y axis) 597mm x 336mm
   2560x1440    165.00*+ 144.00   120.00    60.00
   1920x1080    120.00    60.00
HDMI-A-1 connected 1920x1080+2560+0 (normal left inverted right x axis y axis) 527mm x 296mm
   1920x1080     75.00*+  60.00
DP-2 disconnected (normal left inverted right x axis y axis)
`;
  const linuxDisplays = parseLinuxDisplayInfo(sampleXrandr);
  assert.strictEqual(linuxDisplays.length, 2);
  assert.strictEqual(linuxDisplays[0].deviceName, 'DP-1');
  assert.strictEqual(linuxDisplays[0].width, 2560);
  assert.strictEqual(linuxDisplays[0].height, 1440);
  assert.strictEqual(linuxDisplays[0].tier, '1440p');
  assert.strictEqual(linuxDisplays[0].refreshRateHz, 165);
  assert.strictEqual(linuxDisplays[0].isPrimary, true);
  assert.strictEqual(linuxDisplays[1].deviceName, 'HDMI-A-1');
  assert.strictEqual(linuxDisplays[1].refreshRateHz, 75);

  console.log('  [PASS] parseLinuxDisplayInfo (xrandr primary 1440p@165Hz & multi-monitor)');

  // 9. Test live host hardware & native display detection (`detectSystemSpecs()`)
  const liveSpecs = detectSystemSpecs();
  assert.ok(liveSpecs && typeof liveSpecs === 'object', 'detectSystemSpecs should return an object');
  assert.ok(typeof liveSpecs.os === 'string' && liveSpecs.os.length > 0, 'OS name should be present');
  assert.ok(liveSpecs.cpu && typeof liveSpecs.cpu.name === 'string', 'CPU name should be detected');
  assert.ok(liveSpecs.cpu.cores >= 1 && liveSpecs.cpu.threads >= 1, 'CPU cores/threads should be >= 1');
  assert.ok(liveSpecs.cpu.score >= 10, 'CPU score should be valid');
  assert.ok(liveSpecs.gpu && typeof liveSpecs.gpu.name === 'string', 'GPU name should be detected');
  assert.ok(liveSpecs.gpu.vramGB >= 1, 'GPU VRAM should be >= 1 GB');
  assert.ok(liveSpecs.ram && liveSpecs.ram.totalGB >= 1, 'System RAM should be >= 1 GB');
  assert.ok(liveSpecs.storage && Array.isArray(liveSpecs.storage.allDrives), 'Storage drives array should be present');
  assert.ok(liveSpecs.storage.allDrives.length >= 1, 'At least 1 storage drive should be detected');
  assert.ok(liveSpecs.display && liveSpecs.display.width >= 640 && liveSpecs.display.refreshRateHz >= 30, 'Primary display should be detected');
  assert.ok(Array.isArray(liveSpecs.displays) && liveSpecs.displays.length >= 1, 'Displays array should be present');

  console.log(`  [PASS] Live Host Detection: ${liveSpecs.os} | ${liveSpecs.cpu.name} | ${liveSpecs.gpu.name} (${liveSpecs.gpu.vramGB}GB) | Display: ${liveSpecs.display.name} (${liveSpecs.display.width}x${liveSpecs.display.height} @ ${liveSpecs.display.refreshRateHz}Hz)`);

  // 10. Test 4 Screen-Aware Optimization Modes (`optimal`, `full_fps`, `balanced`, `quality_30_60`)
  const cp2077 = getGameById('cyberpunk-2077');
  const modeOptimal = analyzeGameCompatibility(liveSpecs, cp2077, { optimizationMode: 'optimal' });
  const modeFullFps = analyzeGameCompatibility(liveSpecs, cp2077, { optimizationMode: 'full_fps' });
  const modeBalanced = analyzeGameCompatibility(liveSpecs, cp2077, { optimizationMode: 'balanced' });
  const modeQuality = analyzeGameCompatibility(liveSpecs, cp2077, { optimizationMode: 'quality_30_60' });

  assert.strictEqual(modeOptimal.optimalConfig.activeMode, 'optimal');
  assert.strictEqual(modeFullFps.optimalConfig.activeMode, 'full_fps');
  assert.strictEqual(modeBalanced.optimalConfig.activeMode, 'balanced');
  assert.strictEqual(modeQuality.optimalConfig.activeMode, 'quality_30_60');

  assert.ok(modeOptimal.optimalConfig.displayTarget.refreshRateHz >= 30);
  assert.ok(modeOptimal.optimalConfig.modeProfiles.full_fps);
  assert.ok(modeOptimal.optimalConfig.modeProfiles.quality_30_60);
  assert.ok(
    modeFullFps.optimalConfig.displayTarget.estimatedScreenFps.avg > modeQuality.optimalConfig.displayTarget.estimatedScreenFps.avg,
    'Full FPS mode should yield higher estimated screen FPS than Quality 30-60 mode'
  );
  assert.ok(
    modeQuality.optimalConfig.qualityScore > modeFullFps.optimalConfig.qualityScore,
    'Quality 30-60 mode should have higher visual qualityScore than Full FPS mode'
  );

  const exportedFullFps = exportGameConfigFiles(liveSpecs, cp2077, modeFullFps, { optimizationMode: 'full_fps' });
  assert.ok(exportedFullFps.iniContent.includes('OptimizationMode="full_fps"'));
  const impactsFullFps = getPerSettingImpact(liveSpecs, cp2077, modeFullFps, { optimizationMode: 'full_fps' });
  assert.strictEqual(impactsFullFps.length, 8);

  console.log('  [PASS] 4 Screen-Aware Optimization Modes (optimal, full_fps, balanced, quality_30_60)');
  console.log('--- All Hardware Tests Passed! ---\n');
}

if (require.main === module) {
  runHardwareTests();
}

module.exports = { runHardwareTests };
