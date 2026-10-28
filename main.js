/**
 * =====================================================================
 * SENTINEL STUDIO™ — ELECTRON STANDALONE DESKTOP WORKSTATION
 * Enterprise Capability Hub & Native Multi-AI WebContentsView OS
 * Architect & Developer: Patrick Jay F. Tanap, CPA, CICA
 * Restore Header Sign-In IPC Handlers & Universal Auth Propagation Engine
 * =====================================================================
 */

const { app, BrowserWindow, WebContentsView, session, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');

const WORKSPACE_PARTITION = 'persist:sentinel_ai_workspace';
const REAL_CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36';

// 1. Locate custom user profile directory to avoid profile lock collisions
const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
const sentinelProfilePath = path.join(localAppData, 'SentinelStudio', 'ChromeSharedProfile');

try {
  if (!fs.existsSync(sentinelProfilePath)) {
    fs.mkdirSync(sentinelProfilePath, { recursive: true });
  }
  app.setPath('userData', sentinelProfilePath);
} catch (err) {
  console.error('[Profile] Failed to set custom profile path:', err);
}

// 2. Global Chrome Spoofing, Session Partitioning & WebGPU Acceleration
app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled');
app.commandLine.appendSwitch('disable-features', 'WebAuthentication,WebAuthenticationConditionalUI');
app.commandLine.appendSwitch('force-color-profile', 'srgb');
app.commandLine.appendSwitch('enable-unsafe-webgpu');
app.commandLine.appendSwitch('enable-features', 'Vulkan,WebGPU');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.userAgentFallback = REAL_CHROME_UA;

let mainWindow = null;
let authWindow = null;
const aiViews = {};
let activeKeys = ['copilot', 'chatgpt', 'gemini'];
let activeLayout = '3-split';

const AI_CONFIGS = {
  copilot: { url: 'https://copilot.microsoft.com', title: 'MS Copilot' },
  chatgpt: { url: 'https://chatgpt.com', title: 'ChatGPT' },
  gemini: { url: 'https://gemini.google.com/app', title: 'Google Gemini' },
  claude: { url: 'https://claude.ai', title: 'Claude' },
  perplexity: { url: 'https://www.perplexity.ai', title: 'Perplexity' },
  custom: { url: 'https://chat.deepseek.com/', title: 'Custom AI Browser' }
};

// 3. Universal Cookie Synchronization Routine
async function syncAllAuthCookies(sourceSession, targetSession) {
  try {
    const cookies = await sourceSession.cookies.get({});
    console.log(`[Auth Sync] Ingesting ${cookies.length} cookies into workspace partition...`);

    for (const c of cookies) {
      const isDomainScoped = c.domain.startsWith('.');
      const cleanDomain = isDomainScoped ? c.domain.slice(1) : c.domain;
      const scheme = c.secure ? 'https://' : 'http://';
      const cookieUrl = `${scheme}${cleanDomain}${c.path || '/'}`;

      let sameSite = 'unspecified';
      if (c.sameSite === 'strict' || c.sameSite === 'lax' || c.sameSite === 'no_restriction') {
        sameSite = c.sameSite;
      }

      const cookieDetails = {
        url: cookieUrl,
        name: c.name,
        value: c.value,
        domain: c.domain,
        path: c.path || '/',
        secure: c.secure,
        httpOnly: c.httpOnly,
        expirationDate: c.expirationDate,
        sameSite: sameSite
      };

      try {
        await targetSession.cookies.set(cookieDetails);
      } catch (err) {
        delete cookieDetails.domain;
        await targetSession.cookies.set(cookieDetails).catch(() => {});
      }
    }

    await targetSession.cookies.flushStore();
    console.log('[Auth Sync] Cookie store flushed to workspace partition.');
    return true;
  } catch (err) {
    console.error('[Auth Sync Critical Error]:', err);
    return false;
  }
}

// 4. Session Rules & Desktop Headers Configuration
function configureSessionRules(targetSession) {
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
    if (responseHeaders['content-security-policy']) {
      const headerValues = responseHeaders['content-security-policy'];
      responseHeaders['content-security-policy'] = headerValues.map((csp) =>
        csp.replace(/frame-ancestors[^;]+;?/gi, '')
      );
    }
    callback({ cancel: false, responseHeaders });
  });
}

// 5. Application Lifecycle
app.whenReady().then(() => {
  const workspaceSession = session.fromPartition(WORKSPACE_PARTITION);

  configureSessionRules(session.defaultSession);
  configureSessionRules(workspaceSession);

  // Live cookie synchronization listener for real-time authentication events
  session.defaultSession.cookies.on('changed', async (event, cookie, cause, removed) => {
    if (!removed) {
      const isAuthTarget =
        cookie.domain.includes('google.com') ||
        cookie.domain.includes('openai.com') ||
        cookie.domain.includes('chatgpt.com') ||
        cookie.domain.includes('anthropic.com') ||
        cookie.domain.includes('claude.ai') ||
        cookie.domain.includes('perplexity.ai') ||
        cookie.domain.includes('microsoft.com') ||
        cookie.domain.includes('live.com');

      if (isAuthTarget) {
        const cleanDomain = cookie.domain.startsWith('.') ? cookie.domain.slice(1) : cookie.domain;
        const scheme = cookie.secure ? 'https://' : 'http://';
        const cookieUrl = `${scheme}${cleanDomain}${cookie.path || '/'}`;

        try {
          await workspaceSession.cookies.set({
            url: cookieUrl,
            name: cookie.name,
            value: cookie.value,
            domain: cookie.domain,
            path: cookie.path || '/',
            secure: cookie.secure,
            httpOnly: cookie.httpOnly,
            expirationDate: cookie.expirationDate,
            sameSite: cookie.sameSite === 'unspecified' ? undefined : cookie.sameSite
          });
          await workspaceSession.cookies.flushStore();
        } catch (e) {
          // Suppress transient lock warnings
        }
      }
    }
  });

  setupIpcHandlers();
  createMainWindow();

  app.on('session-created', (newSession) => {
    configureSessionRules(newSession);
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
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

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error(`[Electron] Window failed to load (${errorCode}): ${errorDescription} at ${validatedURL}`);
    if (fs.existsSync(rootHtmlPath) && !validatedURL.endsWith('index.html')) {
      mainWindow.loadFile(rootHtmlPath).catch(() => {});
    }
  });

  if (fs.existsSync(distHtmlPath)) {
    mainWindow.loadFile(distHtmlPath).catch(() => {
      if (fs.existsSync(rootHtmlPath)) mainWindow.loadFile(rootHtmlPath).catch(() => {});
    });
  } else if (fs.existsSync(rootHtmlPath)) {
    mainWindow.loadFile(rootHtmlPath).catch(() => {});
  }

  // Handle popups triggered inside main window
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    return {
      action: 'allow',
      overrideBrowserWindowOptions: {
        width: 540,
        height: 720,
        title: 'Sign In — Sentinel Studio Workspace',
        autoHideMenuBar: true,
        webPreferences: {
          session: session.defaultSession,
          contextIsolation: true,
          nodeIntegration: false
        }
      }
    };
  });

  initAiViews();
  return mainWindow;
}

function initAiViews() {
  if (!WebContentsView) {
    console.warn('[WebContentsView] Not supported in current Electron environment.');
    return;
  }

  const workspaceSession = session.fromPartition(WORKSPACE_PARTITION);

  for (const [key, cfg] of Object.entries(AI_CONFIGS)) {
    try {
      const view = new WebContentsView({
        webPreferences: {
          partition: WORKSPACE_PARTITION,
          contextIsolation: true,
          nodeIntegration: false,
          spellcheck: true
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
            title: `Sign In — ${cfg.title}`,
            autoHideMenuBar: true,
            webPreferences: { partition: WORKSPACE_PARTITION }
          }
        };
      });

      aiViews[key] = view;
    } catch (err) {
      console.error(`[WebContentsView] Failed to initialize view for ${key}:`, err);
    }
  }
}

/**
 * Open the dedicated native login window for Header Sign-In actions
 */
function openAuthWindow(loginUrl = 'https://accounts.google.com/ServiceLogin?continue=https://gemini.google.com/app', engine = 'gemini') {
  if (authWindow && !authWindow.isDestroyed()) {
    authWindow.focus();
    if (loginUrl) authWindow.loadURL(loginUrl);
    return { status: 'focused' };
  }

  authWindow = new BrowserWindow({
    width: 540,
    height: 720,
    title: 'Sign In — Sentinel Studio Workspace',
    autoHideMenuBar: true,
    parent: mainWindow || undefined,
    webPreferences: {
      session: session.defaultSession,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  authWindow.webContents.setUserAgent(REAL_CHROME_UA);
  authWindow.loadURL(loginUrl);

  authWindow.on('closed', async () => {
    authWindow = null;
    console.log('[Auth Window Closed] Syncing sessions to workspace partition...');
    const workspaceSession = session.fromPartition(WORKSPACE_PARTITION);
    await syncAllAuthCookies(session.defaultSession, workspaceSession);

    // Reload all AI views with newly populated cookies
    for (const [key, view] of Object.entries(aiViews)) {
      if (view && view.webContents) {
        try { view.webContents.reload(); } catch (_) {}
      }
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('auth:session-updated');
      mainWindow.webContents.send('auth:login-success', { engine: engine || 'all' });
    }
  });

  return { status: 'opened' };
}

// 6. Complete IPC Handlers Engine
function setupIpcHandlers() {
  // EXPLICIT LISTENERS FOR HEADER SIGN-IN ACTIONS
  ipcMain.handle('auth:start-direct-login', (event, options) => {
    let targetUrl = 'https://accounts.google.com/ServiceLogin?continue=https://gemini.google.com/app';
    const engine = typeof options === 'string' ? options : (options?.engine || 'gemini');
    if (engine === 'chatgpt') targetUrl = 'https://chatgpt.com/auth/login';
    else if (engine === 'claude') targetUrl = 'https://claude.ai/login';
    else if (engine === 'perplexity') targetUrl = 'https://www.perplexity.ai';
    else if (engine === 'copilot') targetUrl = 'https://copilot.microsoft.com';

    return openAuthWindow(targetUrl, engine);
  });

  ipcMain.handle('auth:start-google-login', (event, options) => {
    return openAuthWindow('https://accounts.google.com/ServiceLogin?continue=https://gemini.google.com/app', 'gemini');
  });

  ipcMain.handle('auth:start-google-relay', (event, options) => {
    return openAuthWindow('https://accounts.google.com/ServiceLogin?continue=https://gemini.google.com/app', 'gemini');
  });

  ipcMain.handle('auth:sync-now', async () => {
    const workspaceSession = session.fromPartition(WORKSPACE_PARTITION);
    const success = await syncAllAuthCookies(session.defaultSession, workspaceSession);
    if (success) {
      for (const [key, view] of Object.entries(aiViews)) {
        if (view && view.webContents) {
          try { view.webContents.reload(); } catch (_) {}
        }
      }
    }
    return { success };
  });

  // Dynamic Bounds Layout Engine (`view:sync-bounds`)
  ipcMain.on('view:sync-bounds', (event, { layout, slots }) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (!mainWindow.contentView) return;

    if (layout) activeLayout = layout;
    if (slots && Array.isArray(slots)) {
      activeKeys = slots.map((s) => s.engineKey);
    }

    // Remove all views first
    for (const key of Object.keys(aiViews)) {
      try {
        mainWindow.contentView.removeChildView(aiViews[key]);
      } catch (_) {}
    }

    if (layout === 'hidden' || !slots || slots.length === 0) return;

    slots.forEach((slot) => {
      const view = aiViews[slot.engineKey];
      if (view && slot.bounds) {
        const { x, y, width, height } = slot.bounds;
        if (width > 0 && height > 0) {
          try {
            mainWindow.contentView.addChildView(view);
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

  // Feature 1: Broadcast Prompt (`ai:broadcast-prompt`)
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
              const target = document.querySelector('rich-textarea div[contenteditable="true"]')
                          || document.querySelector('#prompt-textarea')
                          || document.querySelector('div[contenteditable="true"]')
                          || document.querySelector('textarea#userInput')
                          || document.querySelector('textarea[placeholder*="Ask"]')
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
                               || document.querySelector('button[aria-label*="Submit"]')
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

  // Feature 2: Local Chat Capture (`ai:capture-chat`)
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

  // Feature 3: AI-to-AI Conference Step Execution (`ai:conference-step`)
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

  // External Browser Opener
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

  // Multi-AI Companion Window
  ipcMain.handle('multi-ai:open-companion', async (_event, url, partitionName) => {
    const targetPartition = partitionName || WORKSPACE_PARTITION;
    const targetSession = session.fromPartition(targetPartition);
    configureSessionRules(targetSession);

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
    const target = partitionName || WORKSPACE_PARTITION;
    try {
      const targetSession = session.fromPartition(target);
      await targetSession.clearStorageData();
      return { success: true };
    } catch (e) {
      return { success: false, error: e?.message };
    }
  });

  // Auth Session state helpers
  ipcMain.handle('auth:get-session', async () => {
    return {
      authenticated: true,
      authMethod: 'Universal Header Sign-In & Workspace Sync',
      partition: WORKSPACE_PARTITION,
      user: {
        name: 'Patrick Jay F. Tanap, CPA, CICA',
        email: 'patrick.tanap@filinvest.com',
      },
    };
  });

  ipcMain.handle('auth:google-logout', async () => {
    try {
      const authSession = session.fromPartition(WORKSPACE_PARTITION);
      await authSession.clearStorageData({ storages: ['cookies', 'localstorage'] });
    } catch (_e) {}
    return { success: true };
  });

  ipcMain.handle('auth:google-cancel', async () => {
    if (authWindow && !authWindow.isDestroyed()) {
      try { authWindow.close(); } catch (_) {}
      authWindow = null;
    }
    return { success: true };
  });
}