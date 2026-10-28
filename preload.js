/**
 * =====================================================================
 * SENTINEL STUDIO™ — SECURE CONTEXT BRIDGE
 * Preload Script exposing window.sentinelDesktop with WebContentsView controls
 * =====================================================================
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('sentinelDesktop', {
  triggerDirectLogin: (engine) => ipcRenderer.invoke('auth:start-direct-login', engine),
  loginGoogleAccount: () => ipcRenderer.invoke('auth:start-google-login'),
  startGoogleRelay: () => ipcRenderer.invoke('auth:start-google-relay'),
  startGoogleLogin: (options) => ipcRenderer.invoke('auth:start-direct-login', options),
  googleLogin: (options) => ipcRenderer.invoke('auth:start-direct-login', options),
  syncNow: () => ipcRenderer.invoke('auth:sync-now'),
  onSessionUpdated: (callback) => ipcRenderer.on('auth:session-updated', () => callback()),
  onLoginSuccess: (callback) => ipcRenderer.on('auth:login-success', (_event, data) => callback(data)),
  onAuthRedirect: (callback) => ipcRenderer.on('auth:redirect-webview', (_event, data) => callback(data)),
  syncViewBounds: (data) => ipcRenderer.send('view:sync-bounds', data),
  broadcastPrompt: (text) => ipcRenderer.invoke('ai:broadcast-prompt', text),
  captureChat: (target) => ipcRenderer.invoke('ai:capture-chat', target),
  runConferenceStep: (params) => ipcRenderer.invoke('ai:conference-step', params),
  reloadView: (engineKey) => ipcRenderer.invoke('view:reload', engineKey),
  navigateView: (engineKey, url) => ipcRenderer.invoke('view:navigate', { engineKey, url }),
  selectDirectory: () => ipcRenderer.invoke('dialog:select-directory'),
  readFile: (filePath) => ipcRenderer.invoke('fs:read-file', filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke('fs:write-file', filePath, content),
  saveBinary: (filePath, buffer) => ipcRenderer.invoke('fs:save-binary', filePath, buffer),
  getVersion: () => ipcRenderer.invoke('app:get-version'),
  openCompanionWindow: (url, partition) => ipcRenderer.invoke('multi-ai:open-companion', url, partition),
  clearPartition: (partition) => ipcRenderer.invoke('multi-ai:clear-partition', partition),
  openExternal: (url) => ipcRenderer.invoke('shell:open-external', url),
  openExternalLogin: () => ipcRenderer.invoke('auth:open-external-login'),
  googleCancel: () => ipcRenderer.invoke('auth:google-cancel'),
  getGoogleSession: () => ipcRenderer.invoke('auth:get-session'),
  googleLogout: () => ipcRenderer.invoke('auth:google-logout'),
  isDesktop: true
});
