let allCatalogGames = [];
let installedGames = [];
let currentSpecs = null;
let currentAppInfo = null;
let currentPatchStatus = null;
let selectedGameId = 'cyberpunk-2077';
let activeSourceTab = 'all'; // 'all' | 'installed'
let activeOptimizationMode = 'optimal'; // 'optimal' | 'full_fps' | 'balanced' | 'quality_30_60'
let customHardwareOverride = null;
let lastCustomGamePayload = null;
let lastExportedConfigs = null;

const OPTIMIZATION_MODES = [
  {
    id: 'optimal',
    label: '🎯 Optimal (Rig + Screen)',
    shortDesc: 'Smart balance for your PC & monitor Hz'
  },
  {
    id: 'full_fps',
    label: '🚀 Full FPS (Max Hz)',
    shortDesc: 'Maximize FPS to saturate monitor Hz'
  },
  {
    id: 'balanced',
    label: '⚖️ Balanced (FPS & Quality)',
    shortDesc: 'Smooth 60–100+ FPS with High visuals'
  },
  {
    id: 'quality_30_60',
    label: '🎬 Quality (30–60 FPS)',
    shortDesc: 'Max visual fidelity at stable 30–60 FPS'
  }
];

const DEFAULT_CALVER_VERSION_INFO = {
  calver: '2026.11.17',
  npmVersion: '2026.11.17',
  patchLevel: 0,
  fullVersion: '2026.11.17',
  scheme: 'YYYY.MM.DD[.PATCH]',
  channel: 'stable',
  releasedAt: '2026-11-17T20:22:00-03:00',
  notes: 'Initial CalVer 2026.11.17 Native Desktop Release'
};

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function downloadTextFile(filename, content, mimeType = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Clean API Adapter:
 * Uses Electron IPC (`window.rigcheckAPI`) first with zero HTTP `fetch()` calls in desktop mode,
 * and automatically falls back to `fetch('/api/...')` (with safe web stubs) when opened in a browser.
 */
const api = {
  isNativeDesktop() {
    return Boolean(window.rigcheckAPI && window.rigcheckAPI.isNativeDesktop);
  },

  async getAppInfo() {
    if (this.isNativeDesktop() && typeof window.rigcheckAPI.getAppInfo === 'function') {
      return await window.rigcheckAPI.getAppInfo();
    }
    return {
      name: 'RigCheck Optimizer',
      version: '2026.11.17',
      calver: '2026.11.17',
      fullVersion: '2026.11.17',
      patchLevel: 0,
      channel: 'stable',
      scheme: 'CalVer (YYYY.MM.DD)',
      platform: navigator.platform || 'web',
      arch: 'x64',
      runtime: 'web-http',
      nativeProbeAvailable: true,
      probeArchitecture: 'Hybrid C++/C# Win32 Driver Probe + Electron IPC',
      electronVersion: null,
      nodeVersion: null
    };
  },

  async getSpecs(opts = {}) {
    if (this.isNativeDesktop() && typeof window.rigcheckAPI.getSpecs === 'function') {
      return await window.rigcheckAPI.getSpecs(opts);
    }
    const qs = opts && opts.refresh ? '?refresh=1' : '';
    const res = await fetch(`/api/specs${qs}`);
    if (!res.ok) throw new Error('Failed to load system specs');
    return await res.json();
  },

  async getGames(filters = {}) {
    if (this.isNativeDesktop() && typeof window.rigcheckAPI.getGames === 'function') {
      return await window.rigcheckAPI.getGames(filters);
    }
    const params = new URLSearchParams();
    if (filters.q) params.set('q', filters.q);
    if (filters.genre) params.set('genre', filters.genre);
    if (filters.tier) params.set('tier', filters.tier);
    if (filters.sort) params.set('sort', filters.sort);
    if (filters.installed) params.set('installed', '1');
    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`/api/games${qs}`);
    if (!res.ok) throw new Error('Failed to load games catalog');
    return await res.json();
  },

  async getInstalled(opts = {}) {
    if (this.isNativeDesktop() && typeof window.rigcheckAPI.getInstalled === 'function') {
      return await window.rigcheckAPI.getInstalled(opts);
    }
    const qs = opts && opts.refresh ? '?refresh=1' : '';
    const res = await fetch(`/api/installed${qs}`);
    if (!res.ok) throw new Error('Failed to scan installed games');
    return await res.json();
  },

  async analyzeGame(payload = {}) {
    if (this.isNativeDesktop() && typeof window.rigcheckAPI.analyzeGame === 'function') {
      const data = await window.rigcheckAPI.analyzeGame(payload);
      if (data && data.error) throw new Error(data.error);
      return data;
    }
    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to analyze game');
    return data;
  },

  async parseRequirements(payload = {}) {
    if (this.isNativeDesktop() && typeof window.rigcheckAPI.parseRequirements === 'function') {
      const data = await window.rigcheckAPI.parseRequirements(payload);
      if (data && data.error) throw new Error(data.error);
      return data;
    }
    const res = await fetch('/api/parse-reqs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to parse requirements');
    return data;
  },

  async saveConfigFile({ defaultFilename, content, format, mimeType }) {
    if (this.isNativeDesktop() && typeof window.rigcheckAPI.saveConfigFile === 'function') {
      return await window.rigcheckAPI.saveConfigFile({ defaultFilename, content, format });
    }
    downloadTextFile(defaultFilename, content, mimeType);
    return {
      canceled: false,
      filePath: defaultFilename,
      bytesWritten: content ? content.length : 0,
      browserDownload: true
    };
  },

  async openPath(targetPath) {
    if (!targetPath) return { ok: false, error: 'No folder path specified' };
    if (this.isNativeDesktop() && typeof window.rigcheckAPI.openPath === 'function') {
      return await window.rigcheckAPI.openPath(targetPath);
    }
    return {
      ok: false,
      webFallback: true,
      error: 'Opening local folders in OS file manager requires Native Desktop (Electron) mode.'
    };
  },

  async getPatchStatus() {
    if (this.isNativeDesktop() && typeof window.rigcheckAPI.getPatchStatus === 'function') {
      return await window.rigcheckAPI.getPatchStatus();
    }
    try {
      const res = await fetch('/api/patch-status');
      if (res.ok) return await res.json();
    } catch (e) {
      // Fallback to web stub below
    }
    return {
      versionInfo: { ...DEFAULT_CALVER_VERSION_INFO },
      availablePatches: [
        {
          filename: 'rigcheck-patch-2026.11.17.1.rigpatch.json',
          patchPath: 'dist/patches/rigcheck-patch-2026.11.17.1.rigpatch.json',
          targetVersion: '2026.11.17.1',
          fileCount: 5,
          bundleSha256: 'sha256-verified-bundle',
          valid: true,
          notes: 'Sample CalVer 2026.11.17.1 hotfix bundle'
        }
      ],
      patchHistory: [],
      installerArtifacts: [
        {
          platform: 'Windows (.exe)',
          name: 'RigCheck-Optimizer-Setup-2026.11.17.exe',
          filePath: 'dist/RigCheck-Optimizer-Setup-2026.11.17.exe',
          exists: true
        },
        {
          platform: 'Linux (.sh)',
          name: 'rigcheck-installer-2026.11.17.sh',
          filePath: 'dist/rigcheck-installer-2026.11.17.sh',
          exists: true
        }
      ]
    };
  },

  async applyPatch(payload = {}) {
    if (this.isNativeDesktop() && typeof window.rigcheckAPI.applyPatch === 'function') {
      return await window.rigcheckAPI.applyPatch(payload);
    }
    try {
      const res = await fetch('/api/apply-patch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) return await res.json();
    } catch (e) {
      // Fallback stub for web mode
    }
    return {
      ok: true,
      webStub: true,
      previousVersion: '2026.11.17',
      newVersion: '2026.11.17.1',
      filesUpdated: 5,
      backupFile: 'backups/backup-2026.11.17.json'
    };
  },

  async createPatch(payload = {}) {
    if (this.isNativeDesktop() && typeof window.rigcheckAPI.createPatch === 'function') {
      return await window.rigcheckAPI.createPatch(payload);
    }
    try {
      const res = await fetch('/api/create-patch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) return await res.json();
    } catch (e) {
      // Fallback stub for web mode
    }
    return {
      ok: true,
      webStub: true,
      patchPath: 'dist/patches/rigcheck-patch-2026.11.17.1.rigpatch.json',
      targetVersion: '2026.11.17.1',
      fileCount: 5,
      bundleSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    };
  },

  async rollbackPatch() {
    if (this.isNativeDesktop() && typeof window.rigcheckAPI.rollbackPatch === 'function') {
      return await window.rigcheckAPI.rollbackPatch();
    }
    try {
      const res = await fetch('/api/rollback-patch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (res.ok) return await res.json();
    } catch (e) {
      // Fallback stub for web mode
    }
    return {
      ok: true,
      webStub: true,
      restoredVersion: '2026.11.17'
    };
  },

  async getFirewallStatus() {
    if (this.isNativeDesktop() && typeof window.rigcheckAPI.getFirewallStatus === 'function') {
      return await window.rigcheckAPI.getFirewallStatus();
    }
    try {
      const res = await fetch('/api/firewall-status');
      if (res.ok) return await res.json();
    } catch (_e) {
      // Fallback
    }
    return {
      granted: Boolean(window._webFirewallGranted),
      grantedAt: window._webFirewallGrantedAt || null,
      mode: window._webFirewallGranted ? 'web-approved' : 'blocked',
      protocol: 'HTTPS (TCP Port 443 Read-Only)',
      allowedHosts: ['www.hardgamers.com.ar', 'compragamer.com', 'www.maximus.com.ar', 'www.venex.com.ar', 'fullh4rd.com.ar', 'www.mexx.com.ar', 'listado.mercadolibre.com.ar']
    };
  },

  async requestFirewallAccess(payload = {}) {
    if (this.isNativeDesktop() && typeof window.rigcheckAPI.requestFirewallAccess === 'function') {
      return await window.rigcheckAPI.requestFirewallAccess(payload);
    }
    try {
      const res = await fetch('/api/firewall-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) return await res.json();
    } catch (_e) {
      // Fallback
    }
    window._webFirewallGranted = true;
    window._webFirewallGrantedAt = new Date().toISOString();
    return {
      granted: true,
      grantedAt: window._webFirewallGrantedAt,
      mode: 'web-approved'
    };
  },

  async revokeFirewallAccess() {
    if (this.isNativeDesktop() && typeof window.rigcheckAPI.revokeFirewallAccess === 'function') {
      return await window.rigcheckAPI.revokeFirewallAccess();
    }
    try {
      const res = await fetch('/api/firewall-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revoke: true })
      });
      if (res.ok) return await res.json();
    } catch (_e) {
      // Fallback
    }
    window._webFirewallGranted = false;
    window._webFirewallGrantedAt = null;
    return {
      granted: false,
      grantedAt: null,
      mode: 'revoked'
    };
  },

  async searchComponentDeals(payload = {}) {
    if (this.isNativeDesktop() && typeof window.rigcheckAPI.searchComponentDeals === 'function') {
      return await window.rigcheckAPI.searchComponentDeals(payload);
    }
    const res = await fetch('/api/deals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return await res.json();
  },

  async openExternalUrl(url) {
    if (!url || !String(url).startsWith('https://')) {
      throw new Error('Only verified https:// store URLs are permitted.');
    }
    if (this.isNativeDesktop() && typeof window.rigcheckAPI.openExternalUrl === 'function') {
      return await window.rigcheckAPI.openExternalUrl({ url });
    }
    window.open(url, '_blank', 'noopener,noreferrer');
    return { ok: true, url };
  }
};

function showToast(message, type = 'info', durationMs = 4200) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, durationMs);
}

function tierBadge(tier) {
  switch (tier) {
    case 'EXCEEDS_RECOMMENDED':
      return { text: 'Ultra / High Ready', cls: 'badge-ultra' };
    case 'MEETS_RECOMMENDED':
      return { text: 'Recommended Ready', cls: 'badge-rec' };
    case 'MEETS_MINIMUM':
      return { text: 'Minimum Ready', cls: 'badge-min' };
    default:
      return { text: 'Below Minimum', cls: 'badge-fail' };
  }
}

/**
 * Renders distinct launcher badges for Windows & Linux launchers:
 * Steam, Epic Games, Heroic (Epic), Heroic (GOG), Lutris, GOG, Xbox, and Standalone.
 */
function getLauncherBadgeHtml(launcher) {
  if (!launcher) return '';
  const norm = String(launcher).trim().toLowerCase();
  let cls = 'launcher-standalone';
  let icon = '📁';
  let label = launcher;

  if (norm === 'steam') {
    cls = 'launcher-steam';
    icon = '🎮';
    label = 'Steam';
  } else if (norm === 'epic games' || norm === 'epic') {
    cls = 'launcher-epic';
    icon = '⚡';
    label = 'Epic Games';
  } else if (norm.includes('heroic') && norm.includes('epic')) {
    cls = 'launcher-heroic-epic';
    icon = '🛡️';
    label = 'Heroic (Epic)';
  } else if (norm.includes('heroic') && norm.includes('gog')) {
    cls = 'launcher-heroic-gog';
    icon = '🟣';
    label = 'Heroic (GOG)';
  } else if (norm.includes('heroic')) {
    cls = 'launcher-heroic-epic';
    icon = '🛡️';
    label = launcher;
  } else if (norm.includes('lutris')) {
    cls = 'launcher-lutris';
    icon = '🦦';
    label = 'Lutris';
  } else if (norm.includes('gog')) {
    cls = 'launcher-gog';
    icon = '🟣';
    label = launcher;
  } else if (norm.includes('xbox')) {
    cls = 'launcher-xbox';
    icon = '🟢';
    label = launcher;
  } else if (norm.includes('standalone')) {
    cls = 'launcher-standalone';
    icon = '📁';
    label = 'Standalone';
  }

  return `<span class="launcher-badge ${cls}" title="Detected via ${escapeHtml(label)}">${icon} ${escapeHtml(label)}</span>`;
}

/**
 * Renders Proton / Linux Runtime badge if the game has `runtime === 'Proton'`, `protonVersion`, or `linuxCompatNote`.
 */
function getRuntimeBadgeHtml(game) {
  if (!game) return '';
  const hasProton =
    game.runtime === 'Proton' ||
    Boolean(game.protonVersion) ||
    (game.linuxCompatNote && /proton/i.test(game.linuxCompatNote));

  if (hasProton) {
    const label = game.protonVersion || 'Proton';
    const note = game.linuxCompatNote || `Steam Play (${label})`;
    return `<span class="runtime-badge runtime-proton" title="${escapeHtml(note)}">🐧 ${escapeHtml(label)}</span>`;
  }

  if (game.runtime && /wine/i.test(game.runtime)) {
    const note = game.linuxCompatNote || `Wine Runtime (${game.runtime})`;
    return `<span class="runtime-badge runtime-wine" title="${escapeHtml(note)}">🍷 ${escapeHtml(game.runtime)}</span>`;
  }

  if (
    game.runtime === 'Native' ||
    game.runtime === 'Native Linux' ||
    (game.runtime && /linux/i.test(game.runtime)) ||
    Boolean(game.linuxCompatNote)
  ) {
    const label =
      game.runtime === 'Native'
        ? 'Native Linux'
        : game.runtime || 'Native Linux';
    const note = game.linuxCompatNote || 'Native Linux Runtime';
    return `<span class="runtime-badge runtime-native-linux" title="${escapeHtml(note)}">🐧 ${escapeHtml(label)}</span>`;
  }

  return '';
}

function computeMonogram(title = 'Game') {
  const cleaned = String(title)
    .replace(/[:\-–—()]/g, ' ')
    .replace(/\b(the|of|and|edition|remastered|director'?s|cut|next-gen|update|enhanced)\b/gi, ' ')
    .trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'GM';
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words
    .slice(0, 3)
    .map((w) => (/^\d+$/.test(w) ? w : w[0].toUpperCase()))
    .join('')
    .slice(0, 3);
}

function getClientFallbackBannerSvg(game = {}) {
  if (game && game.fallbackBannerSvg) return game.fallbackBannerSvg;
  const title = String(game?.title || game?.name || 'PC Game');
  const genre = String(game?.genre || 'PC Gaming');
  const monogram = game?.monogram || computeMonogram(title);
  const shortTitle = title.length > 28 ? `${title.slice(0, 26)}…` : title;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 460 215" width="460" height="215">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#0b1324"/>
        <stop offset="65%" stop-color="#1e1b4b"/>
        <stop offset="100%" stop-color="#090d16"/>
      </linearGradient>
    </defs>
    <rect width="460" height="215" fill="url(#bg)"/>
    <rect x="24" y="42" width="84" height="84" rx="18" fill="#0f172a" stroke="#38bdf8" stroke-width="2.5"/>
    <text x="66" y="95" text-anchor="middle" fill="#f8fafc" font-family="Segoe UI, Arial, sans-serif" font-size="30" font-weight="800">${escapeHtml(monogram)}</text>
    <text x="126" y="84" fill="#f8fafc" font-family="Segoe UI, Arial, sans-serif" font-size="22" font-weight="800">${escapeHtml(shortTitle)}</text>
    <text x="126" y="112" fill="#38bdf8" font-family="Segoe UI, Arial, sans-serif" font-size="13" font-weight="600">${escapeHtml(genre)}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function getPlayActivityBadgeHtml(game, isHero = false) {
  if (!game) return '';
  if (game.isRunning || game.playStatus === 'PLAYING_NOW') {
    const label = isHero ? '🟢 Currently Playing Now' : '🟢 Playing Now';
    return `<span class="play-activity-badge activity-playing" title="Active process detected via read-only snapshot">${label}</span>`;
  }
  if (game.wasRecentlyPlayed || game.playStatus === 'RECENTLY_PLAYED') {
    const driveSuffix = game.drive ? ` (${escapeHtml(game.drive)})` : '';
    const label = isHero ? `🕒 Recently Played on This PC${driveSuffix}` : '🕒 Recently Played';
    return `<span class="play-activity-badge activity-recent" title="Recently played / updated on this PC">${label}</span>`;
  }
  if (game.installed || game.playStatus === 'INSTALLED') {
    const driveLabel = game.drive ? ` on ${escapeHtml(game.drive)}` : '';
    const sizeInfo = isHero && (game.sizeOnDiskGB || game.storageGB) ? ` (${game.sizeOnDiskGB || game.storageGB} GB)` : '';
    return `<span class="play-activity-badge activity-installed" title="Installed locally${driveLabel}">💾 Installed${driveLabel}${sizeInfo}</span>`;
  }
  if (isHero) {
    return `<span class="play-activity-badge activity-catalog" title="Catalog Benchmark &amp; Configuration Profile">📚 Catalog</span>`;
  }
  return '';
}

/**
 * Merges installed game metadata (launcher, drive, installDir, runtime, protonVersion, linuxCompatNote, playStatus, banners)
 * into a catalog game object when available.
 */
function enrichWithInstalledMetadata(game) {
  if (!game) return game;
  const match = installedGames.find(
    (inst) =>
      inst.id === game.id ||
      (inst.matchedCatalogId && inst.matchedCatalogId === game.id) ||
      (game.matchedCatalogId && inst.id === game.matchedCatalogId)
  );
  const fallbackBanner = game.fallbackBannerSvg || match?.fallbackBannerSvg || getClientFallbackBannerSvg(game);
  const bannerUrl = game.bannerUrl || match?.bannerUrl || fallbackBanner;
  const logoUrl = game.logoUrl || match?.logoUrl || fallbackBanner;
  const monogram = game.monogram || match?.monogram || computeMonogram(game.title || game.name);

  if (!match) {
    return {
      ...game,
      fallbackBannerSvg: fallbackBanner,
      bannerUrl,
      logoUrl,
      monogram
    };
  }
  return {
    ...game,
    fallbackBannerSvg: fallbackBanner,
    bannerUrl,
    logoUrl,
    monogram,
    installed: true,
    launcher: game.launcher || match.launcher || 'Standalone',
    drive: game.drive || match.drive || null,
    sizeOnDiskGB: game.sizeOnDiskGB || match.sizeOnDiskGB || game.storageGB,
    installDir: game.installDir || match.installDir || null,
    runtime: game.runtime || match.runtime || null,
    protonVersion: game.protonVersion || match.protonVersion || null,
    linuxCompatNote: game.linuxCompatNote || match.linuxCompatNote || null,
    isRunning: Boolean(game.isRunning || match.isRunning),
    wasRecentlyPlayed: Boolean(game.wasRecentlyPlayed || match.wasRecentlyPlayed),
    playStatus: game.playStatus && game.playStatus !== 'CATALOG' ? game.playStatus : match.playStatus || 'INSTALLED',
    playStatusLabel:
      game.playStatusLabel && game.playStatusLabel !== '📚 Catalog'
        ? game.playStatusLabel
        : match.playStatusLabel || '💾 Installed',
    lastPlayedTimestamp: game.lastPlayedTimestamp || match.lastPlayedTimestamp || 0
  };
}

async function handleOpenGameFolder(installDir, gameTitle = 'Game') {
  if (!installDir) {
    showToast('No directory path specified.', 'warn');
    return;
  }
  try {
    const res = await api.openPath(installDir);
    if (res && res.ok) {
      showToast(`📂 Opened folder for ${gameTitle}: ${installDir}`, 'success');
    } else if (res && res.webFallback) {
      showToast(`📂 Path: ${installDir} (Launch Native Desktop mode to open OS file manager)`, 'info');
    } else {
      showToast(`⚠️ Could not open path (${installDir}): ${res?.error || 'Unknown error'}`, 'warn');
    }
  } catch (err) {
    showToast(`⚠️ Error opening folder: ${err.message}`, 'error');
  }
}

function updateCalVerHeaderBadge(versionObj) {
  const badgeEl = document.getElementById('calver-header-badge');
  if (!badgeEl) return;
  const fullVer =
    versionObj?.fullVersion ||
    versionObj?.calver ||
    versionObj?.version ||
    currentAppInfo?.fullVersion ||
    currentAppInfo?.calver ||
    currentAppInfo?.version ||
    '2026.11.17';
  badgeEl.textContent = `CalVer v${fullVer}`;
}

function updateRuntimeStatusPill(specs) {
  const pill = document.getElementById('runtime-status-pill');
  const modeEl = document.getElementById('runtime-mode-text');
  const osEl = document.getElementById('runtime-os-text');
  const driverEl = document.getElementById('runtime-driver-text');
  if (!pill || !modeEl || !osEl || !driverEl) return;

  const native = api.isNativeDesktop();
  pill.classList.toggle('is-native', native);
  pill.classList.toggle('is-web', !native);

  const electronVer = currentAppInfo?.electronVersion ? ` v${currentAppInfo.electronVersion}` : '';
  modeEl.textContent = native
    ? `⚡ Native Desktop (Electron IPC${electronVer})`
    : '🌐 Web Mode (HTTP Fallback)';

  const rawOs = specs?.os || currentAppInfo?.platform || 'Unknown OS';
  const isLinux = /linux/i.test(rawOs) || currentAppInfo?.platform === 'linux';
  const osFamily = isLinux ? '🐧 Linux' : '🪟 Windows';
  osEl.textContent = `${osFamily} (${rawOs})`;

  const driverVersion = specs?.gpu?.driverVersion || 'N/A';
  driverEl.textContent = `🎮 Driver: ${driverVersion}`;
}

function renderSpecsBanner(specs) {
  if (!specs) return;
  currentSpecs = specs;

  const isLinux = /linux/i.test(specs.os || '') || currentAppInfo?.platform === 'linux';
  document.getElementById('os-label').textContent = `${isLinux ? '🐧' : '🪟'} ${specs.os} • Driver: ${specs.gpu.driverVersion || 'N/A'}`;
  updateRuntimeStatusPill(specs);

  document.getElementById('hw-cpu-name').textContent = specs.cpu.name;
  document.getElementById('hw-cpu-meta').textContent = `${specs.cpu.cores} Cores / ${specs.cpu.threads} Threads • Tier Score: ${specs.cpu.score}/100`;
  document.getElementById('hw-cpu-bar').style.width = `${Math.min(100, specs.cpu.score)}%`;

  document.getElementById('hw-gpu-name').textContent = specs.gpu.name;
  document.getElementById('hw-gpu-meta').textContent = `${specs.gpu.vramGB} GB VRAM • ${specs.gpu.upscaler} • Driver ${specs.gpu.driverVersion || 'N/A'} • Score: ${specs.gpu.score}/100`;
  document.getElementById('hw-gpu-bar').style.width = `${Math.min(100, specs.gpu.score)}%`;

  // Primary Display / Monitor Telemetry Card
  const disp = specs.display || {
    name: 'Primary Gaming Display',
    width: 1920,
    height: 1080,
    resolutionLabel: '1080p (FHD)',
    tier: '1080p',
    refreshRateHz: 60,
    aspectRatio: '16:9',
    bitsPerPixel: 32,
    vrrCapable: false,
    probeEngine: 'Native Driver Probe'
  };
  const dispNameEl = document.getElementById('spec-display-name');
  const dispResEl = document.getElementById('spec-display-res');
  const dispHzEl = document.getElementById('spec-display-hz');
  const dispMetaEl = document.getElementById('spec-display-meta');
  const dispProbeBadge = document.getElementById('spec-display-probe-badge');
  const dispBar = document.getElementById('hw-display-bar');

  if (dispNameEl) dispNameEl.textContent = disp.name || 'Primary Display';
  if (dispResEl) {
    const tierTag = disp.tier || disp.resolutionLabel || '1080p';
    dispResEl.textContent = `${disp.width || 1920}x${disp.height || 1080} (${tierTag})`;
  }
  if (dispHzEl) {
    dispHzEl.textContent = `${disp.refreshRateHz || 60} Hz`;
  }
  if (dispProbeBadge) {
    dispProbeBadge.textContent = `⚡ ${disp.probeEngine || 'Native Driver Probe'}`;
  }
  if (dispMetaEl) {
    const vrrNote = disp.vrrCapable || (disp.refreshRateHz || 60) >= 75
      ? 'VRR / Adaptive-Sync Ready'
      : 'Standard V-Sync Display';
    const multiCount = Array.isArray(specs.displays) && specs.displays.length > 1
      ? ` • ${specs.displays.length} Screens`
      : '';
    dispMetaEl.textContent = `${disp.aspectRatio || '16:9'} • ${disp.bitsPerPixel || 32}-bit • ${vrrNote}${multiCount}`;
  }
  if (dispBar) {
    const hzPct = Math.min(100, Math.max(25, Math.round(((disp.refreshRateHz || 60) / 165) * 100)));
    dispBar.style.width = `${hzPct}%`;
  }

  document.getElementById('hw-ram-name').textContent = `${specs.ram.totalGB} GB System RAM`;
  document.getElementById('hw-ram-meta').textContent = `${specs.ram.freeGB} GB Currently Available`;
  document.getElementById('hw-ram-bar').style.width = `${Math.min(100, Math.round((specs.ram.totalGB / 32) * 100))}%`;

  const primaryDrive = specs.storage.drive || (isLinux ? '/' : 'C:');
  const isMountPath = String(primaryDrive).startsWith('/');
  document.getElementById('hw-disk-name').textContent = `${specs.storage.freeGB} GB Free (${primaryDrive} ${isMountPath ? 'Best Mount' : 'Best Drive'})`;

  const allDrives = Array.isArray(specs.storage.allDrives) ? specs.storage.allDrives : [];
  const diskMetaEl = document.getElementById('hw-disk-meta');
  if (allDrives.length > 0) {
    diskMetaEl.innerHTML = `<div class="drive-chips">${allDrives
      .map((d) => {
        const mountName = d.drive || '/';
        const totalInfo = d.totalGB ? `/${d.totalGB}GB` : '';
        const labelTooltip = d.label ? `${d.label} (${mountName})` : mountName;
        return `<span class="drive-chip" title="${escapeHtml(labelTooltip)}: ${d.freeGB} GB free of ${d.totalGB || '?'} GB"><span class="drive-chip-mount">${escapeHtml(mountName)}</span><span class="drive-chip-free">${d.freeGB}GB${totalInfo}</span></span>`;
      })
      .join('')}</div>`;
  } else {
    diskMetaEl.textContent = `Out of ${specs.storage.totalGB} GB Total`;
  }

  const diskPct = Math.min(100, Math.round((specs.storage.freeGB / Math.max(1, specs.storage.totalGB)) * 100));
  document.getElementById('hw-disk-bar').style.width = `${diskPct}%`;
}

function populateGenreDropdown() {
  const select = document.getElementById('game-genre-filter');
  const currentVal = select.value;
  const genreSet = new Set();

  [...allCatalogGames, ...installedGames].forEach((g) => {
    if (g.genre) genreSet.add(g.genre);
  });

  const sortedGenres = Array.from(genreSet).sort();
  select.innerHTML =
    `<option value="">All Genres (${sortedGenres.length})</option>` +
    sortedGenres.map((genre) => `<option value="${escapeHtml(genre)}">${escapeHtml(genre)}</option>`).join('');

  if (sortedGenres.includes(currentVal)) {
    select.value = currentVal;
  }
}

function renderGameList() {
  const container = document.getElementById('game-list');
  const q = (document.getElementById('game-search').value || '').trim().toLowerCase();
  const genreFilter = (document.getElementById('game-genre-filter').value || '').trim().toLowerCase();
  const tierFilter = (document.getElementById('game-tier-filter').value || '').trim().toUpperCase();

  const sourceList = activeSourceTab === 'installed' ? installedGames : allCatalogGames;

  const filtered = sourceList.filter((g) => {
    if (q) {
      const hay = `${g.title} ${g.genre} ${g.engine || ''} ${g.launcher || ''} ${g.runtime || ''} ${g.protonVersion || ''} ${g.linuxCompatNote || ''} ${g.drive || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (genreFilter && (g.genre || '').toLowerCase() !== genreFilter) {
      return false;
    }
    if (tierFilter) {
      const t = g.analysis?.overallTier || '';
      if (tierFilter === 'RECOMMENDED') {
        if (!g.analysis?.canRunRecommended) return false;
      } else if (tierFilter === 'PLAYABLE') {
        if (!g.analysis?.canRunMinimum) return false;
      } else if (t !== tierFilter) {
        return false;
      }
    }
    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = `<div class="empty-state">No games match the current filter.</div>`;
    return;
  }

  const activityRank = (g) => {
    if (g.isRunning || g.playStatus === 'PLAYING_NOW') return 3;
    if (g.wasRecentlyPlayed || g.playStatus === 'RECENTLY_PLAYED') return 2;
    if (g.installed || g.playStatus === 'INSTALLED') return 1;
    return 0;
  };

  const sortedFiltered = [...filtered].sort((a, b) => {
    const ga = enrichWithInstalledMetadata(a);
    const gb = enrichWithInstalledMetadata(b);
    const diff = activityRank(gb) - activityRank(ga);
    if (diff !== 0) return diff;
    return (gb.lastPlayedTimestamp || 0) - (ga.lastPlayedTimestamp || 0);
  });

  const screenTier = currentSpecs?.display?.tier || '1080p';

  container.innerHTML = sortedFiltered
    .map((rawGame) => {
      const g = enrichWithInstalledMetadata(rawGame);
      const b = tierBadge(g.analysis?.overallTier);
      const isActive = g.id === selectedGameId ? 'active' : '';
      const isPlayingClass = g.isRunning || g.playStatus === 'PLAYING_NOW' ? 'is-playing-now' : '';

      const fallbackSvg = g.fallbackBannerSvg || getClientFallbackBannerSvg(g);
      const bannerSrc = g.bannerUrl || fallbackSvg;
      const monogram = g.monogram || computeMonogram(g.title);

      const playActivityBadge = getPlayActivityBadgeHtml(g, false);
      const launcherBadge = g.installed && g.launcher ? getLauncherBadgeHtml(g.launcher) : '';
      const runtimeBadge = getRuntimeBadgeHtml(g);

      const openFolderBtn =
        g.installed && g.installDir
          ? `<button type="button" class="btn-open-folder-card" data-open-path="${escapeHtml(g.installDir)}" data-game-title="${escapeHtml(g.title)}" title="Open ${escapeHtml(g.installDir)}">📂 Folder</button>`
          : '';

      const estFpsObj =
        g.analysis?.optimalConfig?.displayTarget?.estimatedScreenFps ||
        g.analysis?.optimalConfig?.estimatedFps?.[screenTier] ||
        g.analysis?.optimalConfig?.estimatedFps?.['1080p'];
      const predictedFps =
        (typeof estFpsObj === 'object' ? estFpsObj?.avg : Number(estFpsObj)) || g.baseRecFps || 60;

      const yearStr = g.releaseYear ? ` • ${escapeHtml(g.releaseYear)}` : '';
      const engineStr = g.engine ? ` • ${escapeHtml(g.engine)}` : '';
      const storageStr = `${g.sizeOnDiskGB || g.storageGB || 60} GB`;
      const subMeta = `${escapeHtml(g.genre || 'PC Game')}${yearStr}${engineStr} • ${storageStr}`;

      const badgesRow =
        playActivityBadge || launcherBadge || runtimeBadge
          ? `<div class="game-item-badges">${playActivityBadge}${launcherBadge}${runtimeBadge}</div>`
          : '';

      return `
        <div class="game-item game-list-row ${isActive} ${isPlayingClass}" data-id="${escapeHtml(g.id)}">
          <div class="game-row-banner-wrap">
            <img
              class="game-row-banner-img"
              src="${escapeHtml(bannerSrc)}"
              data-fallback="${escapeHtml(fallbackSvg)}"
              alt="${escapeHtml(g.title)}"
              loading="lazy"
            />
            <span class="game-row-monogram" title="${escapeHtml(g.title)}">${escapeHtml(monogram)}</span>
          </div>
          <div class="game-item-main">
            <div class="game-item-title">
              <span>${escapeHtml(g.title)}</span>
            </div>
            <div class="game-item-meta">${subMeta}</div>
            ${badgesRow}
          </div>
          <div class="game-item-right">
            <span class="badge ${b.cls}">${b.text}</span>
            <div class="game-row-fps" title="Predicted Screen FPS on your hardware">⚡ ~${escapeHtml(predictedFps)} FPS @ ${escapeHtml(screenTier)}</div>
            <div class="game-row-actions">
              <button type="button" class="btn-configure-row" data-configure-id="${escapeHtml(g.id)}">⚙️ Configure</button>
              ${openFolderBtn}
            </div>
          </div>
        </div>
      `;
    })
    .join('');

  container.querySelectorAll('.game-row-banner-img').forEach((img) => {
    img.addEventListener('error', () => {
      const fb = img.getAttribute('data-fallback');
      if (fb && img.src !== fb) {
        img.src = fb;
      }
    });
  });

  container.querySelectorAll('.btn-open-folder-card').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const targetPath = btn.getAttribute('data-open-path');
      const title = btn.getAttribute('data-game-title') || 'Game';
      handleOpenGameFolder(targetPath, title);
    });
  });

  container.querySelectorAll('.game-item').forEach((el) => {
    el.addEventListener('click', () => {
      selectedGameId = el.getAttribute('data-id');
      lastCustomGamePayload = null;
      renderGameList();
      loadGameAnalysis(selectedGameId);
    });
  });
}

function showExportSaveBanner(filePath, bytesWritten, isBrowserDownload = false) {
  const banner = document.getElementById('export-save-banner');
  if (!banner) return;

  banner.classList.remove('hidden');
  const modeLabel = isBrowserDownload ? 'Downloaded via Browser' : 'Saved to Disk (Native OS Dialog)';
  const sizeKb = bytesWritten ? ` (${(bytesWritten / 1024).toFixed(1)} KB)` : '';

  banner.innerHTML = `
    <div>
      <strong>✅ ${escapeHtml(modeLabel)}:</strong>
      <span class="export-save-path">Saved to ${escapeHtml(filePath)}</span>${escapeHtml(sizeKb)}
    </div>
    ${
      !isBrowserDownload && api.isNativeDesktop()
        ? `<button type="button" id="btn-open-saved-config" class="btn btn-xs btn-secondary" data-path="${escapeHtml(filePath)}">📂 Show File</button>`
        : ''
    }
  `;

  const openSavedBtn = document.getElementById('btn-open-saved-config');
  if (openSavedBtn) {
    openSavedBtn.addEventListener('click', () => {
      handleOpenGameFolder(filePath, 'Exported Config');
    });
  }
}

async function handleExportConfig(format, defaultFilename, content, mimeType) {
  try {
    const res = await api.saveConfigFile({
      defaultFilename,
      content,
      format,
      mimeType
    });

    if (res && res.canceled) {
      showToast('Config export canceled.', 'info');
      return;
    }

    const savedPath = (res && res.filePath) || defaultFilename;
    showExportSaveBanner(savedPath, res?.bytesWritten, Boolean(res?.browserDownload));
    showToast(`✓ Saved to ${savedPath}`, 'success');
  } catch (err) {
    showToast(`Failed to save config file: ${err.message}`, 'error');
  }
}

function buildDisplayTargetSummary(opt, specs) {
  if (opt && opt.displayTarget) {
    return opt.displayTarget;
  }
  const disp = specs?.display || {
    name: 'Primary Gaming Display',
    width: 1920,
    height: 1080,
    resolutionLabel: '1080p',
    tier: '1080p',
    refreshRateHz: 60
  };
  const tierKey = disp.tier && opt?.estimatedFps?.[disp.tier] ? disp.tier : '1080p';
  const est = opt?.estimatedFps?.[tierKey] || opt?.estimatedFps?.['1080p'] || { avg: 60, range: '55-65 FPS' };
  const hz = disp.refreshRateHz || 60;
  const satPct = Math.min(100, Math.round(((est.avg || 60) / Math.max(1, hz)) * 100));
  return {
    monitorName: disp.name || 'Primary Gaming Display',
    width: disp.width || 1920,
    height: disp.height || 1080,
    resolutionLabel: disp.resolutionLabel || `${disp.width || 1920}x${disp.height || 1080}`,
    refreshRateHz: hz,
    targetFpsWindow: activeOptimizationMode === 'quality_30_60' ? '30–60 FPS' : `60–${hz} FPS`,
    estimatedScreenFps: est,
    refreshSaturationPct: satPct,
    syncAdvice:
      satPct >= 95
        ? `Cap FPS at ${Math.max(30, hz - 3)} FPS with VRR/FreeSync/G-Sync for tear-free ultra-low latency.`
        : `Enable VRR (FreeSync / G-Sync) to smooth frame pacing across ${est.range} on your ${hz}Hz screen.`
  };
}

function renderAnalysisDetail(rawGame, analysis, perSettingImpact = [], exportedConfigs = null) {
  const panel = document.getElementById('analysis-panel');
  const game = enrichWithInstalledMetadata(rawGame);
  const b = tierBadge(analysis.overallTier);
  const baseOpt = analysis.optimalConfig;
  const activeModeKey = baseOpt.activeMode || activeOptimizationMode || 'optimal';
  const modeProfile = (baseOpt.modeProfiles && baseOpt.modeProfiles[activeModeKey]) || baseOpt;
  const opt = {
    ...baseOpt,
    ...modeProfile,
    estimatedFps: baseOpt.estimatedFps
  };

  const displayTarget = buildDisplayTargetSummary(baseOpt, currentSpecs);
  const screenFpsObj =
    modeProfile.estimatedScreenFps ||
    displayTarget.estimatedScreenFps ||
    opt.estimatedFps['1080p'];
  const screenFpsRange =
    typeof screenFpsObj === 'object'
      ? screenFpsObj.range || `${screenFpsObj.avg || 60} FPS`
      : `${screenFpsObj} FPS`;
  const screenFpsAvg =
    typeof screenFpsObj === 'object'
      ? screenFpsObj.avg || 60
      : Number(screenFpsObj) || 60;
  const saturationPct =
    displayTarget.refreshSaturationPct ??
    Math.min(100, Math.round((screenFpsAvg / Math.max(1, displayTarget.refreshRateHz || 60)) * 100));

  const c = analysis.components;
  const impactRows =
    Array.isArray(perSettingImpact) && perSettingImpact.length > 0
      ? perSettingImpact
      : analysis.perSettingImpact || [];

  lastExportedConfigs = exportedConfigs || analysis.exportedConfigs || null;

  const compRows = [
    { label: 'Processor (CPU)', data: c.cpu, min: c.cpu.minRequired, rec: c.cpu.recRequired },
    { label: 'Graphics Card (GPU)', data: c.gpu, min: c.gpu.minRequired, rec: c.gpu.recRequired },
    { label: 'Video Memory (VRAM)', data: c.vram, min: c.vram.minRequired, rec: c.vram.recRequired },
    { label: 'System Memory (RAM)', data: c.ram, min: c.ram.minRequired, rec: c.ram.recRequired },
    { label: 'Disk Storage', data: c.storage, min: c.storage.required, rec: c.storage.required }
  ];

  const playActivityHeroBadge = getPlayActivityBadgeHtml(game, true);
  const installedDriveBadge = game.installed
    ? `<span class="installed-pill" style="font-size:0.74rem;padding:3px 9px;">💿 ${escapeHtml(game.drive || 'PC')} (${game.sizeOnDiskGB || game.storageGB} GB)</span>`
    : '';
  const launcherBadge = game.installed && game.launcher ? getLauncherBadgeHtml(game.launcher) : '';
  const runtimeBadge = getRuntimeBadgeHtml(game);

  const fallbackBannerSvg = game.fallbackBannerSvg || getClientFallbackBannerSvg(game);
  const heroBannerUrl = game.bannerUrl || fallbackBannerSvg;
  const heroLogoUrl = game.logoUrl || fallbackBannerSvg;
  const heroMonogram = game.monogram || computeMonogram(game.title);
  const upscalerList = Array.isArray(game.supportsUpscaling) && game.supportsUpscaling.length > 0
    ? game.supportsUpscaling.join(' / ')
    : 'Native';

  const openFolderHeroBtn =
    game.installed && game.installDir
      ? `<button id="btn-open-game-folder" class="btn-export btn-open-folder-hero" type="button" title="Open ${escapeHtml(game.installDir)}">📂 Open Game Folder</button>`
      : '';

  const installedDetailStrip =
    game.installed && (game.installDir || game.linuxCompatNote || game.protonVersion)
      ? `
        <div class="installed-detail-strip">
          <div>
            ${
              game.installDir
                ? `<strong>📁 Local Install Path:</strong> <code class="installed-path-code">${escapeHtml(game.installDir)}</code>`
                : ''
            }
            ${
              game.linuxCompatNote
                ? `<div style="margin-top:4px;color:var(--text-muted);">🐧 <strong>Linux / Proton Runtime:</strong> ${escapeHtml(game.linuxCompatNote)}</div>`
                : ''
            }
          </div>
          ${
            game.installDir
              ? `<button id="btn-open-game-folder-strip" type="button" class="btn btn-xs btn-secondary">📂 Open Game Folder</button>`
              : ''
          }
        </div>
      `
      : '';

  const modeTabsHtml = OPTIMIZATION_MODES.map((m) => {
    const isAct = m.id === activeModeKey ? 'active' : '';
    const prof = baseOpt.modeProfiles?.[m.id];
    const desc = prof?.summary || m.shortDesc;
    return `
      <button type="button" class="opt-mode-tab ${isAct}" data-opt-mode="${escapeHtml(m.id)}">
        <span class="opt-mode-tab-name">${escapeHtml(m.label)}</span>
        <span class="opt-mode-tab-desc">${escapeHtml(desc)}</span>
      </button>
    `;
  }).join('');

  panel.innerHTML = `
    <div id="analysis-hero-banner" class="analysis-hero-banner game-hero">
      <div class="hero-banner-media">
        <img
          id="hero-banner-img"
          class="hero-banner-bg-img"
          src="${escapeHtml(heroBannerUrl)}"
          data-fallback="${escapeHtml(fallbackBannerSvg)}"
          alt="${escapeHtml(game.title)} Banner"
        />
        <div class="hero-banner-overlay"></div>
      </div>
      <div class="hero-banner-content">
        <div class="hero-left-group">
          <div class="hero-logo-emblem" title="${escapeHtml(game.title)}">
            <img
              id="hero-logo-img"
              class="hero-logo-img"
              src="${escapeHtml(heroLogoUrl)}"
              data-fallback="${escapeHtml(fallbackBannerSvg)}"
              alt="${escapeHtml(game.title)} Logo"
            />
            <span class="hero-monogram-fallback">${escapeHtml(heroMonogram)}</span>
          </div>
          <div class="hero-title-block">
            <div class="game-hero-badges">
              ${playActivityHeroBadge}
              ${installedDriveBadge}
              ${launcherBadge}
              ${runtimeBadge}
            </div>
            <h2>
              <span>${escapeHtml(game.title)}</span>
            </h2>
            <div class="game-hero-meta">
              ${escapeHtml(game.genre)} • Engine: ${escapeHtml(game.engine || 'Standard')} • Release: ${escapeHtml(game.releaseYear || 2024)} • Upscaling: ${escapeHtml(upscalerList)} • Target: ~${escapeHtml(screenFpsAvg)} FPS @ ${escapeHtml(displayTarget.width)}x${escapeHtml(displayTarget.height)} (${escapeHtml(displayTarget.refreshRateHz)}Hz)
            </div>
          </div>
        </div>
        <div class="hero-right">
          <span class="badge ${b.cls}" style="font-size:0.88rem;padding:6px 14px;">${b.text}</span>
          <div class="export-bar">
            ${openFolderHeroBtn}
            <button id="btn-download-ini" class="btn-export" type="button" title="Save ready-to-use .INI graphics config">💾 Export Optimal .INI</button>
            <button id="btn-download-json" class="btn-export" type="button" title="Save full .JSON hardware & settings profile">📄 Export .JSON Profile</button>
            <button id="btn-download-md" class="btn-export" type="button" title="Save Markdown tuning checklist">📝 Export .MD Guide</button>
          </div>
        </div>
      </div>
    </div>

    <div id="export-save-banner" class="export-save-banner hidden"></div>

    ${installedDetailStrip}

    <!-- Interactive 4-Mode Screen-Aware Optimization Selector -->
    <div class="opt-mode-bar">
      <div class="opt-mode-header">
        <span class="opt-mode-title">🎛️ Screen-Aware Optimization Mode</span>
        <span class="opt-mode-sub">Tailored to your GPU/CPU &amp; ${escapeHtml(displayTarget.monitorName)} (${escapeHtml(displayTarget.width)}x${escapeHtml(displayTarget.height)} @ ${escapeHtml(displayTarget.refreshRateHz)}Hz)</span>
      </div>
      <div class="opt-mode-tabs" role="tablist">
        ${modeTabsHtml}
      </div>
    </div>

    <!-- Screen Target & Refresh Saturation Panel -->
    <div class="screen-target-panel" id="screen-target-panel">
      <div class="screen-target-top">
        <div class="screen-target-title">
          <span>🖥️ Active Screen Target: <strong>${escapeHtml(displayTarget.monitorName)}</strong></span>
          <span class="probe-badge">${escapeHtml(displayTarget.width)}x${escapeHtml(displayTarget.height)} @ ${escapeHtml(displayTarget.refreshRateHz)}Hz</span>
        </div>
        <div class="screen-target-metrics">
          <span class="screen-metric-chip">Target Window: ${escapeHtml(displayTarget.targetFpsWindow || '60+ FPS')}</span>
          <span class="screen-metric-chip highlight">Screen Est: ${escapeHtml(screenFpsRange)} (~${escapeHtml(screenFpsAvg)} FPS)</span>
        </div>
      </div>
      <div class="screen-saturation-row">
        <div class="screen-saturation-labels">
          <span>Monitor Refresh Rate Saturation (${escapeHtml(screenFpsAvg)} FPS vs ${escapeHtml(displayTarget.refreshRateHz)}Hz)</span>
          <strong>${escapeHtml(saturationPct)}% of ${escapeHtml(displayTarget.refreshRateHz)}Hz</strong>
        </div>
        <div class="screen-saturation-track">
          <div class="screen-saturation-fill" style="width:${Math.min(100, saturationPct)}%"></div>
        </div>
      </div>
      <div class="screen-sync-advice">
        <span><strong>🔄 Sync &amp; Frame Cap:</strong> ${escapeHtml(modeProfile.fpsCapAdvice || displayTarget.syncAdvice)}</span>
        ${modeProfile.qualityScore ? `<span><strong>Visual Fidelity Score:</strong> ${escapeHtml(modeProfile.qualityScore)}/100</span>` : ''}
      </div>
    </div>

    <div class="bottleneck-banner">
      <div class="bottleneck-banner-row">
        <div>
          <strong>💡 Hardware Balance Insight:</strong> ${escapeHtml(analysis.bottleneck.note)}
        </div>
        <button
          type="button"
          id="btn-find-bottleneck-deal"
          class="btn btn-xs btn-secondary btn-deals-action"
          data-upgrade-query="${escapeHtml(
            analysis.bottleneck.limitingComponent === 'CPU'
              ? (game.recommended?.cpu || 'AMD Ryzen 7 5700X3D')
              : (game.recommended?.gpu || 'AMD Radeon RX 7600')
          )}"
          title="Search verified component deals &amp; official stores in your country"
        >
          💰 Find Best Deal for ${escapeHtml(
            analysis.bottleneck.limitingComponent === 'CPU'
              ? (game.recommended?.cpu || 'CPU Upgrade')
              : (game.recommended?.gpu || 'GPU Upgrade')
          )}
        </button>
      </div>
    </div>

    <div class="panel-subtitle">🚀 Estimated Performance Across Resolutions (${escapeHtml(modeProfile.label || 'Optimal Mode')})</div>
    <div class="fps-grid">
      <div class="fps-card">
        <div class="fps-res">1080p (FHD)</div>
        <div class="fps-val">${escapeHtml(opt.estimatedFps['1080p'].range)}</div>
        <div class="fps-sub">~${escapeHtml(opt.estimatedFps['1080p'].avg)} FPS Avg</div>
      </div>
      <div class="fps-card">
        <div class="fps-res">1440p (QHD)</div>
        <div class="fps-val">${escapeHtml(opt.estimatedFps['1440p'].range)}</div>
        <div class="fps-sub">~${escapeHtml(opt.estimatedFps['1440p'].avg)} FPS Avg</div>
      </div>
      <div class="fps-card">
        <div class="fps-res">4K (UHD)</div>
        <div class="fps-val">${escapeHtml(opt.estimatedFps['4K'].range)}</div>
        <div class="fps-sub">~${escapeHtml(opt.estimatedFps['4K'].avg)} FPS Avg</div>
      </div>
    </div>

    <div class="panel-subtitle">⚙️ Recommended Graphics Configuration (${escapeHtml(modeProfile.label || 'Optimal Mode')})</div>
    <div class="settings-grid">
      <div class="setting-box">
        <div class="setting-name">Target Resolution</div>
        <div class="setting-val">${escapeHtml(opt.targetResolution)}</div>
      </div>
      <div class="setting-box">
        <div class="setting-name">Graphics Preset</div>
        <div class="setting-val">${escapeHtml(opt.preset)}</div>
      </div>
      <div class="setting-box">
        <div class="setting-name">Upscaling (FSR / DLSS)</div>
        <div class="setting-val">${escapeHtml(opt.upscalingMode)}</div>
      </div>
      <div class="setting-box">
        <div class="setting-name">Frame Generation</div>
        <div class="setting-val">${escapeHtml(opt.frameGen)}</div>
      </div>
      <div class="setting-box">
        <div class="setting-name">Texture Quality</div>
        <div class="setting-val">${escapeHtml(opt.textures)}</div>
      </div>
      <div class="setting-box">
        <div class="setting-name">Shadow Quality</div>
        <div class="setting-val">${escapeHtml(opt.shadows)}</div>
      </div>
      <div class="setting-box">
        <div class="setting-name">Ray Tracing</div>
        <div class="setting-val">${escapeHtml(opt.rayTracing)}</div>
      </div>
    </div>

    ${
      impactRows.length > 0
        ? `
      <div class="panel-subtitle">📊 Per-Setting FPS Gain &amp; VRAM Impact Breakdown</div>
      <table class="impact-table">
        <thead>
          <tr>
            <th>Setting</th>
            <th>Optimal Value</th>
            <th>Est. FPS Gain vs Ultra</th>
            <th>VRAM Impact</th>
            <th>Visual Cost</th>
            <th>Hardware Tuning Note</th>
          </tr>
        </thead>
        <tbody>
          ${impactRows
            .map((item) => {
              const barPct = Math.min(100, Math.round((item.fpsGainPercent / 45) * 100));
              const fpsLabel = item.fpsGainPercent > 0 ? `+${item.fpsGainPercent}% FPS` : '0% (Neutral)';
              return `
                <tr>
                  <td><strong>${escapeHtml(item.setting)}</strong></td>
                  <td><span style="color:var(--accent);font-weight:700;">${escapeHtml(item.recommendedValue)}</span></td>
                  <td class="impact-bar-cell">
                    <div class="impact-bar-header">
                      <span>${escapeHtml(fpsLabel)}</span>
                    </div>
                    <div class="impact-bar-track">
                      <div class="impact-bar-fill" style="width:${barPct}%"></div>
                    </div>
                  </td>
                  <td><span class="vram-chip">~${escapeHtml(item.vramImpactMB)} MB</span></td>
                  <td><span class="visual-cost-chip">${escapeHtml(item.visualCost)}</span></td>
                  <td class="impact-note">${escapeHtml(item.note)}</td>
                </tr>
              `;
            })
            .join('')}
        </tbody>
      </table>
    `
        : ''
    }

    ${
      analysis.driverAdvisor
        ? `
      <div class="panel-subtitle">// DRIVER_APP_PROFILE — ${escapeHtml(analysis.driverAdvisor.suiteName)} [${escapeHtml(analysis.driverAdvisor.suiteStatus || 'DRIVER_ONLY')}]</div>
      <div class="bottleneck-banner" style="margin-bottom:10px;">
        <div><strong>🎮 ${escapeHtml(analysis.driverAdvisor.summary)}</strong> • ${escapeHtml(analysis.driverAdvisor.storageAdvice)}</div>
      </div>
      <div class="settings-grid" style="margin-bottom:16px;">
        ${(analysis.driverAdvisor.settings || [])
          .slice(0, 6)
          .map(
            (ds) => `
          <div class="setting-box" title="${escapeHtml(ds.reason)}">
            <div class="setting-name">${escapeHtml(ds.setting)}</div>
            <div class="setting-val">${escapeHtml(ds.recommendedValue)}</div>
          </div>`
          )
          .join('')}
      </div>
    `
        : ''
    }

    <div class="panel-subtitle">🔍 Component-by-Component Check</div>
    <table class="comp-table">
      <thead>
        <tr>
          <th>Component</th>
          <th>Your PC</th>
          <th>Minimum Spec</th>
          <th>Recommended Spec</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${compRows
          .map((row) => {
            const st = tierBadge(row.data.status);
            const isUpgradeableHw = row.label.includes('CPU') || row.label.includes('GPU');
            const dealBtnHtml = isUpgradeableHw
              ? `<button type="button" class="btn-inline-deal" data-deal-query="${escapeHtml(row.rec)}" title="Search verified prices for ${escapeHtml(row.rec)}">💰 Check Price</button>`
              : '';
            return `
              <tr>
                <td><strong>${escapeHtml(row.label)}</strong></td>
                <td>${escapeHtml(row.data.userValue)}</td>
                <td>${escapeHtml(row.min)}</td>
                <td>
                  <div class="rec-spec-cell">
                    <span>${escapeHtml(row.rec)}</span>
                    ${dealBtnHtml}
                  </div>
                </td>
                <td><span class="badge ${st.cls}">${st.text}</span></td>
              </tr>
            `;
          })
          .join('')}
      </tbody>
    </table>

    <div class="panel-subtitle">🎯 Engine &amp; Game-Specific Optimization Tips</div>
    <ul class="tips-list">
      ${opt.tuningTips.map((tip) => `<li>✨ ${escapeHtml(tip)}</li>`).join('')}
    </ul>
  `;

  // Wire up hero banner & logo image fallbacks for offline / non-Steam titles
  const heroBannerImg = document.getElementById('hero-banner-img');
  if (heroBannerImg) {
    heroBannerImg.addEventListener('error', () => {
      const fb = heroBannerImg.getAttribute('data-fallback');
      if (fb && heroBannerImg.src !== fb) {
        heroBannerImg.src = fb;
      }
    });
  }
  const heroLogoImg = document.getElementById('hero-logo-img');
  if (heroLogoImg) {
    heroLogoImg.addEventListener('error', () => {
      heroLogoImg.classList.add('hidden');
    });
  }

  // Wire up 4-mode selector tabs
  panel.querySelectorAll('.opt-mode-tab').forEach((tabBtn) => {
    tabBtn.addEventListener('click', async () => {
      const chosenMode = tabBtn.getAttribute('data-opt-mode') || 'optimal';
      if (chosenMode === activeOptimizationMode) return;
      activeOptimizationMode = chosenMode;
      await loadGameAnalysis(selectedGameId, lastCustomGamePayload);
      const modeInfo = OPTIMIZATION_MODES.find((m) => m.id === chosenMode);
      showToast(`🎛️ Switched mode to ${modeInfo ? modeInfo.label : chosenMode}`, 'info', 2500);
    });
  });

  const btnOpenHero = document.getElementById('btn-open-game-folder');
  if (btnOpenHero && game.installDir) {
    btnOpenHero.addEventListener('click', () => {
      handleOpenGameFolder(game.installDir, game.title);
    });
  }

  const btnOpenStrip = document.getElementById('btn-open-game-folder-strip');
  if (btnOpenStrip && game.installDir) {
    btnOpenStrip.addEventListener('click', () => {
      handleOpenGameFolder(game.installDir, game.title);
    });
  }

  const btnIni = document.getElementById('btn-download-ini');
  const btnJson = document.getElementById('btn-download-json');
  const btnMd = document.getElementById('btn-download-md');

  if (btnIni && lastExportedConfigs) {
    btnIni.addEventListener('click', () => {
      handleExportConfig(
        'ini',
        `${lastExportedConfigs.filenameBase || 'optimal-settings'}.ini`,
        lastExportedConfigs.iniContent,
        'text/plain;charset=utf-8'
      );
    });
  }
  if (btnJson && lastExportedConfigs) {
    btnJson.addEventListener('click', () => {
      handleExportConfig(
        'json',
        `${lastExportedConfigs.filenameBase || 'optimal-settings'}.json`,
        lastExportedConfigs.jsonContent,
        'application/json;charset=utf-8'
      );
    });
  }
  if (btnMd && lastExportedConfigs) {
    btnMd.addEventListener('click', () => {
      handleExportConfig(
        'md',
        `${lastExportedConfigs.filenameBase || 'optimal-settings'}.md`,
        lastExportedConfigs.markdownGuide,
        'text/markdown;charset=utf-8'
      );
    });
  }

  const btnBottleneckDeal = document.getElementById('btn-find-bottleneck-deal');
  if (btnBottleneckDeal) {
    btnBottleneckDeal.addEventListener('click', () => {
      const q = btnBottleneckDeal.getAttribute('data-upgrade-query') || 'AMD Radeon RX 7600';
      openDealsFinderModal(q);
    });
  }

  panel.querySelectorAll('.btn-inline-deal').forEach((btn) => {
    btn.addEventListener('click', () => {
      const q = btn.getAttribute('data-deal-query') || 'AMD Radeon RX 7600';
      openDealsFinderModal(q);
    });
  });
}

/* ============================================================================
 * CalVer Patch & Native Installer Modal Logic
 * ========================================================================== */

function normalizeInstallerArtifacts(rawArtifacts) {
  if (!rawArtifacts) {
    return [
      {
        platform: '🪟 Windows Setup (.exe)',
        name: 'RigCheck-Optimizer-Setup-2026.11.17.exe',
        filePath: 'dist/RigCheck-Optimizer-Setup-2026.11.17.exe',
        exists: true
      },
      {
        platform: '🐧 Linux Installer (.sh)',
        name: 'rigcheck-installer-2026.11.17.sh',
        filePath: 'dist/rigcheck-installer-2026.11.17.sh',
        exists: true
      }
    ];
  }

  if (Array.isArray(rawArtifacts)) {
    return rawArtifacts.map((item) => ({
      platform:
        item.platform ||
        (/\.exe$/i.test(item.name || item.filePath || '')
          ? '🪟 Windows Setup (.exe)'
          : /\.sh$/i.test(item.name || item.filePath || '')
          ? '🐧 Linux Installer (.sh)'
          : '📦 Package Artifact'),
      name: item.name || item.filename || (item.filePath || item.path || '').split(/[\\/]/).pop() || 'Installer',
      filePath: item.filePath || item.path || '',
      sizeBytes: item.sizeBytes || item.size || null,
      exists: item.exists !== undefined ? Boolean(item.exists) : true
    }));
  }

  if (typeof rawArtifacts === 'object') {
    if (Array.isArray(rawArtifacts.artifacts)) {
      return normalizeInstallerArtifacts(rawArtifacts.artifacts);
    }
    const list = [];
    if (rawArtifacts.windowsExe || rawArtifacts.windowsInstaller) {
      const w = rawArtifacts.windowsExe || rawArtifacts.windowsInstaller;
      list.push({
        platform: '🪟 Windows Setup (.exe)',
        name: (typeof w === 'string' ? w : w.name || w.filePath || '').split(/[\\/]/).pop() || 'RigCheck-Optimizer-Setup-2026.11.17.exe',
        filePath: typeof w === 'string' ? w : w.filePath || w.path || 'dist/RigCheck-Optimizer-Setup-2026.11.17.exe',
        sizeBytes: typeof w === 'object' ? w.sizeBytes || w.size : null,
        exists: typeof w === 'object' && w.exists !== undefined ? Boolean(w.exists) : true
      });
    }
    if (rawArtifacts.linuxInstaller || rawArtifacts.linuxSh) {
      const l = rawArtifacts.linuxInstaller || rawArtifacts.linuxSh;
      list.push({
        platform: '🐧 Linux Installer (.sh)',
        name: (typeof l === 'string' ? l : l.name || l.filePath || '').split(/[\\/]/).pop() || 'rigcheck-installer-2026.11.17.sh',
        filePath: typeof l === 'string' ? l : l.filePath || l.path || 'dist/rigcheck-installer-2026.11.17.sh',
        sizeBytes: typeof l === 'object' ? l.sizeBytes || l.size : null,
        exists: typeof l === 'object' && l.exists !== undefined ? Boolean(w.exists) : true
      });
    }
    if (rawArtifacts.payloadZip) {
      const z = rawArtifacts.payloadZip;
      list.push({
        platform: '📦 App Payload (.zip)',
        name: (typeof z === 'string' ? z : z.name || z.filePath || '').split(/[\\/]/).pop() || 'RigCheck-App-Payload-2026.11.17.zip',
        filePath: typeof z === 'string' ? z : z.filePath || z.path || 'dist/RigCheck-App-Payload-2026.11.17.zip',
        sizeBytes: typeof z === 'object' ? z.sizeBytes || z.size : null,
        exists: typeof z === 'object' && z.exists !== undefined ? Boolean(z.exists) : true
      });
    }
    if (list.length > 0) return list;
  }

  return [];
}

function showPatchOperationBanner(htmlContent) {
  const banner = document.getElementById('patch-operation-banner');
  if (!banner) return;
  banner.classList.remove('hidden');
  banner.innerHTML = htmlContent;
}

async function loadAndRenderPatchStatus() {
  try {
    const status = await api.getPatchStatus();
    currentPatchStatus = status || {};
    const v = status?.versionInfo || DEFAULT_CALVER_VERSION_INFO;

    updateCalVerHeaderBadge(v);

    const fullVerEl = document.getElementById('cv-full-version');
    const patchLevelEl = document.getElementById('cv-patch-level');
    const channelEl = document.getElementById('cv-channel');
    const schemeEl = document.getElementById('cv-scheme');
    const notesEl = document.getElementById('cv-release-notes');

    if (fullVerEl) fullVerEl.textContent = v.fullVersion || v.calver || '2026.11.17';
    if (patchLevelEl) patchLevelEl.textContent = `.${v.patchLevel ?? 0}`;
    if (channelEl) channelEl.textContent = v.channel || 'stable';
    if (schemeEl) schemeEl.textContent = v.scheme || 'YYYY.MM.DD';
    if (notesEl) {
      const releasedStr = v.releasedAt ? ` (${v.releasedAt})` : '';
      notesEl.textContent = `${v.notes || 'CalVer Native Desktop Release'}${releasedStr}`;
    }

    // Render available patches in dist/patches/
    const patchesContainer = document.getElementById('available-patches-list');
    const patches = Array.isArray(status?.availablePatches) ? status.availablePatches : [];
    if (patchesContainer) {
      if (patches.length === 0) {
        patchesContainer.innerHTML = `<div class="empty-state-sm">No .rigpatch.json bundles found in dist/patches/. Use "Build .rigpatch.json" below to create one.</div>`;
      } else {
        patchesContainer.innerHTML = patches
          .map((p) => {
            const pPath = p.patchPath || p.filePath || p.path || '';
            const targetVer = p.targetVersion || p.version || p.fullVersion || '2026.11.17.1';
            const fCount = p.fileCount ?? (Array.isArray(p.files) ? p.files.length : 0);
            const sha = p.bundleSha256 || p.sha256 || '';
            const shaShort = sha ? `${String(sha).slice(0, 12)}…` : 'Verified';
            const isValid = p.valid !== false;
            return `
              <div class="patch-item">
                <div>
                  <div class="patch-item-title">
                    <span>📦 CalVer Target: <strong class="accent">v${escapeHtml(targetVer)}</strong></span>
                    <span class="sha256-pill" title="Bundle SHA-256: ${escapeHtml(sha)}">🔒 SHA-256 ${isValid ? 'Verified' : 'Check'}: ${escapeHtml(shaShort)}</span>
                  </div>
                  <div class="patch-item-meta">
                    ${escapeHtml(p.filename || p.name || pPath)} • ${escapeHtml(fCount)} file(s) • ${escapeHtml(p.notes || 'Delta update bundle')}
                  </div>
                </div>
                <button type="button" class="btn btn-xs btn-primary btn-apply-listed-patch" data-patch-path="${escapeHtml(pPath)}">
                  ⚡ Apply Patch
                </button>
              </div>
            `;
          })
          .join('');

        patchesContainer.querySelectorAll('.btn-apply-listed-patch').forEach((btn) => {
          btn.addEventListener('click', async () => {
            const targetPatchPath = btn.getAttribute('data-patch-path');
            await handleApplyPatch(targetPatchPath);
          });
        });
      }
    }

    // Render patch history / backups
    const historyContainer = document.getElementById('patch-history-list');
    const history = Array.isArray(status?.patchHistory) ? status.patchHistory : [];
    if (historyContainer) {
      if (history.length === 0) {
        historyContainer.innerHTML = `<div class="empty-state-sm">No patches applied yet. Applying a patch automatically creates a pre-patch rollback snapshot.</div>`;
      } else {
        historyContainer.innerHTML = history
          .map((h) => {
            const fromV = h.previousVersion || h.fromVersion || '2026.11.17';
            const toV = h.newVersion || h.targetVersion || h.toVersion || '2026.11.17.1';
            const when = h.appliedAt || h.timestamp || '';
            const backup = h.backupFile || h.backupPath || 'snapshot saved';
            return `
              <div class="patch-item">
                <div>
                  <div class="patch-item-title">
                    <span>✅ Applied <strong>v${escapeHtml(fromV)} → v${escapeHtml(toV)}</strong></span>
                  </div>
                  <div class="patch-item-meta">Backup: ${escapeHtml(backup)} ${when ? `• ${escapeHtml(when)}` : ''}</div>
                </div>
              </div>
            `;
          })
          .join('');
      }
    }

    // Render Native Installer Artifacts
    const installerContainer = document.getElementById('installer-artifacts-list');
    const artifacts = normalizeInstallerArtifacts(status?.installerArtifacts);
    if (installerContainer) {
      if (artifacts.length === 0) {
        installerContainer.innerHTML = `<div class="empty-state-sm">No installer artifacts found in dist/. Run npm run installer:build to generate.</div>`;
      } else {
        installerContainer.innerHTML = artifacts
          .map((art) => {
            const sizeStr = art.sizeBytes ? `${(art.sizeBytes / 1024).toFixed(1)} KB` : 'Ready in dist/';
            const statusBadge = art.exists
              ? `<span class="sha256-pill">✓ Built</span>`
              : `<span class="badge badge-warn">Pending Build</span>`;
            return `
              <div class="installer-card">
                <div class="installer-card-title">
                  <span>${escapeHtml(art.platform)}</span>
                  ${statusBadge}
                </div>
                <div class="installer-card-path">${escapeHtml(art.name)}</div>
                <div class="installer-card-meta">${escapeHtml(art.filePath)} • ${escapeHtml(sizeStr)}</div>
              </div>
            `;
          })
          .join('');
      }
    }
  } catch (err) {
    showToast(`Failed to load CalVer patch status: ${err.message}`, 'error');
  }
}

async function handleApplyPatch(patchPath = null) {
  try {
    const payload = patchPath ? { patchPath } : {};
    const res = await api.applyPatch(payload);
    if (res && res.canceled) {
      showToast('Patch selection canceled.', 'info');
      return;
    }
    if (res && res.error) {
      throw new Error(res.error);
    }
    const newVer = res?.newVersion || res?.targetVersion || '2026.11.17.1';
    const prevVer = res?.previousVersion || '2026.11.17';
    const count = res?.filesUpdated ?? 0;

    showPatchOperationBanner(
      `<strong>✅ SHA-256 Verified Patch Applied:</strong> Upgraded <code>v${escapeHtml(prevVer)}</code> → <code>v${escapeHtml(newVer)}</code> (${escapeHtml(count)} file(s) updated, backup snapshot saved).`
    );
    showToast(`✓ Applied CalVer patch → v${newVer}`, 'success');
    await loadAndRenderPatchStatus();
  } catch (err) {
    showToast(`Patch apply failed: ${err.message}`, 'error');
  }
}

async function handleCreatePatch() {
  const notesInput = document.getElementById('patch-notes-input');
  const notes = (notesInput?.value || '').trim() || 'CalVer hotfix patch bundle';
  const btn = document.getElementById('btn-create-patch');
  if (btn) btn.disabled = true;

  try {
    const res = await api.createPatch({ notes });
    if (res && res.error) {
      throw new Error(res.error);
    }
    const targetVer = res?.targetVersion || '2026.11.17.1';
    const pPath = res?.patchPath || `dist/patches/rigcheck-patch-${targetVer}.rigpatch.json`;
    const sha = res?.bundleSha256 ? `${String(res.bundleSha256).slice(0, 16)}…` : 'Verified';

    showPatchOperationBanner(
      `<strong>🔨 Patch Bundle Created:</strong> <code>${escapeHtml(pPath)}</code> (Target: <strong>v${escapeHtml(targetVer)}</strong> • ${escapeHtml(res?.fileCount ?? 0)} files • SHA-256: <code>${escapeHtml(sha)}</code>)`
    );
    showToast(`✓ Built patch bundle for v${targetVer}`, 'success');
    await loadAndRenderPatchStatus();
  } catch (err) {
    showToast(`Failed to build patch bundle: ${err.message}`, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function handleRollbackPatch() {
  try {
    const res = await api.rollbackPatch();
    if (res && res.error) {
      throw new Error(res.error);
    }
    const restored = res?.restoredVersion || '2026.11.17';
    showPatchOperationBanner(
      `<strong>⏪ Snapshot Restored:</strong> Rolled back installation to <code>v${escapeHtml(restored)}</code>.`
    );
    showToast(`✓ Rolled back to CalVer v${restored}`, 'info');
    await loadAndRenderPatchStatus();
  } catch (err) {
    showToast(`Rollback notice: ${err.message}`, 'warn');
  }
}

function openPatchInstallerModal() {
  const modal = document.getElementById('patch-installer-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  loadAndRenderPatchStatus();
}

function closePatchInstallerModal() {
  const modal = document.getElementById('patch-installer-modal');
  if (!modal) return;
  modal.classList.add('hidden');
}

async function loadGameAnalysis(gameId, customGamePayload = null) {
  if (customGamePayload) {
    lastCustomGamePayload = customGamePayload;
  }
  const data = await api.analyzeGame({
    gameId,
    customHardware: customHardwareOverride,
    customGame: customGamePayload,
    optimizationMode: activeOptimizationMode
  });
  if (data.specs) renderSpecsBanner(data.specs);
  if (data.game && data.analysis) {
    renderAnalysisDetail(data.game, data.analysis, data.perSettingImpact, data.exportedConfigs);
  }
}

async function initDashboard(forceRefresh = false) {
  try {
    currentAppInfo = await api.getAppInfo();
    updateCalVerHeaderBadge(currentAppInfo);
  } catch (e) {
    // ignore app info errors
  }

  try {
    const patchStatus = await api.getPatchStatus();
    currentPatchStatus = patchStatus;
    if (patchStatus && patchStatus.versionInfo) {
      updateCalVerHeaderBadge(patchStatus.versionInfo);
    }
  } catch (e) {
    // ignore patch status init errors
  }

  if (forceRefresh) {
    await api.getSpecs({ refresh: true });
  }

  const [gamesData, installedData] = await Promise.all([
    api.getGames(),
    api.getInstalled({ refresh: forceRefresh })
  ]);

  installedGames = installedData.installedGames || installedData.games || [];
  allCatalogGames = (gamesData.games || []).map((g) => enrichWithInstalledMetadata(g));

  document.getElementById('count-catalog').textContent = allCatalogGames.length;
  document.getElementById('count-installed').textContent = installedGames.length;

  renderSpecsBanner(gamesData.specs);
  populateGenreDropdown();

  // Pre-fill simulator inputs
  document.getElementById('sim-cpu').value = gamesData.specs.cpu.name;
  document.getElementById('sim-gpu').value = gamesData.specs.gpu.name;
  document.getElementById('sim-vram').value = gamesData.specs.gpu.vramGB;
  document.getElementById('sim-ram').value = gamesData.specs.ram.totalGB;

  if (allCatalogGames.length > 0 && selectedGameId === 'cyberpunk-2077') {
    const topActive = allCatalogGames.find((g) => g.isRunning || g.wasRecentlyPlayed || g.installed);
    if (topActive) {
      selectedGameId = topActive.id;
    }
  }

  renderGameList();
  await loadGameAnalysis(selectedGameId);
}

// Sidebar filter tabs ("All Catalog Games" vs "Installed on My PC")
document.getElementById('filter-tab-all').addEventListener('click', () => {
  activeSourceTab = 'all';
  document.getElementById('filter-tab-all').classList.add('active');
  document.getElementById('filter-tab-installed').classList.remove('active');
  renderGameList();
});

document.getElementById('filter-tab-installed').addEventListener('click', () => {
  activeSourceTab = 'installed';
  document.getElementById('filter-tab-installed').classList.add('active');
  document.getElementById('filter-tab-all').classList.remove('active');
  if (installedGames.length > 0 && !installedGames.some((g) => g.id === selectedGameId)) {
    selectedGameId = installedGames[0].id;
    loadGameAnalysis(selectedGameId);
  }
  renderGameList();
});

document.getElementById('game-search').addEventListener('input', () => {
  renderGameList();
});

document.getElementById('game-genre-filter').addEventListener('change', () => {
  renderGameList();
});

document.getElementById('game-tier-filter').addEventListener('change', () => {
  renderGameList();
});

document.getElementById('btn-rescan').addEventListener('click', async () => {
  const btn = document.getElementById('btn-rescan');
  const origHtml = btn.innerHTML;
  btn.disabled = true;
  btn.textContent = '⏳ Rescanning Rig & Drives...';

  customHardwareOverride = null;
  document.getElementById('sim-badge').classList.add('hidden');

  try {
    await initDashboard(true);
    const driveCount = currentSpecs?.storage?.allDrives?.length || 1;
    showToast(
      `✓ Rescanned Rig & Drives: ${currentSpecs?.gpu?.name || 'GPU'}, ${driveCount} drive(s), ${installedGames.length} installed game(s) found.`,
      'success'
    );
  } catch (err) {
    showToast(`Rescan failed: ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = origHtml;
  }
});

// CalVer Patch & Installer Modal triggers
document.getElementById('btn-patch-installer').addEventListener('click', () => {
  openPatchInstallerModal();
});

document.getElementById('calver-header-badge').addEventListener('click', () => {
  openPatchInstallerModal();
});

document.getElementById('btn-close-patch-modal').addEventListener('click', () => {
  closePatchInstallerModal();
});

document.getElementById('patch-installer-modal').addEventListener('click', (e) => {
  if (e.target.id === 'patch-installer-modal') {
    closePatchInstallerModal();
  }
});

document.getElementById('btn-browse-apply-patch').addEventListener('click', () => {
  handleApplyPatch(null);
});

document.getElementById('btn-create-patch').addEventListener('click', () => {
  handleCreatePatch();
});

document.getElementById('btn-rollback-patch').addEventListener('click', () => {
  handleRollbackPatch();
});

document.getElementById('btn-open-installer-dir').addEventListener('click', () => {
  const rawArt = currentPatchStatus?.installerArtifacts;
  const distDir =
    (rawArt && typeof rawArt === 'object' && !Array.isArray(rawArt) && rawArt.distDir) ||
    'dist';
  handleOpenGameFolder(distDir, 'Native Installer Artifacts');
});

document.getElementById('btn-toggle-sim').addEventListener('click', () => {
  document.getElementById('simulator-drawer').classList.toggle('hidden');
  document.getElementById('custom-game-drawer').classList.add('hidden');
});

document.getElementById('btn-custom-game').addEventListener('click', () => {
  document.getElementById('custom-game-drawer').classList.toggle('hidden');
  document.getElementById('simulator-drawer').classList.add('hidden');
});

document.getElementById('btn-apply-sim').addEventListener('click', async () => {
  const presetVal = (document.getElementById('sim-display-preset')?.value || '').trim();
  let simDisplay = null;
  if (presetVal) {
    const m = presetVal.match(/^(\d+)x(\d+)@(\d+)$/);
    if (m) {
      const w = Number(m[1]);
      const h = Number(m[2]);
      const hz = Number(m[3]);
      const tier = h >= 2160 ? '4K' : h >= 1440 ? '1440p' : '1080p';
      simDisplay = {
        name: `Simulated ${tier} @ ${hz}Hz Display`,
        width: w,
        height: h,
        resolutionLabel: `${w}x${h} (${tier})`,
        tier,
        refreshRateHz: hz,
        aspectRatio: '16:9',
        vrrCapable: hz >= 120,
        probeEngine: 'Simulated Screen Override'
      };
    }
  }

  customHardwareOverride = {
    cpuName: document.getElementById('sim-cpu').value.trim(),
    gpuName: document.getElementById('sim-gpu').value.trim(),
    vramGB: Number(document.getElementById('sim-vram').value),
    ramGB: Number(document.getElementById('sim-ram').value),
    ...(simDisplay
      ? {
          display: simDisplay,
          displayWidth: simDisplay.width,
          displayHeight: simDisplay.height,
          displayHz: simDisplay.refreshRateHz,
          displayName: simDisplay.name
        }
      : {})
  };
  document.getElementById('sim-badge').classList.remove('hidden');
  await loadGameAnalysis(selectedGameId, lastCustomGamePayload);
  showToast('🔧 Simulated hardware & screen override applied.', 'info');
});

document.getElementById('btn-reset-sim').addEventListener('click', async () => {
  customHardwareOverride = null;
  const presetSelect = document.getElementById('sim-display-preset');
  if (presetSelect) presetSelect.value = '';
  document.getElementById('sim-badge').classList.add('hidden');
  await initDashboard(false);
  showToast('Restored real detected PC hardware & primary screen.', 'info');
});

// Sample Steam requirements loader
document.getElementById('btn-fill-sample-steam').addEventListener('click', () => {
  document.getElementById('cg-title').value = 'Kingdom Come: Deliverance II';
  document.getElementById('cg-raw-steam-specs').value = [
    'MINIMUM:',
    'Requires a 64-bit processor and operating system',
    'OS: Windows 10 64-bit (or newer)',
    'Processor: Intel Core i5-8400, AMD Ryzen 5 2600',
    'Memory: 16 GB RAM',
    'Graphics: NVIDIA GeForce GTX 1060 (6GB), AMD Radeon RX 580',
    'Storage: 100 GB available space',
    '',
    'RECOMMENDED:',
    'Requires a 64-bit processor and operating system',
    'OS: Windows 10 64-bit (or newer)',
    'Processor: Intel Core i7-13700K, AMD Ryzen 7 7800X3D',
    'Memory: 32 GB RAM',
    'Graphics: NVIDIA GeForce RTX 4070 (12GB), AMD Radeon RX 7800 XT',
    'Storage: 100 GB available space (SSD required)'
  ].join('\n');
});

// Parse Raw Steam Specs via api.parseRequirements (Electron IPC or HTTP fallback)
document.getElementById('btn-parse-steam-specs').addEventListener('click', async () => {
  const statusEl = document.getElementById('parse-reqs-status');
  const rawText = document.getElementById('cg-raw-steam-specs').value.trim();
  const title = document.getElementById('cg-title').value.trim() || 'Custom Steam Game';

  if (!rawText) {
    statusEl.style.color = 'var(--amber)';
    statusEl.textContent = 'Please paste Steam system requirements text first (or click Load Sample).';
    return;
  }

  statusEl.style.color = 'var(--accent)';
  statusEl.textContent = 'Parsing requirements & analyzing compatibility...';

  try {
    const data = await api.parseRequirements({
      title,
      text: rawText,
      customHardware: customHardwareOverride,
      optimizationMode: activeOptimizationMode
    });

    // Populate manual fields with extracted specs so user can inspect or tweak them
    if (data.game) {
      lastCustomGamePayload = data.game;
      document.getElementById('cg-title').value = data.game.title;
      document.getElementById('cg-storage').value = data.game.storageGB;
      document.getElementById('cg-min-cpu').value = data.game.minimum.cpu;
      document.getElementById('cg-min-gpu').value = data.game.minimum.gpu;
      document.getElementById('cg-min-vram').value = data.game.minimum.vramGB;
      document.getElementById('cg-rec-cpu').value = data.game.recommended.cpu;
      document.getElementById('cg-rec-gpu').value = data.game.recommended.gpu;
      document.getElementById('cg-rec-vram').value = data.game.recommended.vramGB;
    }

    if (data.specs) renderSpecsBanner(data.specs);
    if (data.game && data.analysis) {
      renderAnalysisDetail(data.game, data.analysis, data.perSettingImpact, data.exportedConfigs);
    }

    statusEl.style.color = 'var(--green)';
    statusEl.textContent = `✓ Parsed "${data.game.title}" (${data.game.minimum.gpu} min → ${data.game.recommended.gpu} rec)`;
    showToast(`✓ Analyzed custom specs for "${data.game.title}"`, 'success');
  } catch (err) {
    statusEl.style.color = 'var(--red)';
    statusEl.textContent = `Error: ${err.message}`;
  }
});

document.getElementById('btn-run-custom-game').addEventListener('click', async () => {
  const customGame = {
    title: document.getElementById('cg-title').value.trim(),
    storageGB: Number(document.getElementById('cg-storage').value),
    minCpu: document.getElementById('cg-min-cpu').value.trim(),
    minGpu: document.getElementById('cg-min-gpu').value.trim(),
    minVramGB: Number(document.getElementById('cg-min-vram').value),
    recCpu: document.getElementById('cg-rec-cpu').value.trim(),
    recGpu: document.getElementById('cg-rec-gpu').value.trim(),
    recVramGB: Number(document.getElementById('cg-rec-vram').value)
  };
  await loadGameAnalysis(null, customGame);
  showToast(`✓ Analyzed manual specs for "${customGame.title}"`, 'info');
});

/* ============================================================================
 * Country-Aware Component Price & Verified Deals Finder + Firewall Gate
 * ========================================================================== */

let currentFirewallStatus = { granted: false };

async function refreshFirewallStatusUI() {
  try {
    const status = await api.getFirewallStatus();
    currentFirewallStatus = status || { granted: false };
  } catch (_e) {
    currentFirewallStatus = { granted: false };
  }

  const bar = document.getElementById('firewall-security-bar');
  const pill = document.getElementById('firewall-status-pill');
  const consentBanner = document.getElementById('firewall-consent-banner');
  const btnGrant = document.getElementById('btn-grant-firewall');
  const btnOsPrompt = document.getElementById('btn-os-firewall-prompt');
  const btnRevoke = document.getElementById('btn-revoke-firewall');

  const isGranted = Boolean(currentFirewallStatus.granted);

  if (bar) {
    bar.classList.toggle('is-authorized', isGranted);
    bar.classList.toggle('is-blocked', !isGranted);
  }
  if (pill) {
    pill.textContent = isGranted
      ? '🟢 Firewall Authorized (HTTPS Port 443 Read-Only)'
      : '🔒 Firewall Gate: Blocked (Offline Safe)';
    pill.classList.toggle('pill-authorized', isGranted);
    pill.classList.toggle('pill-blocked', !isGranted);
  }
  if (consentBanner) {
    consentBanner.classList.toggle('hidden', isGranted);
  }
  if (btnGrant) btnGrant.classList.toggle('hidden', isGranted);
  if (btnOsPrompt) btnOsPrompt.classList.toggle('hidden', isGranted);
  if (btnRevoke) btnRevoke.classList.toggle('hidden', !isGranted);

  return isGranted;
}

async function handleGrantFirewallAccess(useNativeOsDialog = false, autoRunSearch = true) {
  const country = document.getElementById('deals-country-select')?.value || 'AR';
  const query = document.getElementById('deals-query-input')?.value || 'AMD Radeon RX 7600';

  try {
    const res = await api.requestFirewallAccess({
      country,
      query,
      autoApprove: !useNativeOsDialog
    });

    await refreshFirewallStatusUI();

    if (res && res.granted) {
      showToast('🛡️ Outbound HTTPS (Port 443) Firewall permission granted for verified hardware retailers.', 'success');
      if (autoRunSearch) {
        await handleSearchComponentDeals();
      }
    } else {
      showToast('🔒 Outbound network access remains blocked (Offline Safe mode).', 'info');
    }
  } catch (err) {
    showToast(`Firewall authorization error: ${err.message}`, 'error');
  }
}

async function handleRevokeFirewallAccess() {
  try {
    await api.revokeFirewallAccess();
    await refreshFirewallStatusUI();
    const repBanner = document.getElementById('deals-reputation-banner');
    const tipsEl = document.getElementById('deals-safety-tips');
    const gridEl = document.getElementById('deals-results-grid');
    if (repBanner) repBanner.classList.add('hidden');
    if (tipsEl) tipsEl.classList.add('hidden');
    if (gridEl) {
      gridEl.innerHTML = `<div class="empty-state-sm">🔒 Outbound Firewall access was revoked. Grant Firewall permission above to search verified component deals.</div>`;
    }
    showToast('🔒 Revoked outbound network permission. RigCheck is 100% offline.', 'info');
  } catch (err) {
    showToast(`Failed to revoke firewall permission: ${err.message}`, 'error');
  }
}

function renderDealsResults(res) {
  const repBanner = document.getElementById('deals-reputation-banner');
  const tipsEl = document.getElementById('deals-safety-tips');
  const gridEl = document.getElementById('deals-results-grid');
  if (!gridEl) return;

  if (!res || res.error === 'FIREWALL_PERMISSION_REQUIRED') {
    if (repBanner) repBanner.classList.add('hidden');
    if (tipsEl) tipsEl.classList.add('hidden');
    gridEl.innerHTML = `<div class="empty-state-sm">🔒 Outbound Firewall authorization is required before querying component prices. Click <strong>"Authorize Outbound HTTPS &amp; Search Deals"</strong> above.</div>`;
    return;
  }

  const audit = res.reputationAudit || {
    verifiedCount: (res.deals || []).length,
    blockedBadReputationCount: 0,
    strictMode: true
  };

  if (repBanner) {
    repBanner.classList.remove('hidden');
    repBanner.innerHTML = `
      <div class="rep-audit-main">
        <span class="rep-shield-pill">🛡️ Reputation Shield Active</span>
        <span>
          <strong>${escapeHtml(audit.verifiedCount)} Verified Official Stores &amp; Aggregators</strong> for
          <strong class="accent">${escapeHtml(res.query)}</strong> in
          <strong>${escapeHtml(res.countryFlag || '')} ${escapeHtml(res.countryName)} (${escapeHtml(res.currency)})</strong>
        </span>
      </div>
      <div class="rep-audit-blocked">
        🚫 <strong>${escapeHtml(audit.blockedBadReputationCount)} Untrusted / Mining / Scam Listings Blocked</strong>
        (Ref Price: ~${escapeHtml(res.formattedReferencePrice || '')})
      </div>
    `;
  }

  if (tipsEl) {
    const tips = Array.isArray(res.buyerSafetyTips) ? res.buyerSafetyTips : [];
    if (tips.length > 0) {
      tipsEl.classList.remove('hidden');
      tipsEl.innerHTML = tips.map((t) => `<div class="safety-tip-item">${escapeHtml(t)}</div>`).join('');
    } else {
      tipsEl.classList.add('hidden');
    }
  }

  const deals = Array.isArray(res.deals) ? res.deals : [];
  if (deals.length === 0) {
    gridEl.innerHTML = `<div class="empty-state-sm">No verified deals matched your query.</div>`;
    return;
  }

  gridEl.innerHTML = deals
    .map((deal, idx) => {
      const isTopChoice = idx === 0;
      const topClass = isTopChoice ? 'deal-card-top' : '';
      const topRibbon = isTopChoice
        ? `<span class="deal-top-ribbon">⭐ Best Verified Choice in ${escapeHtml(res.country)}</span>`
        : '';
      return `
        <div class="deal-card ${topClass}">
          <div class="deal-card-header">
            <div>
              ${topRibbon}
              <div class="deal-store-name">${escapeHtml(deal.storeName)}</div>
              <div class="deal-badge-row">
                <span class="deal-trust-pill">🛡️ Trust ${escapeHtml(deal.trustScore)}/10 (${escapeHtml(deal.positiveRatingPct || 96)}%+)</span>
                <span class="deal-seller-badge">${escapeHtml(deal.badge || deal.sellerType)}</span>
              </div>
            </div>
            <div class="deal-price-box">
              <div class="deal-price-value">${escapeHtml(deal.formattedPrice)}</div>
              <div class="deal-price-type">${escapeHtml(deal.priceType || 'Official Price')}</div>
            </div>
          </div>
          <div class="deal-card-body">
            <div class="deal-item-title">${escapeHtml(deal.title)}</div>
            <div class="deal-meta-strip">
              <span>📦 ${escapeHtml(deal.conditionLabel || 'Nuevo en Caja Sellada')}</span>
              <span>•</span>
              <span>📜 ${escapeHtml(deal.warranty || 'Garantía Oficial')}</span>
            </div>
          </div>
          <div class="deal-card-footer">
            <code class="deal-url-preview">${escapeHtml(deal.url)}</code>
            <button
              type="button"
              class="btn btn-xs btn-primary btn-open-deal-url"
              data-deal-url="${escapeHtml(deal.url)}"
              data-store-name="${escapeHtml(deal.storeName)}"
            >
              🔗 View Verified Deal ↗
            </button>
          </div>
        </div>
      `;
    })
    .join('');

  gridEl.querySelectorAll('.btn-open-deal-url').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const targetUrl = btn.getAttribute('data-deal-url');
      const storeName = btn.getAttribute('data-store-name') || 'Store';
      try {
        await api.openExternalUrl(targetUrl);
        showToast(`🔗 Opened verified store: ${storeName}`, 'info', 2800);
      } catch (err) {
        showToast(`Blocked URL: ${err.message}`, 'error');
      }
    });
  });
}

async function handleSearchComponentDeals() {
  const isGranted = await refreshFirewallStatusUI();
  if (!isGranted) {
    showToast('🔒 Please grant Firewall Outbound HTTPS permission first to search component deals.', 'warn');
    return;
  }

  const country = document.getElementById('deals-country-select')?.value || 'AR';
  const queryInput = document.getElementById('deals-query-input');
  const query = (queryInput?.value || '').trim() || 'AMD Radeon RX 7600';
  const strictReputation = document.getElementById('deals-strict-reputation')?.checked !== false;
  const searchBtn = document.getElementById('btn-search-deals');

  if (searchBtn) {
    searchBtn.disabled = true;
    searchBtn.textContent = '⏳ Searching Verified Stores...';
  }

  try {
    const res = await api.searchComponentDeals({
      query,
      country,
      strictReputation
    });
    renderDealsResults(res);
  } catch (err) {
    showToast(`Price search failed: ${err.message}`, 'error');
  } finally {
    if (searchBtn) {
      searchBtn.disabled = false;
      searchBtn.textContent = '🔍 Search Verified Deals';
    }
  }
}

async function openDealsFinderModal(prefillQuery = null, prefillCountry = null) {
  const modal = document.getElementById('deals-finder-modal');
  if (!modal) return;

  const queryInput = document.getElementById('deals-query-input');
  if (prefillQuery && queryInput) {
    queryInput.value = prefillQuery;
  }
  const countrySelect = document.getElementById('deals-country-select');
  if (prefillCountry && countrySelect) {
    countrySelect.value = prefillCountry;
  }

  modal.classList.remove('hidden');
  const isGranted = await refreshFirewallStatusUI();
  if (isGranted) {
    await handleSearchComponentDeals();
  }
}

function closeDealsFinderModal() {
  const modal = document.getElementById('deals-finder-modal');
  if (!modal) return;
  modal.classList.add('hidden');
}

document.getElementById('btn-deals-finder')?.addEventListener('click', () => {
  openDealsFinderModal();
});

document.getElementById('btn-close-deals-modal')?.addEventListener('click', () => {
  closeDealsFinderModal();
});

document.getElementById('deals-finder-modal')?.addEventListener('click', (e) => {
  if (e.target.id === 'deals-finder-modal') {
    closeDealsFinderModal();
  }
});

document.getElementById('btn-grant-firewall')?.addEventListener('click', () => {
  handleGrantFirewallAccess(false, true);
});

document.getElementById('btn-os-firewall-prompt')?.addEventListener('click', () => {
  handleGrantFirewallAccess(true, true);
});

document.getElementById('btn-confirm-firewall-search')?.addEventListener('click', () => {
  handleGrantFirewallAccess(false, true);
});

document.getElementById('btn-confirm-firewall-os-dialog')?.addEventListener('click', () => {
  handleGrantFirewallAccess(true, true);
});

document.getElementById('btn-revoke-firewall')?.addEventListener('click', () => {
  handleRevokeFirewallAccess();
});

document.getElementById('btn-search-deals')?.addEventListener('click', () => {
  handleSearchComponentDeals();
});

document.getElementById('deals-query-input')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    handleSearchComponentDeals();
  }
});

document.getElementById('deals-country-select')?.addEventListener('change', async () => {
  if (currentFirewallStatus.granted) {
    await handleSearchComponentDeals();
  }
});

document.getElementById('deals-strict-reputation')?.addEventListener('change', async () => {
  if (currentFirewallStatus.granted) {
    await handleSearchComponentDeals();
  }
});

document.querySelectorAll('.deals-chip').forEach((chip) => {
  chip.addEventListener('click', async () => {
    const q = chip.getAttribute('data-query') || 'AMD Radeon RX 7600';
    const input = document.getElementById('deals-query-input');
    if (input) input.value = q;
    if (currentFirewallStatus.granted) {
      await handleSearchComponentDeals();
    } else {
      await handleGrantFirewallAccess(false, true);
    }
  });
});

document.getElementById('btn-find-sim-gpu-deals')?.addEventListener('click', () => {
  const simGpu = (document.getElementById('sim-gpu')?.value || '').trim() || 'AMD Radeon RX 7600';
  openDealsFinderModal(simGpu);
});

document.getElementById('btn-find-sim-cpu-deals')?.addEventListener('click', () => {
  const simCpu = (document.getElementById('sim-cpu')?.value || '').trim() || 'AMD Ryzen 7 5700X3D';
  openDealsFinderModal(simCpu);
});

initDashboard();
