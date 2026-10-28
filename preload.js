/**
 * =====================================================================
 * SENTINEL STUDIO™ — SECURE CONTEXT BRIDGE
 * Preload Script exposing window.sentinelDesktop with WebContentsView controls,
 * External CDP Relay status, Broadcast, Chat Capture & File System APIs
 * =====================================================================
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('sentinelDesktop', {
  checkRelayStatus: () => ipcRenderer.invoke('relay:check-status'),
  syncViewBounds: (data) => ipcRenderer.send('view:sync-bounds', data),
  broadcastPrompt: (text) => ipcRenderer.invoke('ai:broadcast-prompt', text),
  captureChat: (target) => ipcRenderer.invoke('ai:capture-chat', target),
  runConferenceStep: (params) => ipcRenderer.invoke('ai:conference-step', params),
  selectDirectory: () => ipcRenderer.invoke('dialog:select-directory'),
  readFile: (filePath) => ipcRenderer.invoke('fs:read-file', filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke('fs:write-file', filePath, content),
  saveBinary: (filePath, buffer) => ipcRenderer.invoke('fs:save-binary', filePath, buffer),
  getVersion: () => ipcRenderer.invoke('app:get-version'),
  isDesktop: true
});
