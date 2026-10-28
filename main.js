/**
 * =====================================================================
 * SENTINEL STUDIO™ — ELECTRON STANDALONE DESKTOP WORKSTATION
 * Enterprise Capability Hub & Native Multi-AI WebContentsView OS
 * Architect & Developer: Patrick Jay F. Tanap, CPA, CICA
 * Main Process, Native Chromium WebContentsView & Partition Manager
 * =====================================================================
 */

const { app, BrowserWindow, WebContentsView, ipcMain, dialog, session, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');

// 1. Global Chrome Spoofing, Session Partitioning & WebGPU Acceleration
app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled');
app.commandLine.appendSwitch('disable-features', 'WebAuthentication,WebAuthenticationConditionalUI');
app.commandLine.appendSwitch('force-color-profile', 'srgb');
app.commandLine.appendSwitch('enable-unsafe-webgpu');
app.commandLine.appendSwitch('enable-features', 'Vulkan,WebGPU');
app.commandLine.appendSwitch('ignore-gpu-blocklist');

const SHARED_PARTITION = 'persist:sentinel_ai_workspace';
const REAL_CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36';
app.userAgentFallback = REAL_CHROME_UA;

// 2. WebContentsView Registry & Layout Configuration
const AI_CONFIGS = {
  copilot: { url: 'https://copilot.microsoft.com', title: 'MS Copilot' },
  chatgpt: { url: 'https://chatgpt.com', title: 'ChatGPT' },
  gemini: { url: 'https://gemini.google.com/app', title: 'Google Gemini' },
  claude: { url: 'https://claude.ai', title: 'Claude' },
  perplexity: { url: 'https://www.perplexity.ai', title: 'Perplexity' },
  custom: { url: 'https://chat.deepseek.com/', title: 'Custom AI Browser' }
};

const aiViews = {};
let activeLayout = '3-split'; // 'single', 'dual', '3-split', '4-split', '5-split', 'all', 'hidden'
let activeKeys = ['copilot', 'chatgpt', 'gemini'];
let mainWindowInstance = null;
let sessionRelayServer = null;

/**
 * Configure Chromium Headers for Persistent AI Session
 * Eliminates 403 disallowed_useragent and enables clean iframe/popup behaviors
 */
function configurePartitionHeaders(targetSession) {
  if (!targetSession) return;

  targetSession.setUserAgent(REAL_CHROME_UA);

  const filter = { urls: ['*://*/*'] };

  targetSession.webRequest.onBeforeSendHeaders(filter, (details, callback) => {
    const requestHeaders = { ...details.requestHeaders };
    requestHeaders['User-Agent'] = REAL_CHROME_UA;
    requestHeaders['Sec-CH-UA'] = '"Not(A:Brand";v="99", "Google Chrome";v="133", "Chromium";v="133"';
    requestHeaders['Sec-CH-UA-Mobile'] = '?0';
    requestHeaders['Sec-CH-UA-Platform'] = '"Windows"';
    callback({ cancel: false, requestHeaders });
  });

  targetSession.webRequest.onHeadersReceived(filter, (details, callback) => {
    const responseHeaders = { ...details.responseHeaders };
    delete responseHeaders['x-frame-options'];
    delete responseHeaders['X-Frame-Options'];

    Object.keys(responseHeaders).forEach((key) => {
      if (key.toLowerCase() === 'content-security-policy') {
        const headerValues = responseHeaders[key] || [];
        responseHeaders[key] = headerValues.map((csp) => {
          return csp
            .replace(/frame-ancestors\s+[^;]+(;|$)/gi, '')
            .replace(/frame-src\s+[^;]+(;|$)/gi, "frame-src * https: data: blob: 'unsafe-inline'; ");
        });
      }
    });

    callback({ cancel: false, responseHeaders });
  });
}

/**
 * Instantiate Native WebContentsView for each AI engine
 */
function initAiViews(mainWindow) {
  if (!WebContentsView) {
    console.warn('[WebContentsView] Not supported in current Electron version, falling back.');
    return;
  }

  const ses = session.fromPartition(SHARED_PARTITION);
  configurePartitionHeaders(ses);

  for (const [key, cfg] of Object.entries(AI_CONFIGS)) {
    try {
      if (aiViews[key]) {
        try {
          if (mainWindow.contentView && mainWindow.contentView.removeChildView) {
            mainWindow.contentView.removeChildView(aiViews[key]);
          }
        } catch (_) {}
      }

      const view = new WebContentsView({
        webPreferences: {
          partition: SHARED_PARTITION,
          contextIsolation: true,
          nodeIntegration: false,
          spellcheck: true
        }
      });

      view.webContents.setUserAgent(REAL_CHROME_UA);
      view.webContents.loadURL(cfg.url);

      // Keep OAuth and SSO popups inside the same shared partition
      view.webContents.setWindowOpenHandler(({ url }) => {
        return {
          action: 'allow',
          overrideBrowserWindowOptions: {
            width: 520,
            height: 700,
            title: `Sign In — ${cfg.title}`,
            autoHideMenuBar: true,
            webPreferences: {
              partition: SHARED_PARTITION,
              contextIsolation: true,
              nodeIntegration: false
            }
          }
        };
      });

      // Handle in-view title / status updates
      view.webContents.on('did-finish-load', () => {
        console.info(`[WebContentsView] Loaded ${key} (${cfg.url})`);
      });

      aiViews[key] = view;
    } catch (err) {
      console.error(`[WebContentsView] Failed to initialize view for ${key}:`, err);
    }
  }
}

/**
 * Temporary Local Session Relay Server on 127.0.0.1:49152
 */
function startSessionRelayServer(targetMainWindow) {
  if (sessionRelayServer) {
    try {
      sessionRelayServer.close();
    } catch (_) {}
    sessionRelayServer = null;
  }

  try {
    sessionRelayServer = http.createServer((req, res) => {
      try {
        const parsedUrl = new URL(req.url, 'http://127.0.0.1:49152');

        if (parsedUrl.pathname === '/callback' || parsedUrl.pathname === '/auth/callback') {
          const engine = parsedUrl.searchParams.get('engine') || 'gemini';

          const win = targetMainWindow || mainWindowInstance;
          if (win && !win.isDestroyed()) {
            win.webContents.send('auth:login-success', { engine });
          }

          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Session Connected — Sentinel Studio</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #06234D;
      color: #E2E8F0;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 24px;
    }
    .card {
      background: #0B254E;
      border: 1px solid #00C4E7;
      border-radius: 20px;
      padding: 36px;
      max-width: 440px;
      text-align: center;
      box-shadow: 0 20px 40px rgba(0,0,0,0.4);
    }
    .icon {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: rgba(16, 185, 129, 0.2);
      border: 2px solid #10B981;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 16px;
      color: #34D399;
      font-size: 26px;
      font-weight: bold;
    }
    h2 { font-size: 20px; margin-bottom: 8px; color: #FFFFFF; }
    p { font-size: 13px; line-height: 1.6; color: #94A3B8; margin-bottom: 20px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✓</div>
    <h2>Authentication Relayed</h2>
    <p>Your session has been communicated to <strong>Sentinel Studio</strong>. You can close this tab and return to the workstation.</p>
  </div>
  <script>
    setTimeout(() => {
      try { window.close(); } catch(e) {}
    }, 2000);
  </script>
</body>
</html>`);

          setTimeout(() => {
            if (sessionRelayServer) {
              try { sessionRelayServer.close(); } catch (_) {}
              sessionRelayServer = null;
            }
          }, 3000);
          return;
        }

        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Relay Server Error');
      }
    });

    sessionRelayServer.listen(49152, '127.0.0.1', () => {
      console.info('[Session Relay] Listening on http://127.0.0.1:49152/callback');
    });

    sessionRelayServer.on('error', (err) => {
      console.warn('[Session Relay Server Error]:', err.message);
    });
  } catch (err) {
    console.warn('[Session Relay Init Exception]:', err);
  }
}

/**
 * Top-Level BrowserWindow Direct Sign-In (NOT a webview)
 */
function openDirectLoginWindow(targetMainWindow, engine = 'gemini') {
  let targetUrl = 'https://accounts.google.com/ServiceLogin?continue=https://gemini.google.com/app';
  if (engine === 'chatgpt') {
    targetUrl = 'https://chatgpt.com/auth/login';
  } else if (engine === 'claude') {
    targetUrl = 'https://claude.ai/login';
  } else if (engine === 'perplexity') {
    targetUrl = 'https://www.perplexity.ai';
  } else if (engine === 'copilot') {
    targetUrl = 'https://copilot.microsoft.com';
  }

  const authWin = new BrowserWindow({
    width: 520,
    height: 700,
    title: 'Sign In — Sentinel Studio Workspace',
    autoHideMenuBar: true,
    webPreferences: {
      partition: SHARED_PARTITION,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  authWin.webContents.setUserAgent(REAL_CHROME_UA);
  authWin.loadURL(targetUrl);

  const checkFinish = (url) => {
    const isLoginComplete =
      url.includes('gemini.google.com/app') ||
      url.includes('myaccount.google.com') ||
      (url.includes('chatgpt.com') && !url.includes('/auth/')) ||
      (url.includes('claude.ai') && !url.includes('/login')) ||
      (url.includes('perplexity.ai') && !url.includes('/login')) ||
      (url.includes('copilot.microsoft.com') && !url.includes('login'));

    if (isLoginComplete) {
      setTimeout(() => {
        if (!authWin.isDestroyed()) {
          authWin.close();
        }
        const win = targetMainWindow || mainWindowInstance;
        if (win && !win.isDestroyed()) {
          win.webContents.send('auth:login-success', { engine });
        }
        // Also reload the native WebContentsView
        if (aiViews[engine] && aiViews[engine].webContents) {
          aiViews[engine].webContents.reload();
        }
      }, 800);
    }
  };

  authWin.webContents.on('did-navigate', (_e, url) => checkFinish(url));
  authWin.webContents.on('did-navigate-in-page', (_e, url) => checkFinish(url));

  return { success: true };
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1200,
    minHeight: 768,
    backgroundColor: '#06234D',
    title: 'Sentinel Studio — Enterprise Capability Hub & Multi-AI Workstation',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindowInstance = mainWindow;
  mainWindow.setMenuBarVisibility(false);

  // Configure partitions
  configurePartitionHeaders(session.defaultSession);
  const aiWorkspaceSession = session.fromPartition(SHARED_PARTITION);
  configurePartitionHeaders(aiWorkspaceSession);

  // Initialize Native WebContentsViews
  initAiViews(mainWindow);

  // Intercept main window popups: Retain OAuth URLs inside internal top-level window
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    return {
      action: 'allow',
      overrideBrowserWindowOptions: {
        width: 520,
        height: 700,
        title: 'Sign In — Sentinel Studio Workspace',
        autoHideMenuBar: true,
        webPreferences: {
          partition: SHARED_PARTITION,
          contextIsolation: true,
          nodeIntegration: false,
        },
      },
    };
  });

  // Automatically close child auth popups upon completed sign-in
  app.on('browser-window-created', (event, childWindow) => {
    if (childWindow !== mainWindow) {
      childWindow.webContents.on('did-navigate', (e, navigatedUrl) => {
        const isAuthFinished =
          navigatedUrl.includes('gemini.google.com/app') ||
          navigatedUrl.includes('myaccount.google.com') ||
          (navigatedUrl.includes('chatgpt.com') && !navigatedUrl.includes('/auth/')) ||
          (navigatedUrl.includes('claude.ai') && !navigatedUrl.includes('/login')) ||
          (navigatedUrl.includes('perplexity.ai') && !navigatedUrl.includes('/login')) ||
          (navigatedUrl.includes('copilot.microsoft.com') && !navigatedUrl.includes('login'));

        if (isAuthFinished) {
          setTimeout(() => {
            if (!childWindow.isDestroyed()) {
              childWindow.close();
            }
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('auth:login-success', { engine: 'all' });
            }
            // Reload all native views
            for (const view of Object.values(aiViews)) {
              try { view.webContents.reload(); } catch (_) {}
            }
          }, 800);
        }
      });
    }
  });

  // Robust HTML loading with fallback to root index.html
  const distHtmlPath = path.join(__dirname, 'dist', 'index.html');
  const rootHtmlPath = path.join(__dirname, 'index.html');

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error(`[Electron] Window failed to load (${errorCode}): ${errorDescription} at ${validatedURL}`);
    if (fs.existsSync(rootHtmlPath) && !validatedURL.endsWith('index.html')) {
      mainWindow.loadFile(rootHtmlPath).catch(() => {});
    }
  });

  if (fs.existsSync(distHtmlPath)) {
    mainWindow.loadFile(distHtmlPath).catch((err) => {
      console.error('Failed to load dist/index.html:', err);
      if (fs.existsSync(rootHtmlPath)) {
        mainWindow.loadFile(rootHtmlPath).catch((e) => console.error('Fallback load error:', e));
      }
    });
  } else if (fs.existsSync(rootHtmlPath)) {
    mainWindow.loadFile(rootHtmlPath).catch((err) => {
      console.error('Failed to load root index.html:', err);
    });
  }

  return mainWindow;
}

function setupIpcHandlers() {
  // 1. Dynamic Split-Screen Bounds Layout Engine (`view:sync-bounds`)
  ipcMain.on('view:sync-bounds', (event, payload) => {
    if (!mainWindowInstance || mainWindowInstance.isDestroyed()) return;
    if (!mainWindowInstance.contentView) return;

    const layout = payload?.layout || activeLayout;
    const slots = payload?.slots || [];
    activeLayout = layout;
    activeKeys = slots.map((s) => s.engineKey);

    // Remove all views first from contentView
    for (const key of Object.keys(aiViews)) {
      try {
        mainWindowInstance.contentView.removeChildView(aiViews[key]);
      } catch (_) {}
    }

    // If layout is hidden or no active slots, keep them unmounted so other UI is unobstructed
    if (layout === 'hidden' || slots.length === 0) {
      return;
    }

    // Add and position only the views matching the active layout
    slots.forEach((slot) => {
      const view = aiViews[slot.engineKey];
      if (view && slot.bounds) {
        const { x, y, width, height } = slot.bounds;
        if (width > 0 && height > 0) {
          try {
            mainWindowInstance.contentView.addChildView(view);
            view.setBounds({
              x: Math.round(x),
              y: Math.round(y),
              width: Math.round(width),
              height: Math.round(height),
            });
          } catch (err) {
            console.warn(`[WebContentsView] Error positioning view for ${slot.engineKey}:`, err);
          }
        }
      }
    });
  });

  // 2. Feature 1: Multi-Broadcast Prompt Execution (`ai:broadcast-prompt`)
  ipcMain.handle('ai:broadcast-prompt', async (event, promptText) => {
    const results = [];
    const targets = activeKeys.length > 0 ? activeKeys : ['copilot', 'chatgpt', 'gemini'];

    for (const key of targets) {
      const view = aiViews[key];
      if (view && view.webContents) {
        const injectionScript = `
          (() => {
            try {
              const text = ${JSON.stringify(promptText)};
              const target = document.querySelector('rich-textarea div[contenteditable="true"]') // Gemini
                          || document.querySelector('#prompt-textarea')                         // ChatGPT
                          || document.querySelector('div[contenteditable="true"]')               // Claude
                          || document.querySelector('textarea#userInput')                        // Copilot
                          || document.querySelector('textarea[placeholder*="Ask"]')              // Perplexity
                          || document.querySelector('textarea');                                 // Fallback
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
                               || document.querySelector('button[aria-label*="Submit"]')
                               || document.querySelector('button.bg-super')
                               || document.querySelector('fieldset button');
                  if (sendBtn && !sendBtn.disabled) {
                    sendBtn.click();
                  } else {
                    target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, keyCode: 13, which: 13 }));
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
        const res = await view.webContents.executeJavaScript(injectionScript).catch((e) => ({ error: e.message }));
        results.push({ engine: key, result: res });
      }
    }
    return results;
  });

  // 3. Feature 2: Local Chat Capture (`ai:capture-chat`)
  ipcMain.handle('ai:capture-chat', async (event, targetEngine) => {
    const enginesToCapture = targetEngine === 'all'
      ? (activeKeys.length > 0 ? activeKeys : ['copilot', 'chatgpt', 'gemini', 'claude', 'perplexity'])
      : [targetEngine];
    const captured = [];

    for (const key of enginesToCapture) {
      const view = aiViews[key];
      if (view && view.webContents) {
        const scrapeScript = `
          (() => {
            try {
              let userText = "";
              let assistantText = "";
              
              // Universal fallback scraping
              const userTurns = document.querySelectorAll('[data-message-author-role="user"], .user-query, [data-testid*="user"], query-text, .user-message');
              if (userTurns.length > 0) userText = userTurns[userTurns.length - 1].innerText;

              const modelTurns = document.querySelectorAll('[data-message-author-role="assistant"], .model-response-text, .font-claude-message, [data-testid*="assistant"], message-content, .response-text');
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
          prompt: data?.userText || "Manual sync capture",
          response: data?.assistantText || "No response text captured",
          url: data?.url || AI_CONFIGS[key]?.url
        });
      }
    }
    return captured;
  });

  // 4. Feature 3: AI-to-AI Conference Step Execution (`ai:conference-step`)
  ipcMain.handle('ai:conference-step', async (event, { sourceEngine, targetEngine, promptTemplate, customTopic }) => {
    try {
      let sourceText = '';
      const srcView = aiViews[sourceEngine];
      if (srcView && srcView.webContents) {
        const scrapeScript = `
          (() => {
            const modelTurns = document.querySelectorAll('[data-message-author-role="assistant"], .model-response-text, .font-claude-message, [data-testid*="assistant"], message-content');
            return modelTurns.length > 0 ? modelTurns[modelTurns.length - 1].innerText : "";
          })();
        `;
        sourceText = await srcView.webContents.executeJavaScript(scrapeScript).catch(() => '');
      }

      if (!sourceText && customTopic) {
        sourceText = customTopic;
      }

      const speakerName = AI_CONFIGS[sourceEngine]?.title || sourceEngine;
      const targetName = AI_CONFIGS[targetEngine]?.title || targetEngine;
      const formattedPrompt = promptTemplate
        ? promptTemplate.replace('{sourceText}', sourceText).replace('{speaker}', speakerName)
        : `[Cross-AI Conference with ${speakerName}]:\n\n"${sourceText}"\n\nPlease evaluate, critique, or expand upon this perspective from your domain model.`;

      const tgtView = aiViews[targetEngine];
      let dispatched = false;
      if (tgtView && tgtView.webContents) {
        const injectionScript = `
          (() => {
            const text = ${JSON.stringify(formattedPrompt)};
            const target = document.querySelector('rich-textarea div[contenteditable="true"]')
                        || document.querySelector('#prompt-textarea')
                        || document.querySelector('div[contenteditable="true"]')
                        || document.querySelector('textarea#userInput')
                        || document.querySelector('textarea');
            if (target) {
              target.focus();
              if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') {
                target.value = text;
                target.dispatchEvent(new Event('input', { bubbles: true }));
              } else {
                document.execCommand('selectAll', false, null);
                document.execCommand('insertText', false, text);
                target.dispatchEvent(new Event('input', { bubbles: true }));
              }
              setTimeout(() => {
                const sendBtn = document.querySelector('button[aria-label*="Send"]')
                             || document.querySelector('button[data-testid="send-button"]')
                             || document.querySelector('button.send-button')
                             || document.querySelector('button[aria-label*="Submit"]')
                             || document.querySelector('fieldset button');
                if (sendBtn && !sendBtn.disabled) sendBtn.click();
              }, 300);
              return true;
            }
            return false;
          })();
        `;
        dispatched = await tgtView.webContents.executeJavaScript(injectionScript).catch(() => false);
      }

      return {
        status: 'step_dispatched',
        sourceEngine,
        targetEngine,
        sourceName: speakerName,
        targetName: targetName,
        sourceText: sourceText || '(No output yet captured)',
        formattedPrompt,
        dispatched,
      };
    } catch (err) {
      return { status: 'error', error: err.message };
    }
  });

  // View Navigation & Reload Controls
  ipcMain.handle('view:reload', async (_event, engineKey) => {
    const view = aiViews[engineKey];
    if (view && view.webContents) {
      view.webContents.reload();
      return { success: true };
    }
    return { success: false };
  });

  ipcMain.handle('view:navigate', async (_event, { engineKey, url }) => {
    const view = aiViews[engineKey];
    if (view && view.webContents && url) {
      view.webContents.loadURL(url);
      return { success: true };
    }
    return { success: false };
  });

  // Directory & File Management
  ipcMain.handle('dialog:select-directory', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      title: 'Select Sentinel Workspace Mirror Directory',
    });
    if (result.canceled || !result.filePaths || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('fs:read-file', async (_event, filePath) => {
    return await fs.promises.readFile(filePath, 'utf-8');
  });

  ipcMain.handle('fs:write-file', async (_event, filePath, content) => {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(filePath, content, 'utf-8');
    return { success: true, filePath };
  });

  ipcMain.handle('fs:save-binary', async (_event, filePath, data) => {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) await fs.promises.mkdir(dir, { recursive: true });
    let buffer;
    if (Buffer.isBuffer(data)) buffer = data;
    else if (data instanceof ArrayBuffer) buffer = Buffer.from(data);
    else if (ArrayBuffer.isView(data)) buffer = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
    else if (typeof data === 'string' && data.startsWith('data:')) {
      buffer = Buffer.from(data.split(',')[1], 'base64');
    } else {
      buffer = Buffer.from(data, 'base64');
    }
    await fs.promises.writeFile(filePath, buffer);
    return { success: true, filePath };
  });

  ipcMain.handle('app:get-version', () => app.getVersion());

  // External Browser Opener — Suppress internal Auth & AI Domains
  ipcMain.handle('shell:open-external', async (_event, url) => {
    if (url && (url.startsWith('https://') || url.startsWith('http://'))) {
      const isAuthOrAiDomain =
        url.includes('google.com') ||
        url.includes('accounts.google.com') ||
        url.includes('chatgpt.com') ||
        url.includes('openai.com') ||
        url.includes('anthropic.com') ||
        url.includes('claude.ai') ||
        url.includes('perplexity.ai') ||
        url.includes('microsoft.com');

      if (isAuthOrAiDomain) {
        console.info('[Security Guard] Suppressed external browser launch for Auth/AI domain:', url);
        return false;
      }
      return await shell.openExternal(url);
    }
    return false;
  });

  // Multi-AI Dedicated Companion Window
  ipcMain.handle('multi-ai:open-companion', async (_event, url, partitionName) => {
    const targetPartition = partitionName || SHARED_PARTITION;
    const targetSession = session.fromPartition(targetPartition);
    configurePartitionHeaders(targetSession);

    const companionWindow = new BrowserWindow({
      width: 1050,
      height: 850,
      title: 'Sentinel Multi-AI Companion Window',
      webPreferences: {
        partition: targetPartition,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    companionWindow.setMenuBarVisibility(false);
    companionWindow.webContents.setUserAgent(REAL_CHROME_UA);
    companionWindow.loadURL(url);
    return { success: true };
  });

  ipcMain.handle('multi-ai:clear-partition', async (_event, partitionName) => {
    const target = partitionName || SHARED_PARTITION;
    try {
      const targetSession = session.fromPartition(target);
      await targetSession.clearStorageData();
      return { success: true };
    } catch (e) {
      return { success: false, error: e?.message };
    }
  });

  // Direct In-App Login Window Trigger (Top-Level Window, NOT webview)
  ipcMain.handle('auth:start-direct-login', async (_event, options) => {
    const engine = typeof options === 'string' ? options : (options?.engine || 'gemini');
    return openDirectLoginWindow(mainWindowInstance, engine);
  });

  // External Browser Session Relay Trigger
  ipcMain.handle('auth:open-external-login', async () => {
    startSessionRelayServer(mainWindowInstance);
    await shell.openExternal('https://accounts.google.com/ServiceLogin?continue=https://gemini.google.com/app');
    return { success: true, relayUrl: 'http://127.0.0.1:49152/callback' };
  });

  // Legacy Compatibility Mappings
  ipcMain.handle('auth:google-login', async (_event, options) => {
    const engine = typeof options === 'string' ? options : (options?.engine || 'gemini');
    return openDirectLoginWindow(mainWindowInstance, engine);
  });

  ipcMain.handle('auth:start-google-login', async (_event, options) => {
    const engine = typeof options === 'string' ? options : (options?.engine || 'gemini');
    return openDirectLoginWindow(mainWindowInstance, engine);
  });

  ipcMain.handle('auth:google-cancel', async () => {
    if (sessionRelayServer) {
      try { sessionRelayServer.close(); } catch (_) {}
      sessionRelayServer = null;
    }
    return { success: true };
  });

  ipcMain.handle('auth:get-session', async () => {
    return {
      authenticated: true,
      authMethod: 'Direct Window / WebContentsView Session',
      partition: SHARED_PARTITION,
      user: {
        name: 'Patrick Jay F. Tanap, CPA, CICA',
        email: 'patrick.tanap@filinvest.com',
      },
    };
  });

  ipcMain.handle('auth:google-logout', async () => {
    try {
      const authSession = session.fromPartition(SHARED_PARTITION);
      await authSession.clearStorageData({ storages: ['cookies', 'localstorage'] });
    } catch (_e) {}
    return { success: true };
  });
}

app.whenReady().then(() => {
  setupIpcHandlers();
  createWindow();

  app.on('session-created', (newSession) => {
    configurePartitionHeaders(newSession);
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (sessionRelayServer) {
    try { sessionRelayServer.close(); } catch (_) {}
    sessionRelayServer = null;
  }
  if (process.platform !== 'darwin') app.quit();
});