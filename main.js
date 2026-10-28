/**
 * =====================================================================
 * SENTINEL STUDIO™ — ELECTRON STANDALONE DESKTOP WORKSTATION
 * Enterprise Capability Hub & Native Multi-AI WebContentsView OS
 * Architect & Developer: Patrick Jay F. Tanap, CPA, CICA
 * =====================================================================
 */

const { app, BrowserWindow, WebContentsView, session, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const http = require('http');
const { WebSocket } = require('ws');

// 1. Chrome Spoofing & GPU Switches
const REAL_CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36';
app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled');
app.commandLine.appendSwitch('force-color-profile', 'srgb');
app.commandLine.appendSwitch('enable-unsafe-webgpu');
app.commandLine.appendSwitch('enable-features', 'Vulkan,WebGPU');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.userAgentFallback = REAL_CHROME_UA;

// 2. Persistent Dedicated User Profile
const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
const sentinelProfilePath = path.join(localAppData, 'SentinelStudio', 'UserSession');
try {
  if (!fs.existsSync(sentinelProfilePath)) {
    fs.mkdirSync(sentinelProfilePath, { recursive: true });
  }
  app.setPath('userData', sentinelProfilePath);
} catch (err) {
  console.error('[Profile Path Error]:', err);
}

let mainWindow = null;
const aiViews = {};
let activeKeys = ['copilot', 'chatgpt', 'gemini'];
let activeSplitLayout = '3-split';

// 3. External Browser Relay (CDP WebSocket Bridge for Google-Authenticated Portals)
let cdpWs = null;
let cdpRequestId = 1;
const cdpCallbacks = new Map();

async function getExternalBrowserTab(targetHost = 'gemini.google.com') {
  return new Promise((resolve) => {
    const req = http.get('http://127.0.0.1:9222/json', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const tabs = JSON.parse(data);
          const matchedTab = tabs.find(t => t.url && t.url.includes(targetHost) && t.webSocketDebuggerUrl);
          resolve(matchedTab || null);
        } catch (e) {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
  });
}

async function connectToExternalTab(wsUrl) {
  if (cdpWs && cdpWs.readyState === WebSocket.OPEN) return true;
  return new Promise((resolve) => {
    try {
      cdpWs = new WebSocket(wsUrl);
      cdpWs.on('open', () => {
        console.log('[CDP Bridge] Connected to external Chrome Gemini session');
        resolve(true);
      });
      cdpWs.on('message', (msg) => {
        try {
          const payload = JSON.parse(msg);
          if (payload.id && cdpCallbacks.has(payload.id)) {
            const cb = cdpCallbacks.get(payload.id);
            cdpCallbacks.delete(payload.id);
            cb(payload.result);
          }
        } catch (e) {}
      });
      cdpWs.on('error', () => resolve(false));
      cdpWs.on('close', () => { cdpWs = null; });
    } catch (e) {
      resolve(false);
    }
  });
}

function executeInExternalTab(script) {
  return new Promise((resolve, reject) => {
    if (!cdpWs || cdpWs.readyState !== WebSocket.OPEN) {
      return reject(new Error('External browser relay not connected on 127.0.0.1:9222'));
    }
    const id = cdpRequestId++;
    cdpCallbacks.set(id, (result) => {
      if (result && result.exceptionDetails) {
        reject(new Error(result.exceptionDetails.text || 'CDP Evaluation Failed'));
      } else {
        resolve(result ? result.result.value : null);
      }
    });
    cdpWs.send(JSON.stringify({
      id,
      method: 'Runtime.evaluate',
      params: { expression: script, returnByValue: true, awaitPromise: true }
    }));
  });
}

// 4. Session Rule Configuration
function applyHeaderRules(ses) {
  ses.setUserAgent(REAL_CHROME_UA);
  ses.webRequest.onBeforeSendHeaders((details, callback) => {
    details.requestHeaders['User-Agent'] = REAL_CHROME_UA;
    details.requestHeaders['Sec-CH-UA'] = '"Not(A:Brand";v="99", "Google Chrome";v="133", "Chromium";v="133"';
    details.requestHeaders['Sec-CH-UA-Mobile'] = '?0';
    details.requestHeaders['Sec-CH-UA-Platform'] = '"Windows"';
    callback({ cancel: false, requestHeaders: details.requestHeaders });
  });

  ses.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = { ...details.responseHeaders };
    delete responseHeaders['x-frame-options'];
    delete responseHeaders['X-Frame-Options'];
    if (responseHeaders['content-security-policy']) {
      responseHeaders['content-security-policy'] = responseHeaders['content-security-policy'].map(csp =>
        csp.replace(/frame-ancestors[^;]+;?/gi, '')
      );
    }
    callback({ responseHeaders });
  });
}

// 5. App Lifecycle & Window Initialization
app.whenReady().then(() => {
  applyHeaderRules(session.defaultSession);
  createMainWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 980,
    minWidth: 1200,
    minHeight: 800,
    backgroundColor: '#06234D',
    title: 'Sentinel Studio — Multi-AI Knowledge Workstation',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.setMenuBarVisibility(false);

  const distHtmlPath = path.join(__dirname, 'dist', 'index.html');
  const rootHtmlPath = path.join(__dirname, 'index.html');

  if (fs.existsSync(distHtmlPath)) {
    mainWindow.loadFile(distHtmlPath).catch(() => {
      if (fs.existsSync(rootHtmlPath)) mainWindow.loadFile(rootHtmlPath).catch(() => {});
    });
  } else if (fs.existsSync(rootHtmlPath)) {
    mainWindow.loadFile(rootHtmlPath).catch(() => {});
  }

  initAiViews();
  return mainWindow;
}

function initAiViews() {
  const AI_CONFIGS = {
    copilot: { url: 'https://copilot.microsoft.com', title: 'MS Copilot' },
    chatgpt: { url: 'https://chatgpt.com', title: 'ChatGPT' },
    claude: { url: 'https://claude.ai', title: 'Claude' },
    perplexity: { url: 'https://www.perplexity.ai', title: 'Perplexity' },
    gemini: { url: 'https://gemini.google.com/app', title: 'Google Gemini' }
  };

  const sharedSession = session.defaultSession;

  for (const [key, cfg] of Object.entries(AI_CONFIGS)) {
    try {
      const view = new WebContentsView({
        webPreferences: {
          session: sharedSession,
          contextIsolation: true,
          nodeIntegration: false
        }
      });

      view.webContents.setUserAgent(REAL_CHROME_UA);
      view.webContents.loadURL(cfg.url);

      view.webContents.setWindowOpenHandler(({ url }) => {
        return {
          action: 'allow',
          overrideBrowserWindowOptions: {
            width: 540,
            height: 720,
            autoHideMenuBar: true,
            webPreferences: { session: sharedSession }
          }
        };
      });

      aiViews[key] = view;
    } catch (err) {
      console.error(`[WebContentsView] Failed to initialize view for ${key}:`, err);
    }
  }
}

// 6. IPC Handlers: Layout Bounds, Relay Status, Broadcast, Chat Capture & Conferencing

// Layout Positioning Synchronization
ipcMain.on('view:sync-bounds', (event, { layout, slots }) => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (!mainWindow.contentView) return;

  activeSplitLayout = layout;
  if (slots && Array.isArray(slots)) {
    activeKeys = slots.map(s => s.engineKey);
  }

  for (const key of Object.keys(aiViews)) {
    try { mainWindow.contentView.removeChildView(aiViews[key]); } catch (e) {}
  }

  if (layout === 'hidden' || !slots || slots.length === 0) return;

  slots.forEach(slot => {
    const view = aiViews[slot.engineKey];
    if (view && slot.bounds && !slot.useRelay) {
      try {
        mainWindow.contentView.addChildView(view);
        view.setBounds({
          x: Math.round(slot.bounds.x),
          y: Math.round(slot.bounds.y),
          width: Math.round(slot.bounds.width),
          height: Math.round(slot.bounds.height)
        });
      } catch (e) {
        console.warn(`[WebContentsView] Error setting bounds for ${slot.engineKey}:`, e);
      }
    }
  });
});

// External Relay Status Check
ipcMain.handle('relay:check-status', async () => {
  const tab = await getExternalBrowserTab('gemini.google.com');
  if (tab) {
    const connected = await connectToExternalTab(tab.webSocketDebuggerUrl);
    return { connected, title: tab.title, url: tab.url };
  }
  return { connected: false };
});

// Feature 1: Broadcast Prompting
ipcMain.handle('ai:broadcast-prompt', async (event, promptText) => {
  const results = [];

  // Ingest into active embedded views
  for (const key of activeKeys) {
    const view = aiViews[key];
    if (view && view.webContents) {
      const injectionScript = `
        (() => {
          try {
            const text = ${JSON.stringify(promptText)};
            const target = document.querySelector('rich-textarea div[contenteditable="true"]')
                        || document.querySelector('#prompt-textarea')
                        || document.querySelector('div[contenteditable="true"]')
                        || document.querySelector('textarea');
            if (target) {
              target.focus();
              if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') {
                target.value = text;
                target.dispatchEvent(new Event('input', { bubbles: true }));
                target.dispatchEvent(new Event('change', { bubbles: true }));
              } else {
                document.execCommand('selectAll', false, null);
                document.execCommand('insertText', false, text);
                target.dispatchEvent(new Event('input', { bubbles: true }));
              }
              setTimeout(() => {
                const sendBtn = document.querySelector('button[aria-label*="Send"]')
                             || document.querySelector('button[data-testid="send-button"]')
                             || document.querySelector('button.send-button')
                             || document.querySelector('fieldset button');
                if (sendBtn && !sendBtn.disabled) {
                  sendBtn.click();
                } else {
                  target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, keyCode: 13 }));
                }
              }, 300);
              return { success: true };
            }
            return { success: false, reason: 'Input element not found' };
          } catch (err) {
            return { success: false, error: err.message };
          }
        })();
      `;
      const res = await view.webContents.executeJavaScript(injectionScript).catch(e => ({ error: e.message }));
      results.push({ engine: key, result: res });
    }
  }

  // Ingest into external Chrome relay tab if active
  if (cdpWs && cdpWs.readyState === WebSocket.OPEN) {
    const externalScript = `
      (() => {
        try {
          const text = ${JSON.stringify(promptText)};
          const target = document.querySelector('rich-textarea div[contenteditable="true"]')
                      || document.querySelector('#prompt-textarea')
                      || document.querySelector('textarea');
          if (target) {
            target.focus();
            document.execCommand('insertText', false, text);
            setTimeout(() => {
              const sendBtn = document.querySelector('button[aria-label*="Send"]')
                           || document.querySelector('button[data-testid="send-button"]')
                           || document.querySelector('button.send-button');
              if (sendBtn && !sendBtn.disabled) sendBtn.click();
            }, 300);
            return { success: true };
          }
          return { success: false, reason: 'Relay input not found' };
        } catch (e) {
          return { success: false, error: e.message };
        }
      })();
    `;
    const cdpRes = await executeInExternalTab(externalScript).catch(e => ({ error: e.message }));
    results.push({ engine: 'gemini-relay', result: cdpRes });
  }

  return results;
});

// Feature 2: Local Chat Capture
ipcMain.handle('ai:capture-chat', async (event, targetEngine) => {
  const enginesToCapture = targetEngine === 'all' ? activeKeys : [targetEngine];
  const captured = [];

  for (const key of enginesToCapture) {
    const view = aiViews[key];
    if (view && view.webContents) {
      const scrapeScript = `
        (() => {
          try {
            let userText = "";
            let assistantText = "";
            const userTurns = document.querySelectorAll('[data-message-author-role="user"], .user-query, [data-testid*="user"]');
            if (userTurns.length > 0) userText = userTurns[userTurns.length - 1].innerText;

            const modelTurns = document.querySelectorAll('[data-message-author-role="assistant"], .model-response-text, .font-claude-message, [data-testid*="assistant"]');
            if (modelTurns.length > 0) assistantText = modelTurns[modelTurns.length - 1].innerText;

            return { userText, assistantText, url: window.location.href };
          } catch (e) {
            return { error: e.message };
          }
        })();
      `;
      const data = await view.webContents.executeJavaScript(scrapeScript).catch(() => ({}));
      captured.push({
        engine: key,
        timestamp: new Date().toISOString(),
        prompt: data.userText || "Manual capture",
        response: data.assistantText || "No response text captured",
        url: data.url
      });
    }
  }

  // External tab capture
  if ((targetEngine === 'all' || targetEngine === 'gemini') && cdpWs && cdpWs.readyState === WebSocket.OPEN) {
    const extScript = `
      (() => {
        try {
          const userTurns = document.querySelectorAll('.user-query, [data-message-author-role="user"]');
          const modelTurns = document.querySelectorAll('.model-response-text, [data-message-author-role="assistant"]');
          return {
            userText: userTurns.length ? userTurns[userTurns.length - 1].innerText : '',
            assistantText: modelTurns.length ? modelTurns[modelTurns.length - 1].innerText : ''
          };
        } catch (e) {
          return { error: e.message };
        }
      })();
    `;
    const extData = await executeInExternalTab(extScript).catch(() => ({}));
    if (extData && extData.assistantText) {
      captured.push({
        engine: 'gemini',
        timestamp: new Date().toISOString(),
        prompt: extData.userText || "Manual capture (Relay)",
        response: extData.assistantText,
        source: 'External Chrome Relay'
      });
    }
  }

  return captured;
});

// Feature 3: AI-to-AI Conference Step Execution
ipcMain.handle('ai:conference-step', async (event, { sourceEngine, targetEngine, promptTemplate }) => {
  return { status: 'step_dispatched', sourceEngine, targetEngine };
});

// Native File System Handlers
ipcMain.handle('dialog:select-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('fs:read-file', async (event, filePath) => {
  return fs.promises.readFile(filePath, 'utf-8');
});

ipcMain.handle('fs:write-file', async (event, filePath, content) => {
  await fs.promises.writeFile(filePath, content, 'utf-8');
  return true;
});

ipcMain.handle('fs:save-binary', async (event, filePath, buffer) => {
  let buf;
  if (Buffer.isBuffer(buffer)) buf = buffer;
  else if (buffer instanceof ArrayBuffer) buf = Buffer.from(buffer);
  else if (ArrayBuffer.isView(buffer)) buf = Buffer.from(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  else buf = Buffer.from(buffer, 'base64');
  await fs.promises.writeFile(filePath, buf);
  return true;
});

ipcMain.handle('app:get-version', () => app.getVersion());

ipcMain.handle('shell:open-external', async (_event, url) => {
  if (url && (url.startsWith('https://') || url.startsWith('http://'))) {
    return await shell.openExternal(url);
  }
  return false;
});