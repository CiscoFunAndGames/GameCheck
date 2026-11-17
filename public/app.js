let allCatalogGames = [];
let installedGames = [];
let currentSpecs = null;
let selectedGameId = 'cyberpunk-2077';
let activeSourceTab = 'all'; // 'all' | 'installed'
let customHardwareOverride = null;
let lastExportedConfigs = null;

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

function renderSpecsBanner(specs) {
  currentSpecs = specs;
  document.getElementById('os-label').textContent = specs.os;

  document.getElementById('hw-cpu-name').textContent = specs.cpu.name;
  document.getElementById('hw-cpu-meta').textContent = `${specs.cpu.cores} Cores / ${specs.cpu.threads} Threads • Tier Score: ${specs.cpu.score}/100`;
  document.getElementById('hw-cpu-bar').style.width = `${Math.min(100, specs.cpu.score)}%`;

  document.getElementById('hw-gpu-name').textContent = specs.gpu.name;
  document.getElementById('hw-gpu-meta').textContent = `${specs.gpu.vramGB} GB VRAM • ${specs.gpu.upscaler} • Tier Score: ${specs.gpu.score}/100`;
  document.getElementById('hw-gpu-bar').style.width = `${Math.min(100, specs.gpu.score)}%`;

  document.getElementById('hw-ram-name').textContent = `${specs.ram.totalGB} GB System RAM`;
  document.getElementById('hw-ram-meta').textContent = `${specs.ram.freeGB} GB Currently Available`;
  document.getElementById('hw-ram-bar').style.width = `${Math.min(100, Math.round((specs.ram.totalGB / 32) * 100))}%`;

  document.getElementById('hw-disk-name').textContent = `${specs.storage.freeGB} GB Free (${specs.storage.drive} Best Drive)`;
  const otherDrives = (specs.storage.allDrives || [])
    .map((d) => `${d.drive} ${d.freeGB}GB`)
    .join(' • ');
  document.getElementById('hw-disk-meta').textContent = otherDrives || `Out of ${specs.storage.totalGB} GB Total`;
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
  select.innerHTML = `<option value="">All Genres (${sortedGenres.length})</option>` +
    sortedGenres.map((genre) => `<option value="${genre}">${genre}</option>`).join('');

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
      const hay = `${g.title} ${g.genre} ${g.engine || ''} ${g.launcher || ''}`.toLowerCase();
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

  container.innerHTML = filtered
    .map((g) => {
      const b = tierBadge(g.analysis.overallTier);
      const isActive = g.id === selectedGameId ? 'active' : '';
      const installedBadge = g.installed
        ? `<span class="installed-pill" title="Installed on ${g.drive || 'PC'} via ${g.launcher || 'Local'}">💿 ${g.drive || 'Installed'}</span>`
        : '';
      const subMeta = g.installed && g.launcher
        ? `${g.launcher} (${g.drive}) • ${g.sizeOnDiskGB || g.storageGB} GB`
        : `${g.genre} • ${g.storageGB} GB`;

      return `
        <div class="game-item ${isActive}" data-id="${g.id}">
          <div>
            <div class="game-item-title">
              <span>${g.title}</span>
              ${installedBadge}
            </div>
            <div class="game-item-meta">${subMeta}</div>
          </div>
          <span class="badge ${b.cls}">${b.text}</span>
        </div>
      `;
    })
    .join('');

  container.querySelectorAll('.game-item').forEach((el) => {
    el.addEventListener('click', () => {
      selectedGameId = el.getAttribute('data-id');
      renderGameList();
      loadGameAnalysis(selectedGameId);
    });
  });
}

function renderAnalysisDetail(game, analysis, perSettingImpact = [], exportedConfigs = null) {
  const panel = document.getElementById('analysis-panel');
  const b = tierBadge(analysis.overallTier);
  const opt = analysis.optimalConfig;
  const c = analysis.components;
  const impactRows = Array.isArray(perSettingImpact) && perSettingImpact.length > 0
    ? perSettingImpact
    : (analysis.perSettingImpact || []);

  lastExportedConfigs = exportedConfigs || analysis.exportedConfigs || null;

  const compRows = [
    { label: 'Processor (CPU)', data: c.cpu, min: c.cpu.minRequired, rec: c.cpu.recRequired },
    { label: 'Graphics Card (GPU)', data: c.gpu, min: c.gpu.minRequired, rec: c.gpu.recRequired },
    { label: 'Video Memory (VRAM)', data: c.vram, min: c.vram.minRequired, rec: c.vram.recRequired },
    { label: 'System Memory (RAM)', data: c.ram, min: c.ram.minRequired, rec: c.ram.recRequired },
    { label: 'Disk Storage', data: c.storage, min: c.storage.required, rec: c.storage.required }
  ];

  const installedBanner = game.installed
    ? `<span class="installed-pill" style="font-size:0.75rem;padding:3px 9px;">💿 Installed on ${game.drive || 'PC'} (${game.launcher || 'Local'} • ${game.sizeOnDiskGB || game.storageGB} GB)</span>`
    : '';

  panel.innerHTML = `
    <div class="game-hero">
      <div>
        <h2>
          <span>${game.title}</span>
          ${installedBanner}
        </h2>
        <div class="game-hero-meta">${game.genre} • Engine: ${game.engine || 'Standard'} • Release: ${game.releaseYear || 2024}</div>
      </div>
      <div class="hero-right">
        <span class="badge ${b.cls}" style="font-size:0.88rem;padding:6px 14px;">${b.text}</span>
        <div class="export-bar">
          <button id="btn-download-ini" class="btn-export" type="button" title="Download ready-to-use .INI graphics config">⬇️ Download Optimal .INI</button>
          <button id="btn-download-json" class="btn-export" type="button" title="Download full .JSON hardware & settings profile">📄 Download .JSON Profile</button>
          <button id="btn-download-md" class="btn-export" type="button" title="Download Markdown tuning checklist">📝 Download .MD Guide</button>
        </div>
      </div>
    </div>

    <div class="bottleneck-banner">
      <strong>💡 Hardware Balance Insight:</strong> ${analysis.bottleneck.note}
    </div>

    <div class="panel-subtitle">🚀 Estimated Performance (With Optimal Settings)</div>
    <div class="fps-grid">
      <div class="fps-card">
        <div class="fps-res">1080p (FHD)</div>
        <div class="fps-val">${opt.estimatedFps['1080p'].range}</div>
        <div class="fps-sub">~${opt.estimatedFps['1080p'].avg} FPS Avg</div>
      </div>
      <div class="fps-card">
        <div class="fps-res">1440p (QHD)</div>
        <div class="fps-val">${opt.estimatedFps['1440p'].range}</div>
        <div class="fps-sub">~${opt.estimatedFps['1440p'].avg} FPS Avg</div>
      </div>
      <div class="fps-card">
        <div class="fps-res">4K (UHD)</div>
        <div class="fps-val">${opt.estimatedFps['4K'].range}</div>
        <div class="fps-sub">~${opt.estimatedFps['4K'].avg} FPS Avg</div>
      </div>
    </div>

    <div class="panel-subtitle">⚙️ Recommended Optimal Graphics Configuration</div>
    <div class="settings-grid">
      <div class="setting-box">
        <div class="setting-name">Target Resolution</div>
        <div class="setting-val">${opt.targetResolution}</div>
      </div>
      <div class="setting-box">
        <div class="setting-name">Graphics Preset</div>
        <div class="setting-val">${opt.preset}</div>
      </div>
      <div class="setting-box">
        <div class="setting-name">Upscaling (FSR / DLSS)</div>
        <div class="setting-val">${opt.upscalingMode}</div>
      </div>
      <div class="setting-box">
        <div class="setting-name">Frame Generation</div>
        <div class="setting-val">${opt.frameGen}</div>
      </div>
      <div class="setting-box">
        <div class="setting-name">Texture Quality</div>
        <div class="setting-val">${opt.textures}</div>
      </div>
      <div class="setting-box">
        <div class="setting-name">Shadow Quality</div>
        <div class="setting-val">${opt.shadows}</div>
      </div>
      <div class="setting-box">
        <div class="setting-name">Ray Tracing</div>
        <div class="setting-val">${opt.rayTracing}</div>
      </div>
    </div>

    ${impactRows.length > 0 ? `
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
                  <td><strong>${item.setting}</strong></td>
                  <td><span style="color:var(--accent);font-weight:700;">${item.recommendedValue}</span></td>
                  <td class="impact-bar-cell">
                    <div class="impact-bar-header">
                      <span>${fpsLabel}</span>
                    </div>
                    <div class="impact-bar-track">
                      <div class="impact-bar-fill" style="width:${barPct}%"></div>
                    </div>
                  </td>
                  <td><span class="vram-chip">~${item.vramImpactMB} MB</span></td>
                  <td><span class="visual-cost-chip">${item.visualCost}</span></td>
                  <td class="impact-note">${item.note}</td>
                </tr>
              `;
            })
            .join('')}
        </tbody>
      </table>
    ` : ''}

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
            return `
              <tr>
                <td><strong>${row.label}</strong></td>
                <td>${row.data.userValue}</td>
                <td>${row.min}</td>
                <td>${row.rec}</td>
                <td><span class="badge ${st.cls}">${st.text}</span></td>
              </tr>
            `;
          })
          .join('')}
      </tbody>
    </table>

    <div class="panel-subtitle">🎯 Engine &amp; Game-Specific Optimization Tips</div>
    <ul class="tips-list">
      ${opt.tuningTips.map((tip) => `<li>✨ ${tip}</li>`).join('')}
    </ul>
  `;

  const btnIni = document.getElementById('btn-download-ini');
  const btnJson = document.getElementById('btn-download-json');
  const btnMd = document.getElementById('btn-download-md');

  if (btnIni && lastExportedConfigs) {
    btnIni.addEventListener('click', () => {
      downloadTextFile(
        `${lastExportedConfigs.filenameBase || 'optimal-settings'}.ini`,
        lastExportedConfigs.iniContent,
        'text/plain;charset=utf-8'
      );
    });
  }
  if (btnJson && lastExportedConfigs) {
    btnJson.addEventListener('click', () => {
      downloadTextFile(
        `${lastExportedConfigs.filenameBase || 'optimal-settings'}.json`,
        lastExportedConfigs.jsonContent,
        'application/json;charset=utf-8'
      );
    });
  }
  if (btnMd && lastExportedConfigs) {
    btnMd.addEventListener('click', () => {
      downloadTextFile(
        `${lastExportedConfigs.filenameBase || 'optimal-settings'}.md`,
        lastExportedConfigs.markdownGuide,
        'text/markdown;charset=utf-8'
      );
    });
  }
}

async function loadGameAnalysis(gameId, customGamePayload = null) {
  const res = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      gameId,
      customHardware: customHardwareOverride,
      customGame: customGamePayload
    })
  });
  const data = await res.json();
  if (data.specs) renderSpecsBanner(data.specs);
  if (data.game && data.analysis) {
    renderAnalysisDetail(data.game, data.analysis, data.perSettingImpact, data.exportedConfigs);
  }
}

async function initDashboard(forceRefresh = false) {
  if (forceRefresh) {
    await fetch('/api/specs?refresh=1');
  }
  const [gamesRes, installedRes] = await Promise.all([
    fetch('/api/games'),
    fetch(`/api/installed${forceRefresh ? '?refresh=1' : ''}`)
  ]);
  const gamesData = await gamesRes.json();
  const installedData = await installedRes.json();

  allCatalogGames = gamesData.games || [];
  installedGames = installedData.installedGames || installedData.games || [];

  document.getElementById('count-catalog').textContent = allCatalogGames.length;
  document.getElementById('count-installed').textContent = installedGames.length;

  renderSpecsBanner(gamesData.specs);
  populateGenreDropdown();

  // Pre-fill simulator inputs
  document.getElementById('sim-cpu').value = gamesData.specs.cpu.name;
  document.getElementById('sim-gpu').value = gamesData.specs.gpu.name;
  document.getElementById('sim-vram').value = gamesData.specs.gpu.vramGB;
  document.getElementById('sim-ram').value = gamesData.specs.ram.totalGB;

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

document.getElementById('btn-rescan').addEventListener('click', () => {
  customHardwareOverride = null;
  document.getElementById('sim-badge').classList.add('hidden');
  initDashboard(true);
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
  customHardwareOverride = {
    cpuName: document.getElementById('sim-cpu').value.trim(),
    gpuName: document.getElementById('sim-gpu').value.trim(),
    vramGB: Number(document.getElementById('sim-vram').value),
    ramGB: Number(document.getElementById('sim-ram').value)
  };
  document.getElementById('sim-badge').classList.remove('hidden');
  await loadGameAnalysis(selectedGameId);
});

document.getElementById('btn-reset-sim').addEventListener('click', () => {
  customHardwareOverride = null;
  document.getElementById('sim-badge').classList.add('hidden');
  initDashboard(false);
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

// Parse Raw Steam Specs via POST /api/parse-reqs
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
    const res = await fetch('/api/parse-reqs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        text: rawText,
        customHardware: customHardwareOverride
      })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to parse requirements');
    }

    // Populate manual fields with extracted specs so user can inspect or tweak them
    if (data.game) {
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
});

initDashboard();
