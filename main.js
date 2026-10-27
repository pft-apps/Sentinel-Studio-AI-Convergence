/**
 * =====================================================================
 * SENTINEL STUDIO™ — ELECTRON STANDALONE DESKTOP WORKSTATION
 * Enterprise Capability Hub & Multi-AI OS
 * Architect & Developer: Patrick Jay F. Tanap, CPA, CICA
 * Main Process, Partition Manager & Browser-Based Session Relay
 * =====================================================================
 */

const { app, BrowserWindow, ipcMain, dialog, session, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');

// 1. Hardware Acceleration and WebGPU Support
app.commandLine.appendSwitch('force-color-profile', 'srgb');
app.commandLine.appendSwitch('enable-unsafe-webgpu');
app.commandLine.appendSwitch('enable-features', 'Vulkan,WebGPU');
app.commandLine.appendSwitch('ignore-gpu-blocklist');

const PERSISTENT_SESSION_PARTITION = 'persist:sentinel_ai_workspace';
const SHARED_PARTITION = 'persist:sentinel_ai_workspace';

let mainWindowInstance = null;
let sessionRelayServer = null;

/**
 * Clean Frame Headers for Embedded Workstation Webviews
 */
function configurePartitionHeaders(targetSession) {
  if (!targetSession) return;

  const filter = { urls: ['*://*/*'] };

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
    width: 500,
    height: 650,
    title: 'Sign In — Sentinel Studio Workspace',
    autoHideMenuBar: true,
    webPreferences: {
      partition: SHARED_PARTITION,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

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

  // 1. Intercept main window popups: Retain OAuth URLs inside internal top-level window
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    return {
      action: 'allow',
      overrideBrowserWindowOptions: {
        width: 500,
        height: 650,
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

  // 2. Intercept webview popups
  mainWindow.webContents.on('did-attach-webview', (event, webContents) => {
    webContents.setWindowOpenHandler(({ url }) => {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 500,
          height: 650,
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

  // 3. Automatically close child auth popups upon completed sign-in
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

  // Multi-AI Dedicated Companion Window
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

  // 1. Direct In-App Login Window Trigger (Top-Level Window, NOT webview)
  ipcMain.handle('auth:start-direct-login', async (_event, options) => {
    const engine = typeof options === 'string' ? options : (options?.engine || 'gemini');
    return openDirectLoginWindow(mainWindowInstance, engine);
  });

  // 2. External Browser Session Relay Trigger
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
      authMethod: 'Direct Window / Browser Relay',
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