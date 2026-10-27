/**
 * =====================================================================
 * SENTINEL STUDIO™ — SECURE CONTEXT BRIDGE
 * Preload Script exposing window.sentinelDesktop
 * =====================================================================
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('sentinelDesktop', {
  selectDirectory: () => ipcRenderer.invoke('dialog:select-directory'),
  readFile: (filePath) => ipcRenderer.invoke('fs:read-file', filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke('fs:write-file', filePath, content),
  saveBinary: (filePath, arrayBuffer) => ipcRenderer.invoke('fs:save-binary', filePath, arrayBuffer),
  getVersion: () => ipcRenderer.invoke('app:get-version'),
  openCompanionWindow: (url, partition) => ipcRenderer.invoke('multi-ai:open-companion', url, partition),
  clearPartition: (partition) => ipcRenderer.invoke('multi-ai:clear-partition', partition),
  openExternal: (url) => ipcRenderer.invoke('shell:open-external', url),

  // Google Desktop Cookie Jar Sync APIs
  startGoogleLogin: () => ipcRenderer.invoke('auth:start-google-login'),
  googleLogin: (options) => ipcRenderer.invoke('auth:start-google-login', options),
  googleCancel: () => ipcRenderer.invoke('auth:google-cancel'),
  getGoogleSession: () => ipcRenderer.invoke('auth:get-session'),
  googleLogout: () => ipcRenderer.invoke('auth:google-logout'),

  // OAuth WebView Redirect Listener
  onAuthRedirect: (callback) =>
    ipcRenderer.on('auth:redirect-webview', (_event, data) => callback(data)),

  isDesktop: true,
});
