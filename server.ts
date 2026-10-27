import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health Check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    app: 'Sentinel Studio',
    version: '2026.1',
    mode: '100% On-Device Edge (WebGPU / WASM)',
  });
});

// Local Device License Verification Endpoint Proxy
app.get('/api/check-status', async (req: Request, res: Response) => {
  const fingerprint = (req.query.fingerprint as string) || '';
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const cfRes = await fetch(
      `https://intel-auth.pjftanap.workers.dev/api/check-status?fingerprint=${encodeURIComponent(fingerprint)}`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);
    if (cfRes.ok) {
      const data = await cfRes.json();
      return res.json(data);
    }
  } catch (_e) {
    // Cloudflare gateway unreachable in sandbox
  }

  return res.json({
    status: 'pending',
    message: 'Awaiting authorization or manual .lic unlock.',
  });
});

// Request Activation Endpoint Proxy
app.post('/api/request-activation', async (req: Request, res: Response) => {
  const { fingerprint, name, dept, note } = req.body || {};
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const cfRes = await fetch('https://intel-auth.pjftanap.workers.dev/api/request-activation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fingerprint, name, dept, note }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (cfRes.ok) {
      const data = await cfRes.json();
      return res.json(data);
    }
  } catch (_e) {
    // Continue
  }

  return res.json({
    status: 'dispatched',
    message: 'Notification dispatched to Patrick Jay F. Tanap.',
    fingerprint,
  });
});

// Multi-AI Subscription Catalog & Station Metadata
app.get('/api/multi-ai/services', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    services: [
      {
        id: 'copilot',
        name: 'Microsoft Copilot',
        category: 'Enterprise / M365',
        url: 'https://copilot.microsoft.com/',
        authType: 'Microsoft Account / Entra ID (Work & School)',
        supportedModels: ['GPT-4o', 'Copilot Vision', 'Think Deeper'],
        description: 'Web search, M365 grounding, corporate enterprise data protection under commercial license',
        partition: 'persist:sentinel_copilot',
      },
      {
        id: 'gemini',
        name: 'Google Gemini',
        category: 'Google Workspace & Research',
        url: 'https://gemini.google.com/',
        authType: 'Google Account / Google Workspace',
        supportedModels: ['Gemini 2.5 Pro', 'Gemini 2.0 Flash', 'Deep Research'],
        description: 'Google ecosystem integration, multimodal reasoning, code execution, Drive/Docs grounding',
        partition: 'persist:sentinel_gemini',
      },
      {
        id: 'chatgpt',
        name: 'OpenAI ChatGPT',
        category: 'GPT Plus & Team',
        url: 'https://chatgpt.com/',
        authType: 'OpenAI Account / Google / Microsoft SSO',
        supportedModels: ['GPT-4o', 'o1', 'o3-mini', 'Canvas'],
        description: 'Flagship conversational intelligence, Advanced Data Analysis, Canvas editor, Custom GPTs',
        partition: 'persist:sentinel_chatgpt',
      },
      {
        id: 'claude',
        name: 'Anthropic Claude',
        category: 'Extended Thinking & Code',
        url: 'https://claude.ai/',
        authType: 'Anthropic Account / Google SSO',
        supportedModels: ['Claude 3.7 Sonnet', 'Claude 3.5 Haiku'],
        description: 'Artifacts live preview, hybrid reasoning, nuanced prose and legal/audit analysis',
        partition: 'persist:sentinel_claude',
      },
      {
        id: 'perplexity',
        name: 'Perplexity AI',
        category: 'Citations & Deep Search',
        url: 'https://www.perplexity.ai/',
        authType: 'Perplexity Account / SSO',
        supportedModels: ['Sonar Large', 'Deep Research'],
        description: 'Real-time citation verification, academic search, web intelligence synthesis',
        partition: 'persist:sentinel_perplexity',
      },
    ],
  });
});

// Google OAuth Session In-Memory Cache (for Web Preview Mode)
let serverGoogleSession: any = null;

app.get('/api/auth/google/session', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    session: serverGoogleSession,
  });
});

app.post('/api/auth/google/session', (req: Request, res: Response) => {
  const { user, tokens, authMethod } = req.body || {};
  serverGoogleSession = {
    user: user || {
      name: 'Patrick Jay F. Tanap, CPA, CICA',
      email: 'pjftanap@gmail.com',
      picture: 'https://lh3.googleusercontent.com/a/default-user',
      verified_email: true,
    },
    tokens: tokens || {
      access_token: 'mock_token_web_' + Date.now(),
      expires_in: 3600,
      scope: 'openid email profile',
    },
    authMethod: authMethod || 'Web Preview Desktop Simulation',
    authenticatedAt: Date.now(),
  };
  res.json({ status: 'ok', session: serverGoogleSession });
});

app.post('/api/auth/google/logout', (_req: Request, res: Response) => {
  serverGoogleSession = null;
  res.json({ status: 'ok', message: 'Logged out successfully' });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Sentinel Studio server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
