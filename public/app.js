let allGames = [];
let currentSpecs = null;
let selectedGameId = 'cyberpunk-2077';
let customHardwareOverride = null;

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

function renderGameList(filterText = '') {
  const container = document.getElementById('game-list');
  const q = filterText.trim().toLowerCase();
  const filtered = allGames.filter(
    (g) => g.title.toLowerCase().includes(q) || g.genre.toLowerCase().includes(q)
  );

  container.innerHTML = filtered
    .map((g) => {
      const b = tierBadge(g.analysis.overallTier);
      const isActive = g.id === selectedGameId ? 'active' : '';
      return `
        <div class="game-item ${isActive}" data-id="${g.id}">
          <div>
            <div class="game-item-title">${g.title}</div>
            <div class="game-item-meta">${g.genre} • ${g.storageGB} GB</div>
          </div>
          <span class="badge ${b.cls}">${b.text}</span>
        </div>
      `;
    })
    .join('');

  container.querySelectorAll('.game-item').forEach((el) => {
    el.addEventListener('click', () => {
      selectedGameId = el.getAttribute('data-id');
      renderGameList(document.getElementById('game-search').value);
      loadGameAnalysis(selectedGameId);
    });
  });
}

function renderAnalysisDetail(game, analysis) {
  const panel = document.getElementById('analysis-panel');
  const b = tierBadge(analysis.overallTier);
  const opt = analysis.optimalConfig;
  const c = analysis.components;

  const compRows = [
    { label: 'Processor (CPU)', data: c.cpu, min: c.cpu.minRequired, rec: c.cpu.recRequired },
    { label: 'Graphics Card (GPU)', data: c.gpu, min: c.gpu.minRequired, rec: c.gpu.recRequired },
    { label: 'Video Memory (VRAM)', data: c.vram, min: c.vram.minRequired, rec: c.vram.recRequired },
    { label: 'System Memory (RAM)', data: c.ram, min: c.ram.minRequired, rec: c.ram.recRequired },
    { label: 'Disk Storage', data: c.storage, min: c.storage.required, rec: c.storage.required }
  ];

  panel.innerHTML = `
    <div class="game-hero">
      <div>
        <h2>${game.title}</h2>
        <div class="game-hero-meta">${game.genre} • Engine: ${game.engine} • Release: ${game.releaseYear}</div>
      </div>
      <span class="badge ${b.cls}" style="font-size:0.88rem;padding:6px 14px;">${b.text}</span>
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

    <div class="panel-subtitle">🎯 Engine & Game-Specific Optimization Tips</div>
    <ul class="tips-list">
      ${opt.tuningTips.map((tip) => `<li>✨ ${tip}</li>`).join('')}
    </ul>
  `;
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
    renderAnalysisDetail(data.game, data.analysis);
  }
}

async function initDashboard(forceRefresh = false) {
  if (forceRefresh) {
    await fetch('/api/specs?refresh=1');
  }
  const res = await fetch('/api/games');
  const data = await res.json();
  allGames = data.games;
  renderSpecsBanner(data.specs);

  // Pre-fill simulator inputs
  document.getElementById('sim-cpu').value = data.specs.cpu.name;
  document.getElementById('sim-gpu').value = data.specs.gpu.name;
  document.getElementById('sim-vram').value = data.specs.gpu.vramGB;
  document.getElementById('sim-ram').value = data.specs.ram.totalGB;

  renderGameList(document.getElementById('game-search').value);
  await loadGameAnalysis(selectedGameId);
}

document.getElementById('game-search').addEventListener('input', (e) => {
  renderGameList(e.target.value);
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
