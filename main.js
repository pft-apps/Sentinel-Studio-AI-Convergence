/**
 * =====================================================================
 * SENTINEL STUDIO™ — ELECTRON STANDALONE DESKTOP WORKSTATION
 * Enterprise Capability Hub & Multi-AI OS
 * Architect & Developer: Patrick Jay F. Tanap, CPA, CICA
 * Main Process, Partition Manager & Cookie Jar Synchronization Engine
 * =====================================================================
 */

const { app, BrowserWindow, ipcMain, dialog, session, shell } = require('electron');
const path = require('path');
const fs = require('fs');

// 1. Chromium Command Line Switches: Hardware Acceleration, WebGPU, Anti-Automation, and WebAuthn Suppression
app.commandLine.appendSwitch('force-color-profile', 'srgb');
app.commandLine.appendSwitch('enable-unsafe-webgpu');
app.commandLine.appendSwitch('enable-features', 'Vulkan,WebGPU');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled');
app.commandLine.appendSwitch('disable-features', 'WebAuthentication,WebAuthenticationConditionalUI');

const PERSISTENT_SESSION_PARTITION = 'persist:sentinel_ai_workspace';
const SHARED_PARTITION = 'persist:sentinel_ai_workspace';
const CHROME_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36';

app.userAgentFallback = CHROME_USER_AGENT;

let mainWindowInstance = null;

// 2. WebAuthn Runtime Interception & Rejection Script
const DISABLE_PASSKEY_INJECTION = `
  (() => {
    try {
      if ('PublicKeyCredential' in window) {
        Object.defineProperty(window, 'PublicKeyCredential', {
          get: () => undefined,
          configurable: true
        });
      }

      if (navigator.credentials && navigator.credentials.get) {
        const originalGet = navigator.credentials.get.bind(navigator.credentials);
        navigator.credentials.get = function(options) {
          if (options && (options.publicKey || options.mediation === 'conditional')) {
            return Promise.reject(new DOMException("WebAuthn platform authenticators are not supported in this client environment.", "NotSupportedError"));
          }
          return originalGet(options);
        };
      }
    } catch (e) {
      console.warn("Passkey suppression notice:", e);
    }
  })();
`;

/**
 * Configure User-Agent, Client Hints, and Relaxed Frame Headers for a Session
 */
function configurePartitionHeaders(targetSession) {
  if (!targetSession) return;
  try {
    targetSession.setUserAgent(CHROME_USER_AGENT);
  } catch (_e) {
    // Ignore
  }

  const filter = { urls: ['*://*/*'] };

  targetSession.webRequest.onBeforeSendHeaders(filter, (details, callback) => {
    const requestHeaders = { ...details.requestHeaders };
    requestHeaders['User-Agent'] = CHROME_USER_AGENT;
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
    // Critical: Always invoke callback to prevent hanging Chromium network requests
    callback({ cancel: false, responseHeaders });
  });
}

/**
 * Cookie Jar Synchronization Engine:
 * Clones authenticated .google.com cookies into target persistent partitions
 */
async function syncGoogleCookies(sourceSession, targetSession) {
  if (!sourceSession || !targetSession) return false;
  try {
    const cookies = await sourceSession.cookies.get({ domain: '.google.com' });
    for (const cookie of cookies) {
      const scheme = cookie.secure ? 'https' : 'http';
      const domainClean = cookie.domain.startsWith('.') ? cookie.domain.slice(1) : cookie.domain;
      const url = `${scheme}://${domainClean}${cookie.path || '/'}`;
      try {
        await targetSession.cookies.set({
          url: url,
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          path: cookie.path || '/',
          secure: cookie.secure,
          httpOnly: cookie.httpOnly,
          expirationDate: cookie.expirationDate,
          sameSite: cookie.sameSite || 'unspecified',
        });
      } catch (_cookieErr) {
        // Ignore single cookie transfer errors
      }
    }
    return true;
  } catch (e) {
    console.warn('[Cookie Jar Sync Notice]:', e?.message);
    return false;
  }
}

/**
 * Google Desktop Authentication Flow via Internal Shared-Partition Window
 */
async function startGoogleAuthFlow(targetMainWindow) {
  return new Promise((resolve) => {
    const authSession = session.fromPartition(SHARED_PARTITION);
    configurePartitionHeaders(authSession);

    const authWin = new BrowserWindow({
      width: 540,
      height: 720,
      title: 'Sign In with Google — Sentinel Studio Workspace',
      autoHideMenuBar: true,
      webPreferences: {
        partition: SHARED_PARTITION,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    authWin.webContents.setUserAgent(CHROME_USER_AGENT);
    authWin.webContents.on('dom-ready', () => {
      authWin.webContents.executeJavaScript(DISABLE_PASSKEY_INJECTION).catch(() => {});
    });

    let resolved = false;

    const checkAndFinish = async (url) => {
      if (resolved) return;
      const isAuthFinished =
        url.includes('gemini.google.com/app') ||
        url.includes('myaccount.google.com') ||
        (url.includes('google.com') &&
          !url.includes('/signin/') &&
          !url.includes('/ServiceLogin') &&
          !url.includes('/identifier') &&
          !url.includes('/challenge/') &&
          !url.includes('/v3/signin') &&
          !url.includes('/speedbump'));

      if (isAuthFinished) {
        resolved = true;
        try {
          await syncGoogleCookies(authSession, session.defaultSession);
          ['copilot', 'gemini', 'chatgpt', 'claude', 'perplexity'].forEach(async (id) => {
            try {
              const s = session.fromPartition(`persist:sentinel_${id}`);
              await syncGoogleCookies(authSession, s);
            } catch (_e) {}
          });
        } catch (_syncErr) {}

        const win = targetMainWindow || mainWindowInstance;
        if (win && !win.isDestroyed()) {
          win.webContents.send('auth:redirect-webview', {
            target: 'gemini',
            url: 'https://gemini.google.com/app',
          });
        }

        setTimeout(() => {
          if (!authWin.isDestroyed()) {
            authWin.close();
          }
        }, 800);

        resolve({
          success: true,
          user: {
            name: 'Patrick Jay F. Tanap, CPA, CICA',
            email: 'patrick.tanap@filinvest.com',
          },
        });
      }
    };

    authWin.webContents.on('did-navigate', (_event, url) => {
      checkAndFinish(url);
    });

    authWin.webContents.on('did-navigate-in-page', (_event, url) => {
      checkAndFinish(url);
    });

    authWin.on('closed', () => {
      if (!resolved) {
        resolved = true;
        resolve({ success: false, error: 'Sign-in window closed by user.' });
      }
    });

    authWin.loadURL('https://accounts.google.com/ServiceLogin?continue=https://gemini.google.com/app');
  });
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1200,
    minHeight: 768,
    backgroundColor: '#06234D',
    title: 'Sentinel Studio — Enterprise Capability Hub',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindowInstance = mainWindow;
  mainWindow.setMenuBarVisibility(false);

  // Configure partitions
  configurePartitionHeaders(session.defaultSession);
  const aiWorkspaceSession = session.fromPartition(PERSISTENT_SESSION_PARTITION);
  configurePartitionHeaders(aiWorkspaceSession);

  ['copilot', 'gemini', 'chatgpt', 'claude', 'perplexity'].forEach((id) => {
    try {
      const s = session.fromPartition(`persist:sentinel_${id}`);
      configurePartitionHeaders(s);
    } catch (_e) {
      // Continue
    }
  });

  // 1. Intercept main window popups: Keep all AI and OAuth login flows inside Sentinel Studio
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    return {
      action: 'allow',
      overrideBrowserWindowOptions: {
        width: 540,
        height: 720,
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

  // 2. Intercept webview popups as soon as they attach & inject passkey suppression
  mainWindow.webContents.on('did-attach-webview', (event, webContents) => {
    webContents.on('dom-ready', () => {
      webContents.executeJavaScript(DISABLE_PASSKEY_INJECTION).catch(() => {});
    });

    webContents.setWindowOpenHandler(({ url }) => {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 540,
          height: 720,
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
  });

  // 3. Automatically close popup when login completes & attach passkey suppression
  app.on('browser-window-created', (event, childWindow) => {
    if (childWindow !== mainWindow) {
      childWindow.webContents.on('dom-ready', () => {
        childWindow.webContents.executeJavaScript(DISABLE_PASSKEY_INJECTION).catch(() => {});
      });

      childWindow.webContents.on('did-navigate', (e, navigatedUrl) => {
        const isAuthFinished =
          navigatedUrl.includes('gemini.google.com/app') ||
          (navigatedUrl.includes('chatgpt.com') && !navigatedUrl.includes('/auth/')) ||
          (navigatedUrl.includes('claude.ai') && !navigatedUrl.includes('/login')) ||
          (navigatedUrl.includes('perplexity.ai') && !navigatedUrl.includes('/login')) ||
          (navigatedUrl.includes('copilot.microsoft.com') && !navigatedUrl.includes('login'));

        if (isAuthFinished) {
          setTimeout(() => {
            if (!childWindow.isDestroyed()) {
              childWindow.close();
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
  } else {
    console.error('CRITICAL: No index.html found in dist/ or application root directory!');
  }

  return mainWindow;
}

function setupIpcHandlers() {
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

  // External Browser Opener — Filter out Auth & AI Domains
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

  // Multi-AI Dedicated IPC Handlers
  ipcMain.handle('multi-ai:open-companion', async (_event, url, partitionName) => {
    const targetPartition = partitionName || PERSISTENT_SESSION_PARTITION;
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
    companionWindow.loadURL(url);
    return { success: true };
  });

  ipcMain.handle('multi-ai:clear-partition', async (_event, partitionName) => {
    if (!partitionName) return { success: false };
    try {
      const targetSession = session.fromPartition(partitionName);
      await targetSession.clearStorageData();
      return { success: true };
    } catch (e) {
      return { success: false, error: e?.message };
    }
  });

  /**
   * Google Desktop Cookie Jar Synchronization IPC Handlers
   */
  ipcMain.handle('auth:start-google-login', async () => {
    return await startGoogleAuthFlow(mainWindowInstance);
  });

  ipcMain.handle('auth:google-login', async () => {
    return await startGoogleAuthFlow(mainWindowInstance);
  });

  ipcMain.handle('auth:google-cancel', async () => {
    return { success: true, message: 'Google authentication canceled.' };
  });

  ipcMain.handle('auth:get-session', async () => {
    return {
      authenticated: true,
      authMethod: 'Cookie Jar Synchronization',
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
  if (process.platform !== 'darwin') app.quit();
});