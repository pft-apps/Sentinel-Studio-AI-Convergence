/**
 * =====================================================================
 * SENTINEL STUDIO™ — SECURE CONTEXT BRIDGE
 * Preload Script exposing window.sentinelDesktop with WebContentsView controls
 * =====================================================================
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('sentinelDesktop', {
  // WebContentsView Bounds & Layout Engine
  syncViewBounds: (data) => ipcRenderer.send('view:sync-bounds', data),

  // Multi-Broadcast Prompt Execution
  broadcastPrompt: (text) => ipcRenderer.invoke('ai:broadcast-prompt', text),

  // Local Chat Capture Scraping
  captureChat: (target) => ipcRenderer.invoke('ai:capture-chat', target),

  // AI-to-AI Conference Step Execution
  runConferenceStep: (params) => ipcRenderer.invoke('ai:conference-step', params),

  // Native View Controls
  reloadView: (engineKey) => ipcRenderer.invoke('view:reload', engineKey),
  navigateView: (engineKey, url) => ipcRenderer.invoke('view:navigate', { engineKey, url }),

  // File System and Directory Handlers
  selectDirectory: () => ipcRenderer.invoke('dialog:select-directory'),
  readFile: (filePath) => ipcRenderer.invoke('fs:read-file', filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke('fs:write-file', filePath, content),
  saveBinary: (filePath, arrayBuffer) => ipcRenderer.invoke('fs:save-binary', filePath, arrayBuffer),
  getVersion: () => ipcRenderer.invoke('app:get-version'),

  // Partition and Companion Windows
  openCompanionWindow: (url, partition) => ipcRenderer.invoke('multi-ai:open-companion', url, partition),
  clearPartition: (partition) => ipcRenderer.invoke('multi-ai:clear-partition', partition),
  openExternal: (url) => ipcRenderer.invoke('shell:open-external', url),

  // Direct & Browser-Based Session Relay Triggers
  triggerDirectLogin: (engine) => ipcRenderer.invoke('auth:start-direct-login', engine),
  openExternalLogin: () => ipcRenderer.invoke('auth:open-external-login'),
  startGoogleLogin: (options) => ipcRenderer.invoke('auth:start-direct-login', options),
  googleLogin: (options) => ipcRenderer.invoke('auth:start-direct-login', options),
  googleCancel: () => ipcRenderer.invoke('auth:google-cancel'),
  getGoogleSession: () => ipcRenderer.invoke('auth:get-session'),
  googleLogout: () => ipcRenderer.invoke('auth:google-logout'),

  // Event Listeners
  onLoginSuccess: (callback) =>
    ipcRenderer.on('auth:login-success', (_event, data) => callback(data)),
  onAuthRedirect: (callback) =>
    ipcRenderer.on('auth:redirect-webview', (_event, data) => callback(data)),

  isDesktop: true,
});
