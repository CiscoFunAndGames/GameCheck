const { contextBridge, ipcRenderer } = require('electron');

function enrichPatchStatus(status) {
  if (!status || typeof status !== 'object') return status;
  if (Array.isArray(status.installerArtifacts)) {
    const arr = status.installerArtifacts;
    arr.files = arr;
    arr.distDir = status.distDir || null;
    arr.windows = status.windowsInstaller || null;
    arr.windowsExe = status.windowsInstaller || null;
    arr.linux = status.linuxInstaller || null;
    arr.linuxInstaller = status.linuxInstaller || null;
  }
  return status;
}

contextBridge.exposeInMainWorld('rigcheckAPI', {
  isNativeDesktop: true,
  getAppInfo: () => ipcRenderer.invoke('rigcheck:get-app-info'),
  getSpecs: (opts = {}) => ipcRenderer.invoke('rigcheck:get-specs', opts),
  getGames: (filters = {}) => ipcRenderer.invoke('rigcheck:get-games', filters),
  getInstalled: (opts = {}) => ipcRenderer.invoke('rigcheck:get-installed', opts),
  analyzeGame: (payload = {}) => ipcRenderer.invoke('rigcheck:analyze', payload),
  parseRequirements: (payload = {}) => ipcRenderer.invoke('rigcheck:parse-reqs', payload),
  saveConfigFile: (payload = {}) => ipcRenderer.invoke('rigcheck:save-config', payload),
  openPath: (targetPath) => ipcRenderer.invoke(
    'rigcheck:open-path',
    typeof targetPath === 'object' && targetPath !== null ? targetPath : { targetPath }
  ),
  getPatchStatus: async (opts = {}) => {
    const status = await ipcRenderer.invoke('rigcheck:get-patch-status', opts);
    return enrichPatchStatus(status);
  },
  applyPatch: (payload = {}) => ipcRenderer.invoke(
    'rigcheck:apply-patch',
    typeof payload === 'string' ? { patchPath: payload } : (payload || {})
  ),
  createPatch: (payload = {}) => ipcRenderer.invoke(
    'rigcheck:create-patch',
    typeof payload === 'string' ? { notes: payload } : (payload || {})
  ),
  rollbackPatch: (payload = {}) => ipcRenderer.invoke('rigcheck:rollback-patch', payload || {}),
  getFirewallStatus: () => ipcRenderer.invoke('rigcheck:get-firewall-status'),
  requestFirewallAccess: (payload = {}) => ipcRenderer.invoke('rigcheck:request-firewall-access', payload || {}),
  revokeFirewallAccess: () => ipcRenderer.invoke('rigcheck:revoke-firewall-access'),
  searchComponentDeals: (payload = {}) => ipcRenderer.invoke('rigcheck:search-component-deals', payload || {}),
  openExternalUrl: (urlOrPayload) => ipcRenderer.invoke(
    'rigcheck:open-external-url',
    typeof urlOrPayload === 'string' ? { url: urlOrPayload } : (urlOrPayload || {})
  )
});
