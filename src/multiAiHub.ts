/**
 * =====================================================================
 * SENTINEL STUDIO™ — MULTI-AI CONVERGENCE WORKSTATION
 * Persistent Multi-Browser Hub for AI Subscriptions
 * (Microsoft Copilot, Google Gemini, OpenAI ChatGPT, Claude, Perplexity)
 * Architect & Developer: Patrick Jay F. Tanap, CPA, CICA
 * =====================================================================
 */

import { googleAuth } from './googleAuth.ts';

export interface AiServiceConfig {
  id: string;
  name: string;
  shortName: string;
  icon: string;
  badge: string;
  defaultUrl: string;
  color: string;
  partition: string;
  description: string;
  authTip: string;
  placeholderTip: string;
}

export interface BrowserPane {
  id: string;
  serviceId: string;
  currentUrl: string;
  zoomLevel: number;
  title: string;
  isLoading: boolean;
  isMaximized: boolean;
  companionOpen?: boolean;
}

export type MultiAiLayout = 'single' | 'dual' | 'triple' | 'quad' | 'penta' | 'all';

export interface MultiAiStore {
  isOpen: boolean;
  layout: MultiAiLayout;
  panes: BrowserPane[];
  activePaneId: string | null;
  broadcastPrompt: string;
  syncOnSend: boolean;
  autoSubmit: boolean;
  lastActiveTimestamp: number;
}

export const AI_SERVICES: AiServiceConfig[] = [
  {
    id: 'copilot',
    name: 'Microsoft Copilot',
    shortName: 'MS Copilot',
    icon: '🔵',
    badge: 'M365 Enterprise & Personal',
    defaultUrl: 'https://copilot.microsoft.com',
    color: '#0078D4',
    partition: 'persist:sentinel_ai_workspace',
    description: 'Sign in with your Microsoft 365 Work, School, or Personal Account for M365 grounding and enterprise data protection.',
    authTip: 'Supports Microsoft Entra ID (Work/School SSO), Personal MSA, and Commercial Data Protection.',
    placeholderTip: 'Ask Copilot for web-grounded research, Excel formulas, PowerPoint outlines, or Word policies...',
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    shortName: 'Google Gemini',
    icon: '✨',
    badge: 'Gemini Advanced & Workspace',
    defaultUrl: 'https://gemini.google.com/app',
    color: '#1A73E8',
    partition: 'persist:sentinel_ai_workspace',
    description: 'Sign in with your Google or Google Workspace Account for Gemini 2.5 Pro, Deep Research, and Drive integration.',
    authTip: 'Supports Google Workspace, personal Gmail, and YouTube/Docs/Drive multimodal extensions.',
    placeholderTip: 'Ask Gemini for deep research, large-document synthesis, coding, and multimodal analysis...',
  },
  {
    id: 'chatgpt',
    name: 'OpenAI ChatGPT',
    shortName: 'ChatGPT',
    icon: '🟢',
    badge: 'Plus, Team & Enterprise',
    defaultUrl: 'https://chatgpt.com',
    color: '#10A37F',
    partition: 'persist:sentinel_ai_workspace',
    description: 'Sign in with your OpenAI subscription to access GPT-4o, o1 reasoning models, Canvas workspace, and Custom GPTs.',
    authTip: 'Supports ChatGPT Plus, Team, Enterprise, and Google/Microsoft SSO logins.',
    placeholderTip: 'Prompt ChatGPT for complex reasoning, data analytics, Canvas editing, and specialized GPTs...',
  },
  {
    id: 'claude',
    name: 'Anthropic Claude',
    shortName: 'Claude',
    icon: '🟠',
    badge: 'Claude 3.7 Sonnet',
    defaultUrl: 'https://claude.ai',
    color: '#D97706',
    partition: 'persist:sentinel_ai_workspace',
    description: 'Sign in with your Anthropic account for extended hybrid thinking, Artifacts preview, and nuanced writing.',
    authTip: 'Supports Claude Pro, Team, and Google Sign-In with persistent session auth.',
    placeholderTip: 'Ask Claude for deep architectural reviews, legal contract auditing, and Artifact generation...',
  },
  {
    id: 'perplexity',
    name: 'Perplexity AI',
    shortName: 'Perplexity',
    icon: '🟣',
    badge: 'Pro Search & Citations',
    defaultUrl: 'https://www.perplexity.ai',
    color: '#8B5CF6',
    partition: 'persist:sentinel_ai_workspace',
    description: 'Sign in for cited real-time web discovery, academic search, financial filings, and Deep Research reports.',
    authTip: 'Supports Perplexity Pro, Google SSO, and Apple ID logins.',
    placeholderTip: 'Search for live statutory rulings, regulatory issuances, financial filings, or current market facts...',
  },
  {
    id: 'custom',
    name: 'Custom AI Browser',
    shortName: 'Custom URL',
    icon: '🌐',
    badge: 'Any AI Service',
    defaultUrl: 'https://chat.deepseek.com/',
    color: '#4F46E5',
    partition: 'persist:sentinel_ai_workspace',
    description: 'Connect to any web AI subscription portal: DeepSeek, Poe, Mistral Le Chat, HuggingChat, or internal enterprise models.',
    authTip: 'Any standard HTTPS URL with full cookie and session persistence.',
    placeholderTip: 'Enter any AI portal or custom web endpoint URL...',
  },
];

const STORAGE_KEY = 'sentinel_multi_ai_state_v1';
const CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36';

class MultiAiHubManager {
  private state: MultiAiStore;
  private containerEl: HTMLElement | null = null;
  private companionWindows: Map<string, Window | null> = new Map();

  constructor() {
    this.state = this.loadState();
  }

  private loadState(): MultiAiStore {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.panes) && parsed.panes.length > 0) {
          const loadedPanes = [...parsed.panes];
          const existingServiceIds = new Set(loadedPanes.map((p: any) => p.serviceId));
          const canonical = ['copilot', 'gemini', 'chatgpt', 'claude', 'perplexity', 'custom'];
          canonical.forEach((sid) => {
            if (!existingServiceIds.has(sid)) {
              const svc = AI_SERVICES.find((s) => s.id === sid);
              if (svc) {
                loadedPanes.push({
                  id: `pane_${sid}`,
                  serviceId: svc.id,
                  currentUrl: svc.defaultUrl,
                  zoomLevel: 1.0,
                  title: svc.name,
                  isLoading: false,
                  isMaximized: false,
                });
              }
            }
          });

          const validLayouts = ['single', 'dual', 'triple', 'quad', 'penta', 'all'];
          const finalLayout = validLayouts.includes(parsed.layout) ? parsed.layout : 'triple';

          return {
            isOpen: !!parsed.isOpen,
            layout: finalLayout as MultiAiLayout,
            panes: loadedPanes,
            activePaneId: parsed.activePaneId || loadedPanes[0]?.id || null,
            broadcastPrompt: parsed.broadcastPrompt || '',
            syncOnSend: parsed.syncOnSend !== false,
            autoSubmit: parsed.autoSubmit !== false,
            lastActiveTimestamp: Date.now(),
          };
        }
      }
    } catch (e) {
      console.warn('[Multi-AI Hub] Error restoring state:', e);
    }

    // Default: All 6 AIs configured and ready (Copilot, Gemini, ChatGPT, Claude, Perplexity, Custom URL)
    const defaultPanes: BrowserPane[] = [
      {
        id: 'pane_copilot',
        serviceId: 'copilot',
        currentUrl: 'https://copilot.microsoft.com/',
        zoomLevel: 1.0,
        title: 'Microsoft Copilot',
        isLoading: false,
        isMaximized: false,
      },
      {
        id: 'pane_gemini',
        serviceId: 'gemini',
        currentUrl: 'https://gemini.google.com/',
        zoomLevel: 1.0,
        title: 'Google Gemini',
        isLoading: false,
        isMaximized: false,
      },
      {
        id: 'pane_chatgpt',
        serviceId: 'chatgpt',
        currentUrl: 'https://chatgpt.com/',
        zoomLevel: 1.0,
        title: 'OpenAI ChatGPT',
        isLoading: false,
        isMaximized: false,
      },
      {
        id: 'pane_claude',
        serviceId: 'claude',
        currentUrl: 'https://claude.ai/',
        zoomLevel: 1.0,
        title: 'Anthropic Claude',
        isLoading: false,
        isMaximized: false,
      },
      {
        id: 'pane_perplexity',
        serviceId: 'perplexity',
        currentUrl: 'https://www.perplexity.ai/',
        zoomLevel: 1.0,
        title: 'Perplexity AI',
        isLoading: false,
        isMaximized: false,
      },
      {
        id: 'pane_custom',
        serviceId: 'custom',
        currentUrl: 'https://chat.deepseek.com/',
        zoomLevel: 1.0,
        title: 'Custom AI Browser',
        isLoading: false,
        isMaximized: false,
      },
    ];

    return {
      isOpen: false,
      layout: 'triple',
      panes: defaultPanes,
      activePaneId: 'pane_copilot',
      broadcastPrompt: '',
      syncOnSend: true,
      autoSubmit: true,
      lastActiveTimestamp: Date.now(),
    };
  }

  private saveState(): void {
    try {
      const serializable = {
        isOpen: this.state.isOpen,
        layout: this.state.layout,
        panes: this.state.panes.map((p) => ({
          id: p.id,
          serviceId: p.serviceId,
          currentUrl: p.currentUrl,
          zoomLevel: p.zoomLevel,
          title: p.title,
          isMaximized: p.isMaximized,
        })),
        activePaneId: this.state.activePaneId,
        broadcastPrompt: this.state.broadcastPrompt,
        syncOnSend: this.state.syncOnSend,
        autoSubmit: this.state.autoSubmit,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
    } catch (e) {
      console.warn('[Multi-AI Hub] Error saving state:', e);
    }
  }

  public init(): void {
    this.containerEl = document.getElementById('multiAiHubContainer');
    if (!this.containerEl) {
      console.warn('[Multi-AI Hub] Container #multiAiHubContainer not found in DOM.');
      return;
    }

    this.render();
    this.attachGlobalListeners();

    // Auto-open if it was open previously
    if (this.state.isOpen) {
      this.open();
    }
  }

  public toggle(): void {
    if (this.state.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  public open(): void {
    this.state.isOpen = true;
    this.saveState();

    if (!this.containerEl) {
      this.containerEl = document.getElementById('multiAiHubContainer');
    }

    if (this.containerEl) {
      this.containerEl.classList.remove('hidden');
      this.containerEl.classList.add('flex');
    }

    // Hide standard chat main viewport when Multi-AI is active to give full screen real-estate
    const mainChat = document.querySelector('main');
    if (mainChat) {
      mainChat.classList.add('hidden');
    }

    // Update Header button state
    const toggleBtn = document.getElementById('toggleMultiAiBtn');
    if (toggleBtn) {
      toggleBtn.classList.add('ring-2', 'ring-purple-400', 'bg-purple-700');
    }

    this.render();
  }

  public close(): void {
    this.state.isOpen = false;
    this.saveState();

    if (this.containerEl) {
      this.containerEl.classList.add('hidden');
      this.containerEl.classList.remove('flex');
    }

    // Restore standard chat main viewport
    const mainChat = document.querySelector('main');
    if (mainChat) {
      mainChat.classList.remove('hidden');
    }

    // Update Header button state
    const toggleBtn = document.getElementById('toggleMultiAiBtn');
    if (toggleBtn) {
      toggleBtn.classList.remove('ring-2', 'ring-purple-400', 'bg-purple-700');
    }
  }

  public setLayout(layout: MultiAiLayout): void {
    this.state.layout = layout;

    // Reset maximized state when switching layouts
    this.state.panes.forEach((p) => (p.isMaximized = false));

    const targetCount = layout === 'single' ? 1
      : layout === 'dual' ? 2
      : layout === 'triple' ? 3
      : layout === 'quad' ? 4
      : layout === 'penta' ? 5
      : 6;

    this.ensurePanesForCount(targetCount);

    this.saveState();
    this.renderPanesGrid();
    this.updateLayoutButtons();

    const layoutLabels: Record<MultiAiLayout, string> = {
      single: 'Single Focus View',
      dual: 'Dual Side-by-Side View (2 Columns, 1 Row)',
      triple: '3-Split View (3 Columns, 1 Row)',
      quad: '4-Split View (2x2 Grid)',
      penta: '5-Split View (5 AIs in 3-Column Grid)',
      all: 'All View (6 AIs in 3-Column Grid: 5 AIs + Custom URL Browser)',
    };
    this.showToast(`Switched to ${layoutLabels[layout]}`);
  }

  public ensurePanesForCount(count: number): void {
    const canonical = ['copilot', 'gemini', 'chatgpt', 'claude', 'perplexity', 'custom'];
    const existingServiceIds = new Set(this.state.panes.map((p) => p.serviceId));

    for (let i = 0; i < count; i++) {
      const sid = canonical[i];
      if (!existingServiceIds.has(sid)) {
        const svc = AI_SERVICES.find((s) => s.id === sid);
        if (svc) {
          this.state.panes.push({
            id: `pane_${svc.id}`,
            serviceId: svc.id,
            currentUrl: svc.defaultUrl,
            zoomLevel: 1.0,
            title: svc.name,
            isLoading: false,
            isMaximized: false,
          });
          existingServiceIds.add(svc.id);
        }
      }
    }
  }

  public switchSingleFocus(serviceId: string): void {
    const found = this.state.panes.find((p) => p.serviceId === serviceId);
    if (found) {
      this.state.activePaneId = found.id;
    } else {
      const svc = AI_SERVICES.find((s) => s.id === serviceId);
      if (svc && this.state.panes.length > 0) {
        this.state.panes[0].serviceId = svc.id;
        this.state.panes[0].currentUrl = svc.defaultUrl;
        this.state.panes[0].title = svc.name;
        this.state.activePaneId = this.state.panes[0].id;
      }
    }
    this.saveState();
    this.renderPanesGrid();
    const svc = AI_SERVICES.find((s) => s.id === serviceId);
    if (svc) this.showToast(`Switched focus to ${svc.name}`);
  }

  public addPane(serviceId: string = 'copilot'): void {
    const service = AI_SERVICES.find((s) => s.id === serviceId) || AI_SERVICES[0];
    const newId = `pane_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newPane: BrowserPane = {
      id: newId,
      serviceId: service.id,
      currentUrl: service.defaultUrl,
      zoomLevel: 1.0,
      title: service.name,
      isLoading: false,
      isMaximized: false,
    };
    this.state.panes.push(newPane);
    this.state.activePaneId = newId;
    this.saveState();
    this.renderPanesGrid();
    this.showToast(`Added ${service.name} Browser Pane`);
  }

  public removePane(paneId: string): void {
    if (this.state.panes.length <= 1) {
      this.showToast('At least one browser pane must remain active.');
      return;
    }
    this.state.panes = this.state.panes.filter((p) => p.id !== paneId);
    if (this.state.activePaneId === paneId) {
      this.state.activePaneId = this.state.panes[0]?.id || null;
    }
    this.saveState();
    this.renderPanesGrid();
  }

  public setPaneService(paneId: string, serviceId: string): void {
    const pane = this.state.panes.find((p) => p.id === paneId);
    const service = AI_SERVICES.find((s) => s.id === serviceId);
    if (!pane || !service) return;

    pane.serviceId = service.id;
    pane.currentUrl = service.defaultUrl;
    pane.title = service.name;
    this.saveState();

    const frameEl = (document.getElementById(`${pane.serviceId}Webview`) || document.getElementById(`browser_frame_${paneId}`)) as any;
    if (frameEl) {
      frameEl.src = service.defaultUrl;
    }

    const urlInput = document.getElementById(`url_input_${paneId}`) as HTMLInputElement | null;
    if (urlInput) {
      urlInput.value = service.defaultUrl;
    }

    this.showToast(`Switched pane to ${service.name}`);
  }

  public navigatePane(paneId: string, url: string): void {
    const pane = this.state.panes.find((p) => p.id === paneId);
    if (!pane) return;

    let targetUrl = url.trim();
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = 'https://' + targetUrl;
    }

    pane.currentUrl = targetUrl;
    this.saveState();

    const frameEl = (document.getElementById(`${pane.serviceId}Webview`) || document.getElementById(`browser_frame_${paneId}`)) as any;
    if (frameEl) {
      frameEl.src = targetUrl;
    }
  }

  public reloadPane(paneId: string): void {
    const pane = this.state.panes.find((p) => p.id === paneId);
    const frameEl = (pane ? document.getElementById(`${pane.serviceId}Webview`) : null) || (document.getElementById(`browser_frame_${paneId}`) as any);
    if (frameEl) {
      if (typeof frameEl.reload === 'function') {
        frameEl.reload();
      } else {
        frameEl.src = frameEl.src;
      }
      this.showToast('Reloading pane...');
    }
  }

  public goHome(paneId: string): void {
    const pane = this.state.panes.find((p) => p.id === paneId);
    if (!pane) return;
    const service = AI_SERVICES.find((s) => s.id === pane.serviceId) || AI_SERVICES[0];
    this.navigatePane(paneId, service.defaultUrl);
  }

  public toggleMaximize(paneId: string): void {
    const pane = this.state.panes.find((p) => p.id === paneId);
    if (!pane) return;
    pane.isMaximized = !pane.isMaximized;
    this.saveState();
    this.renderPanesGrid();
  }

  public zoomPane(paneId: string, delta: number): void {
    const pane = this.state.panes.find((p) => p.id === paneId);
    if (!pane) return;
    pane.zoomLevel = Math.max(0.6, Math.min(1.8, parseFloat((pane.zoomLevel + delta).toFixed(1))));
    this.saveState();

    const frameEl = (document.getElementById(`${pane.serviceId}Webview`) || document.getElementById(`browser_frame_${paneId}`)) as any;
    if (frameEl) {
      if (typeof frameEl.setZoomFactor === 'function') {
        frameEl.setZoomFactor(pane.zoomLevel);
      } else {
        frameEl.style.transform = `scale(${pane.zoomLevel})`;
        frameEl.style.transformOrigin = 'top left';
        frameEl.style.width = `${100 / pane.zoomLevel}%`;
        frameEl.style.height = `${100 / pane.zoomLevel}%`;
      }
    }

    const zoomBadge = document.getElementById(`zoom_badge_${paneId}`);
    if (zoomBadge) {
      zoomBadge.textContent = `${Math.round(pane.zoomLevel * 100)}%`;
    }
  }

  public openCompanion(paneId: string): void {
    const pane = this.state.panes.find((p) => p.id === paneId);
    if (!pane) return;
    const service = AI_SERVICES.find((s) => s.id === pane.serviceId) || AI_SERVICES[0];
    const isDesktop = typeof (window as any).sentinelDesktop !== 'undefined' && !!(window as any).sentinelDesktop.isDesktop;

    if (isDesktop && (window as any).sentinelDesktop?.openCompanionWindow) {
      (window as any).sentinelDesktop.openCompanionWindow(pane.currentUrl, service.partition);
      this.showToast(`Launched ${service.name} Companion Desktop Window`);
      return;
    }

    // Web Browser popup window
    const popup = window.open(
      pane.currentUrl,
      `sentinel_${pane.serviceId}_window`,
      'width=1100,height=850,menubar=no,toolbar=no,location=yes,status=no,resizable=yes,scrollbars=yes'
    );
    if (popup) {
      this.companionWindows.set(paneId, popup);
      this.showToast(`Opened ${service.name} Companion Window. Log in to your subscription!`);
    } else {
      this.showToast('Please allow popups to open the connected companion window.');
    }
  }

  public clearSession(paneId: string): void {
    const pane = this.state.panes.find((p) => p.id === paneId);
    if (!pane) return;
    const service = AI_SERVICES.find((s) => s.id === pane.serviceId) || AI_SERVICES[0];
    const isDesktop = typeof (window as any).sentinelDesktop !== 'undefined' && !!(window as any).sentinelDesktop.isDesktop;

    if (isDesktop && (window as any).sentinelDesktop?.clearPartition) {
      (window as any).sentinelDesktop.clearPartition(service.partition).then((res: any) => {
        if (res?.success) {
          this.showToast(`Cleared persistent storage for ${service.name}`);
          this.reloadPane(paneId);
        }
      });
    } else {
      this.reloadPane(paneId);
      this.showToast(`Reset browser view for ${service.name}`);
    }
  }

  /**
   * Returns the list of AI Services that are currently active and visible
   * in accordance with the user's view selection (single, dual, 3-split, 4-split, 5-split, All).
   */
  public getActiveServices(): AiServiceConfig[] {
    // If any pane is maximized, only that single pane is active
    if (this.state.panes.some((p) => p.isMaximized)) {
      const maxPane = this.state.panes.find((p) => p.isMaximized);
      if (maxPane) {
        const svc = AI_SERVICES.find((s) => s.id === maxPane.serviceId);
        return svc ? [svc] : [];
      }
    }

    const layout = this.state.layout;
    let targetCount = 3;
    if (layout === 'single') targetCount = 1;
    else if (layout === 'dual') targetCount = 2;
    else if (layout === 'triple') targetCount = 3;
    else if (layout === 'quad') targetCount = 4;
    else if (layout === 'penta') targetCount = 5;
    else if (layout === 'all') targetCount = 6;

    let visiblePanes: BrowserPane[] = [];
    if (layout === 'single') {
      const active = this.state.panes.find((p) => p.id === this.state.activePaneId);
      visiblePanes = active ? [active] : this.state.panes.slice(0, 1);
    } else {
      visiblePanes = this.state.panes.slice(0, targetCount);
    }

    const activeServices: AiServiceConfig[] = [];
    visiblePanes.forEach((p) => {
      const svc = AI_SERVICES.find((s) => s.id === p.serviceId);
      if (svc && !activeServices.some((s) => s.id === svc.id)) {
        activeServices.push(svc);
      }
    });

    return activeServices;
  }

  public broadcastPrompt(): void {
    const input = document.getElementById('multiAiBroadcastInput') as HTMLTextAreaElement | null;
    const promptText = input ? input.value.trim() : this.state.broadcastPrompt.trim();
    if (!promptText) {
      this.showToast('Please type a prompt in the broadcast dock first.');
      return;
    }

    this.state.broadcastPrompt = promptText;
    this.saveState();

    const activeServices = this.getActiveServices();
    if (!activeServices || activeServices.length === 0) {
      this.showToast('No active AI browser panes currently visible in view.');
      return;
    }

    const activeServiceIds = new Set(activeServices.map((s) => s.id));
    const isDesktop = typeof (window as any).sentinelDesktop !== 'undefined' && !!(window as any).sentinelDesktop.isDesktop;

    // 1. Copy to clipboard
    navigator.clipboard.writeText(promptText).catch(() => {});

    // 2. Pulse effect on active visible panes
    this.state.panes.forEach((p) => {
      if (activeServiceIds.has(p.serviceId)) {
        const paneEl = document.getElementById(`pane_container_${p.id}`);
        if (paneEl) {
          paneEl.classList.add('ring-4', 'ring-emerald-400/80', 'transition-all');
          setTimeout(() => {
            paneEl.classList.remove('ring-4', 'ring-emerald-400/80');
          }, 1200);
        }
      }
    });

    // 3. Dispatch to ACTIVE VISIBLE AIs in accordance to view selection
    let sentCount = 0;
    activeServices.forEach((svc) => {
      const pane = this.state.panes.find((p) => p.serviceId === svc.id);
      if (!pane) return;

      sentCount++;

      // Update state externalSessions
      if ((window as any).state && (window as any).state.externalSessions) {
        if (!(window as any).state.externalSessions[svc.id]) {
          (window as any).state.externalSessions[svc.id] = { lastPrompt: '', lastResponse: '', isLoading: false, history: [] };
        }
        (window as any).state.externalSessions[svc.id].lastPrompt = promptText;
        (window as any).state.externalSessions[svc.id].isLoading = true;
      }

      if (isDesktop) {
        const webview = document.getElementById(`browser_frame_${pane.id}`) as any;
        if (webview && typeof webview.executeJavaScript === 'function') {
          const script = this.buildInjectionScript(svc.id, promptText, this.state.autoSubmit);
          webview.executeJavaScript(script).catch((err: any) => {
            console.warn(`[Multi-AI] Injection error for ${svc.id}:`, err);
          });
        }
      }
    });

    const modeLabels: Record<string, string> = {
      single: 'Single Focus AI',
      dual: 'Dual View (2 Active AIs)',
      triple: '3-Split View (3 Active AIs)',
      quad: '4-Split View (4 Active AIs)',
      penta: '5-Split View (5 Active AIs)',
      all: 'All View (6 Active AIs)',
    };

    const label = modeLabels[this.state.layout] || `${sentCount} Active AIs`;

    if (this.state.autoSubmit && isDesktop) {
      this.showToast(`🚀 Auto-Sending broadcast to ${sentCount} Active AIs [${label}]: ${activeServices.map(s => s.shortName).join(', ')}`);
    } else {
      this.showToast(`⚡ Broadcast Prompt filled into ${sentCount} Active AIs [${label}]: ${activeServices.map(s => s.shortName).join(', ')}`);
    }
  }

  /**
   * Captures the current chats with all ACTIVE AIs (based on visible layout view selection)
   * and saves them locally into Sentinel Session History grouped per AI!
   */
  public captureActiveAiChats(): void {
    const activeServices = this.getActiveServices();
    if (!activeServices || activeServices.length === 0) {
      this.showToast('No active visible AI browsers found to capture.');
      return;
    }

    let capturedCount = 0;
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    activeServices.forEach((svc) => {
      let promptText = '';
      let responseText = '';

      if ((window as any).state?.externalSessions && (window as any).state.externalSessions[svc.id]) {
        const sess = (window as any).state.externalSessions[svc.id];
        promptText = sess.lastPrompt || '';
        responseText = sess.lastResponse || '';
      }

      if (!promptText && !responseText) {
        promptText = this.state.broadcastPrompt.trim() || 'Captured Multi-AI Workstation State';
        responseText = `Active session state captured from ${svc.name} (${svc.badge}).`;
      }

      if (typeof (window as any).saveCapturedSession === 'function') {
        (window as any).saveCapturedSession({
          engineSource: svc.id,
          title: `[${svc.shortName}] ${promptText ? promptText.substring(0, 32) + '...' : 'Captured Chat - ' + timeStr}`,
          prompt: promptText,
          response: responseText,
        });
        capturedCount++;
      }
    });

    if (capturedCount > 0) {
      this.showToast(`💾 Captured chats for ${capturedCount} Active AIs (${activeServices.map(s => s.shortName).join(', ')}) saved under Session History!`);
    } else {
      this.showToast('No active AI chats captured.');
    }
  }

  public toggleAutoSubmit(): void {
    this.state.autoSubmit = !this.state.autoSubmit;
    this.saveState();
    const btn = document.getElementById('multiAiAutoSubmitToggleBtn');
    if (btn) {
      btn.className = `px-2.5 py-1 rounded-xl text-[10px] font-bold border transition flex items-center gap-1.5 cursor-pointer ${
        this.state.autoSubmit
          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-400 dark:border-emerald-600/50'
          : 'bg-gray-100 dark:bg-intel-850 text-gray-500 dark:text-slate-400 border-gray-300 dark:border-intel-border'
      }`;
      btn.innerHTML = `<span>${this.state.autoSubmit ? '🟢' : '⚪'}</span><span>Auto-Send: ${this.state.autoSubmit ? 'ON' : 'OFF'}</span>`;
    }
    this.showToast(
      this.state.autoSubmit
        ? '⚡ Auto-Submit enabled: Prompt will be injected and submitted directly in desktop station'
        : 'Auto-Submit disabled: Prompt will be filled into inputs only'
    );
  }

  private buildInjectionScript(serviceId: string, promptText: string, autoSubmit: boolean): string {
    const jsonPrompt = JSON.stringify(promptText);
    const jsonService = JSON.stringify(serviceId);
    return `
      (function() {
        try {
          const text = ${jsonPrompt};
          const autoSend = ${autoSubmit};
          const sId = ${jsonService};

          function setVal(elem, str) {
            if (!elem) return false;
            elem.focus();
            if (elem.tagName === 'TEXTAREA' || elem.tagName === 'INPUT') {
              const proto = elem.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
              const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
              if (setter) {
                setter.call(elem, str);
              } else {
                elem.value = str;
              }
              elem.dispatchEvent(new Event('input', { bubbles: true }));
              elem.dispatchEvent(new Event('change', { bubbles: true }));
              return true;
            }
            if (elem.isContentEditable) {
              document.execCommand('selectAll', false, null);
              document.execCommand('insertText', false, str);
              elem.dispatchEvent(new Event('input', { bubbles: true }));
              return true;
            }
            return false;
          }

          let input = null;

          if (sId === 'chatgpt') {
            input = document.querySelector('textarea#prompt-textarea') ||
                    document.querySelector('div#prompt-textarea') ||
                    document.querySelector('div[contenteditable="true"]');
          } else if (sId === 'gemini') {
            input = document.querySelector('rich-textarea .ql-editor') ||
                    document.querySelector('div[contenteditable="true"][aria-label*="prompt"]') ||
                    document.querySelector('textarea[aria-label*="prompt"]') ||
                    document.querySelector('div.textarea[contenteditable="true"]');
          } else if (sId === 'copilot') {
            input = document.querySelector('textarea#userInput') ||
                    document.querySelector('textarea[aria-label*="Ask"]') ||
                    document.querySelector('div[contenteditable="true"]');
            if (!input) {
              const cib = document.querySelector('cib-serp');
              const bar = cib?.shadowRoot?.querySelector('cib-action-bar');
              input = bar?.shadowRoot?.querySelector('textarea#searchbox') ||
                      bar?.shadowRoot?.querySelector('cib-text-input')?.shadowRoot?.querySelector('textarea');
            }
          } else if (sId === 'claude') {
            input = document.querySelector('div.ProseMirror[contenteditable="true"]') ||
                    document.querySelector('fieldset textarea');
          } else if (sId === 'perplexity') {
            input = document.querySelector('textarea[placeholder*="Ask"]') ||
                    document.querySelector('textarea');
          } else {
            input = document.querySelector('textarea, div[contenteditable="true"], input[type="text"]');
          }

          if (input) {
            setVal(input, text);

            if (autoSend) {
              setTimeout(() => {
                let btn = null;
                if (sId === 'chatgpt') {
                  btn = document.querySelector('button[data-testid="send-button"]') ||
                        document.querySelector('button[aria-label*="Send"]');
                } else if (sId === 'gemini') {
                  btn = document.querySelector('button[aria-label*="Send prompt"]') ||
                        document.querySelector('button.send-button');
                } else if (sId === 'copilot') {
                  btn = document.querySelector('button[aria-label="Submit"]') ||
                        document.querySelector('button[aria-label="Send"]');
                  if (!btn) {
                    const cib = document.querySelector('cib-serp');
                    const bar = cib?.shadowRoot?.querySelector('cib-action-bar');
                    btn = bar?.shadowRoot?.querySelector('button[aria-label*="Submit"]');
                  }
                } else if (sId === 'claude') {
                  btn = document.querySelector('button[aria-label="Send Message"]') ||
                        document.querySelector('button[aria-label="Send"]');
                } else if (sId === 'perplexity') {
                  btn = document.querySelector('button[aria-label="Submit"]') ||
                        document.querySelector('button.bg-super');
                }

                if (btn && !btn.disabled) {
                  btn.click();
                } else {
                  input.dispatchEvent(new KeyboardEvent('keydown', {
                    key: 'Enter',
                    code: 'Enter',
                    keyCode: 13,
                    which: 13,
                    bubbles: true
                  }));
                }
              }, 350);
            }
          }
        } catch (e) {
          console.warn('[Sentinel Multi-AI Injection Error]', e);
        }
      })();
    `;
  }

  public insertPresetPrompt(text: string): void {
    const input = document.getElementById('multiAiBroadcastInput') as HTMLTextAreaElement | null;
    if (input) {
      input.value = text;
      input.focus();
      this.updateBroadcastCounts();
    }
    this.state.broadcastPrompt = text;
    this.saveState();
  }

  private updateBroadcastCounts(): void {
    const input = document.getElementById('multiAiBroadcastInput') as HTMLTextAreaElement | null;
    const text = input ? input.value : '';
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const chars = text.length;

    const counter = document.getElementById('multiAiPromptCounter');
    if (counter) {
      counter.textContent = `${words} words • ${chars} chars`;
    }
  }

  private showToast(message: string): void {
    let toast = document.getElementById('multiAiToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'multiAiToast';
      toast.className =
        'fixed bottom-24 right-8 z-[100] px-4 py-2.5 rounded-xl bg-slate-900/95 text-white border border-cyan-400/60 shadow-2xl text-xs font-semibold flex items-center gap-2 transform transition-all duration-300 pointer-events-none opacity-0 translate-y-2';
      document.body.appendChild(toast);
    }

    toast.innerHTML = `<span class="text-cyan-400 text-sm">🛡️</span><span>${message}</span>`;
    toast.classList.remove('opacity-0', 'translate-y-2');
    toast.classList.add('opacity-100', 'translate-y-0');

    setTimeout(() => {
      if (toast) {
        toast.classList.remove('opacity-100', 'translate-y-0');
        toast.classList.add('opacity-0', 'translate-y-2');
      }
    }, 3200);
  }

  private render(): void {
    if (!this.containerEl) return;

    this.containerEl.innerHTML = `
      <!-- MULTI-AI WORKSPACE HEADER & CONTROL BAR -->
      <div class="h-13 px-4 border-b border-intel-border bg-white dark:bg-[#1f2023] flex items-center justify-between gap-3 shrink-0 shadow-2xs z-20">
        <!-- Left: Branding & Multi-AI Badges -->
        <div class="flex items-center gap-3">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-600 via-indigo-600 to-blue-600 flex items-center justify-center text-white text-base shadow-sm">
              🌐
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h2 class="text-xs font-black tracking-tight text-gray-900 dark:text-white uppercase flex items-center gap-1.5">
                  <span>Multi-AI Hub</span>
                  <span class="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border border-purple-300 dark:border-purple-800 font-mono font-bold lowercase">v2.5 convergence</span>
                </h2>
              </div>
              <p class="text-[10px] text-gray-600 dark:text-slate-400 hidden sm:block">
                Synchronized Multi-Browser Station for Microsoft Copilot, Google Gemini, and OpenAI ChatGPT Subscriptions
              </p>
            </div>
          </div>

          <!-- Service Fast Status Badges -->
          <div class="hidden md:flex items-center gap-1.5 ml-2 border-l border-gray-200 dark:border-intel-border pl-3">
            <span class="text-[10px] px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 font-semibold flex items-center gap-1">
              <span class="w-1.5 h-1.5 rounded-full bg-blue-500"></span> Copilot
            </span>
            <span class="text-[10px] px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 font-semibold flex items-center gap-1">
              <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Gemini
            </span>
            <span class="text-[10px] px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 font-semibold flex items-center gap-1">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> ChatGPT
            </span>
          </div>
        </div>

        <!-- Center: Layout Selectors (1. Single, 2. Dual, 3. 3-Split, 4. 4-Split, 5. 5-Split, 6. All) -->
        <div class="flex items-center bg-gray-100 dark:bg-intel-850 p-0.5 rounded-xl border border-gray-200 dark:border-intel-border text-xs shrink-0 shadow-inner overflow-x-auto max-w-[58vw]">
          <button id="multiAiLayoutSingleBtn" type="button" class="px-2 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer shrink-0 ${this.state.layout === 'single' ? 'bg-purple-600 text-white shadow-xs' : 'text-gray-700 dark:text-slate-300 hover:text-gray-950 dark:hover:text-white'}" title="1. Single AI Focus View">
            <span>🔲</span>
            <span class="text-[11px]">Single</span>
          </button>
          <button id="multiAiLayoutDualBtn" type="button" class="px-2 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer shrink-0 ${this.state.layout === 'dual' ? 'bg-purple-600 text-white shadow-xs' : 'text-gray-700 dark:text-slate-300 hover:text-gray-950 dark:hover:text-white'}" title="2. Dual Side-by-Side (2 Columns, 1 Row)">
            <span>◫</span>
            <span class="text-[11px]">Dual</span>
          </button>
          <button id="multiAiLayoutTripleBtn" type="button" class="px-2 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer shrink-0 ${this.state.layout === 'triple' ? 'bg-purple-600 text-white shadow-xs' : 'text-gray-700 dark:text-slate-300 hover:text-gray-950 dark:hover:text-white'}" title="3. 3-Split (3 Columns, 1 Row)">
            <span>▥</span>
            <span class="text-[11px]">3-Split</span>
          </button>
          <button id="multiAiLayoutQuadBtn" type="button" class="px-2 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer shrink-0 ${this.state.layout === 'quad' ? 'bg-purple-600 text-white shadow-xs' : 'text-gray-700 dark:text-slate-300 hover:text-gray-950 dark:hover:text-white'}" title="4. 4-Split (2x2 Grid)">
            <span>⊞</span>
            <span class="text-[11px]">4-Split</span>
          </button>
          <button id="multiAiLayoutPentaBtn" type="button" class="px-2 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer shrink-0 ${this.state.layout === 'penta' ? 'bg-purple-600 text-white shadow-xs' : 'text-gray-700 dark:text-slate-300 hover:text-gray-950 dark:hover:text-white'}" title="5. 5-Split (5 AIs in a 3-Column Grid)">
            <span>☷</span>
            <span class="text-[11px]">5-Split</span>
          </button>
          <button id="multiAiLayoutAllBtn" type="button" class="px-2 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer shrink-0 ${this.state.layout === 'all' ? 'bg-purple-600 text-white shadow-xs' : 'text-gray-700 dark:text-slate-300 hover:text-gray-950 dark:hover:text-white'}" title="6. All (6 AIs in a 3-Column Grid including Custom URL)">
            <span>▦</span>
            <span class="text-[11px]">All (6 AIs)</span>
          </button>
        </div>

        <!-- Right: Actions (+ Pane, Capture Chat, Session Cookie Guide, Close / Back to Local) -->
        <div class="flex items-center gap-2">
          <!-- Capture Chat Button -->
          <button
            id="multiAiHeaderCaptureBtn"
            type="button"
            onclick="window.multiAiHub.captureActiveAiChats()"
            class="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition cursor-pointer"
            title="Capture chats from all active visible AIs and save to Sentinel Session History"
          >
            <span>💾</span>
            <span class="hidden sm:inline">Capture Chat</span>
          </button>

          <!-- Add Browser Pane Button -->
          <div class="relative group">
            <button id="multiAiAddPaneBtn" type="button" class="px-2.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition cursor-pointer" title="Add another AI browser pane">
              <span>+</span>
              <span class="hidden sm:inline">Add Browser</span>
            </button>
          </div>

          <!-- Subscription Login Help Pill -->
          <button id="multiAiLoginHelpBtn" type="button" class="p-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-intel-850 dark:hover:bg-intel-800 text-gray-700 dark:text-slate-300 border border-gray-200 dark:border-intel-border transition cursor-pointer" title="Subscription Login & Cookie Guide">
            <span class="text-xs">🔑</span>
          </button>

          <!-- Return to Sentinel Local Intelligence Chat -->
          <button id="multiAiCloseBtn" type="button" class="px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-intel-850 dark:hover:bg-intel-800 text-gray-800 dark:text-slate-200 hover:text-gray-950 dark:hover:text-white border border-gray-300 dark:border-intel-border transition text-xs font-bold flex items-center gap-1.5 cursor-pointer" title="Return to Sentinel Local Studio & Chat">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
            <span class="hidden sm:inline">Sentinel Chat</span>
          </button>
        </div>
      </div>

      <!-- MAIN PANES VIEWPORT -->
      <div id="multiAiPanesViewport" class="flex-1 overflow-hidden p-2 sm:p-3 bg-gray-100 dark:bg-[#121316] relative flex flex-col">
        <div id="multiAiPanesGrid" class="flex-1 grid gap-2.5 sm:gap-3.5 h-full overflow-hidden transition-all duration-200">
          <!-- Rendered dynamically by renderPanesGrid() -->
        </div>
      </div>

      <!-- UNIVERSAL PROMPT SYNCHRONIZER DOCK -->
      <div class="border-t border-intel-border bg-white dark:bg-[#1f2023] p-3 shrink-0 shadow-lg z-20">
        <div class="max-w-6xl mx-auto flex flex-col gap-2">
          <!-- Quick Preset Prompts Bar -->
          <div class="flex items-center justify-between gap-2 overflow-x-auto text-xs pb-0.5">
            <div class="flex items-center gap-1.5 shrink-0">
              <span class="text-[10px] font-extrabold text-purple-600 dark:text-purple-400 uppercase tracking-wider flex items-center gap-1 shrink-0">
                <span>⚡</span> Prompt Sync:
              </span>
              <button onclick="window.multiAiHub.insertPresetPrompt('Compare how Copilot, Gemini, and ChatGPT evaluate this internal audit risk: ')" class="px-2 py-0.5 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-intel-850 dark:hover:bg-intel-800 text-gray-800 dark:text-slate-200 text-[11px] font-medium border border-gray-200 dark:border-intel-border transition shrink-0 cursor-pointer">
                Audit Risk Comparison
              </button>
              <button onclick="window.multiAiHub.insertPresetPrompt('Draft an executive summary memo for Management Committee regarding: ')" class="px-2 py-0.5 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-intel-850 dark:hover:bg-intel-800 text-gray-800 dark:text-slate-200 text-[11px] font-medium border border-gray-200 dark:border-intel-border transition shrink-0 cursor-pointer">
                Executive Memo
              </button>
              <button onclick="window.multiAiHub.insertPresetPrompt('Fact-check and identify policy variances or hallucinations in this statement: ')" class="px-2 py-0.5 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-intel-850 dark:hover:bg-intel-800 text-gray-800 dark:text-slate-200 text-[11px] font-medium border border-gray-200 dark:border-intel-border transition shrink-0 cursor-pointer">
                Fact-Check & Hallucination Trace
              </button>
              <button onclick="window.multiAiHub.insertPresetPrompt('Synthesize 3 distinct strategic perspectives (conservative audit, operational speed, risk governance) for: ')" class="px-2 py-0.5 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-intel-850 dark:hover:bg-intel-800 text-gray-800 dark:text-slate-200 text-[11px] font-medium border border-gray-200 dark:border-intel-border transition shrink-0 cursor-pointer">
                Tri-Perspective Synthesis
              </button>
            </div>
            <div id="multiAiPromptCounter" class="text-[10px] font-mono text-gray-500 dark:text-slate-400 shrink-0">
              0 words • 0 chars
            </div>
          </div>

          <!-- Broadcast Input Box -->
          <div class="flex items-end gap-2.5">
            <div class="flex-1 bg-gray-50 dark:bg-[#121316] border border-gray-300 dark:border-intel-border rounded-2xl p-2.5 focus-within:border-purple-500 focus-within:ring-1 focus-within:ring-purple-500 transition shadow-inner">
              <textarea
                id="multiAiBroadcastInput"
                rows="2"
                placeholder="Type your prompt here once to broadcast or paste across Microsoft Copilot, Google Gemini, and OpenAI ChatGPT..."
                class="w-full bg-transparent text-gray-900 dark:text-slate-100 text-xs focus:outline-none resize-none leading-relaxed"
              >${this.state.broadcastPrompt}</textarea>
            </div>

            <div class="flex items-center gap-1.5 shrink-0 flex-wrap">
              <button
                id="multiAiAutoSubmitToggleBtn"
                type="button"
                class="px-2.5 py-1 rounded-xl text-[10px] font-bold border transition flex items-center gap-1.5 cursor-pointer ${
                  this.state.autoSubmit
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-400 dark:border-emerald-600/50'
                    : 'bg-gray-100 dark:bg-intel-850 text-gray-500 dark:text-slate-400 border-gray-300 dark:border-intel-border'
                }"
                title="When ON: Automatically types and clicks Send in desktop station browsers. When OFF: Fills inputs only."
              >
                <span>${this.state.autoSubmit ? '🟢' : '⚪'}</span>
                <span>Auto-Send: ${this.state.autoSubmit ? 'ON' : 'OFF'}</span>
              </button>

              <button
                id="multiAiBroadcastSendBtn"
                type="button"
                class="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold text-xs shadow-md flex items-center justify-center gap-2 transition cursor-pointer"
                title="Broadcast prompt to all active AI browser panes"
              >
                <span class="text-sm">⚡</span>
                <span>Broadcast to All</span>
              </button>

              <button
                id="multiAiDockCaptureBtn"
                type="button"
                onclick="window.multiAiHub.captureActiveAiChats()"
                class="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md flex items-center justify-center gap-1.5 transition cursor-pointer"
                title="Capture chats from all active visible AIs and save to Sentinel Session History"
              >
                <span>💾</span>
                <span>Capture Chat</span>
              </button>

              <button
                id="multiAiCopyPromptBtn"
                type="button"
                class="px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-intel-850 dark:hover:bg-intel-800 text-gray-800 dark:text-slate-200 border border-gray-300 dark:border-intel-border text-[11px] font-semibold flex items-center justify-center gap-1 transition cursor-pointer"
                title="Copy prompt text to clipboard"
              >
                <span>📋</span>
                <span>Copy</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- SUBSCRIPTION LOGIN & COOKIE MODAL -->
      <div id="multiAiLoginModal" class="hidden fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
        <div class="w-full max-w-lg bg-white dark:bg-intel-900 border border-gray-300 dark:border-intel-border rounded-2xl p-6 shadow-2xl relative space-y-4">
          <div class="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-intel-border">
            <div class="flex items-center gap-2.5">
              <div class="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-300 flex items-center justify-center text-lg">
                🔑
              </div>
              <div>
                <h3 class="text-sm font-bold text-gray-900 dark:text-white">AI Subscription Login &amp; Cookies</h3>
                <p class="text-[11px] text-gray-600 dark:text-slate-400">Enterprise authentication &amp; persistent workstation storage</p>
              </div>
            </div>
            <button id="closeMultiAiLoginModalBtn" class="text-gray-400 hover:text-gray-700 dark:hover:text-white text-lg">✕</button>
          </div>

          <div class="space-y-3 text-xs leading-relaxed text-gray-700 dark:text-slate-300">
            <div class="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60">
              <h4 class="font-bold text-blue-800 dark:text-blue-300 flex items-center gap-1.5 mb-1">
                <span>🔵</span> Microsoft Copilot
              </h4>
              <p>Log into your Microsoft 365 Work/School Account or Personal MSA directly in the pane or click <strong>↗ Popout Companion</strong> to complete two-factor authentication (2FA). Your session is stored in the persistent partition <code>persist:sentinel_copilot</code>.</p>
            </div>

            <div class="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60">
              <h4 class="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5 mb-1">
                <span>✨</span> Google Gemini
              </h4>
              <p>Log in with your Google Workspace or Gmail account for Gemini Advanced. To protect passkeys and WebAuthn, Sentinel Studio uses the <strong>Desktop App OAuth 2.0 Loopback Flow</strong> (RFC 8252) via your system browser rather than blocking inside embedded webviews.</p>
            </div>

            <div class="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60">
              <h4 class="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5 mb-1">
                <span>🟢</span> OpenAI ChatGPT
              </h4>
              <p>Access your ChatGPT Plus or Team account. Cookies, Cloudflare verification, and session tokens remain cached persistently in <code>persist:sentinel_chatgpt</code>.</p>
            </div>
          </div>

          <div class="pt-2 flex justify-end">
            <button id="acknowledgeLoginModalBtn" class="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-xs shadow cursor-pointer">
              Understood
            </button>
          </div>
        </div>
      </div>
    `;

    this.renderPanesGrid();
    this.updateLayoutButtons();
    this.attachDomHandlers();
  }

  private renderPanesGrid(): void {
    const gridEl = document.getElementById('multiAiPanesGrid');
    if (!gridEl) return;

    // Apply CSS layout classes
    const layout = this.state.layout;
    gridEl.className = 'flex-1 grid gap-2 sm:gap-3 h-full overflow-hidden transition-all duration-200';

    if (this.state.panes.some((p) => p.isMaximized)) {
      gridEl.classList.add('grid-cols-1', 'grid-rows-1');
    } else if (layout === 'single') {
      // 1. Single (1 Focus AI)
      gridEl.classList.add('grid-cols-1', 'grid-rows-1');
    } else if (layout === 'dual') {
      // 2. Dual (side by side: 2 columns, 1 row)
      gridEl.classList.add('grid-cols-1', 'md:grid-cols-2', 'grid-rows-1');
    } else if (layout === 'triple') {
      // 3. 3-Split (strictly 3 columns, 1 row)
      gridEl.classList.add('grid-cols-1', 'md:grid-cols-3', 'grid-rows-1');
    } else if (layout === 'quad') {
      // 4. 4-Split (2x2 grid)
      gridEl.classList.add('grid-cols-1', 'md:grid-cols-2', 'grid-rows-2');
    } else if (layout === 'penta') {
      // 5. 5-Split (5 AIs in a 3-column grid)
      gridEl.classList.add('grid-cols-1', 'md:grid-cols-3', 'grid-rows-2');
    } else if (layout === 'all') {
      // 6. All (6 AIs in a 3x2 grid: 5 AIs + Custom URL browser)
      gridEl.classList.add('grid-cols-1', 'md:grid-cols-3', 'grid-rows-2');
    }

    const isDesktop = typeof (window as any).sentinelDesktop !== 'undefined' && !!(window as any).sentinelDesktop.isDesktop;

    let targetCount = 3;
    if (layout === 'single') targetCount = 1;
    else if (layout === 'dual') targetCount = 2;
    else if (layout === 'triple') targetCount = 3;
    else if (layout === 'quad') targetCount = 4;
    else if (layout === 'penta') targetCount = 5;
    else if (layout === 'all') targetCount = 6;

    let visiblePanes: BrowserPane[] = [];
    if (this.state.panes.some((p) => p.isMaximized)) {
      visiblePanes = this.state.panes.filter((p) => p.isMaximized);
    } else if (layout === 'single') {
      const active = this.state.panes.find((p) => p.id === this.state.activePaneId);
      visiblePanes = active ? [active] : this.state.panes.slice(0, 1);
    } else {
      visiblePanes = this.state.panes.slice(0, targetCount);
    }

    gridEl.innerHTML = visiblePanes
      .map((pane) => {
        const service = AI_SERVICES.find((s) => s.id === pane.serviceId) || AI_SERVICES[0];

        // Service dropdown options
        const serviceOptions = AI_SERVICES.map(
          (s) => `<option value="${s.id}" ${s.id === pane.serviceId ? 'selected' : ''}>${s.icon} ${s.shortName}</option>`
        ).join('');

        // Active Google Session Details
        const googleState = googleAuth.getState();
        const googleUser = googleState.user;
        const isGoogleAuth = googleState.status === 'authenticated' && !!googleUser;

        // Custom SSO / Account Header Bar for Google-connected services (Gemini, ChatGPT)
        let ssoHeaderBar = '';

        if (pane.serviceId === 'gemini') {
          if (isGoogleAuth && googleUser) {
            ssoHeaderBar = `
              <div class="px-3 py-1.5 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-100 dark:from-emerald-950/80 dark:via-teal-950/80 dark:to-emerald-900/80 border-b border-emerald-300 dark:border-emerald-700 text-xs flex items-center justify-between gap-2 shrink-0 select-none shadow-2xs">
                <div class="flex items-center gap-2 truncate">
                  <div class="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0 shadow-xs">
                    ${googleUser.picture ? `<img src="${googleUser.picture}" class="w-full h-full rounded-full object-cover" onerror="this.remove()" />` : (googleUser.name || 'G').charAt(0).toUpperCase()}
                  </div>
                  <div class="flex items-center gap-1.5 truncate">
                    <span class="font-bold text-emerald-950 dark:text-emerald-100 truncate">${googleUser.name}</span>
                    <span class="text-[10px] text-emerald-700 dark:text-emerald-300 font-mono truncate">(${googleUser.email})</span>
                  </div>
                  <span class="hidden sm:inline-block text-[9px] px-2 py-0.2 rounded-full bg-emerald-200 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-200 font-mono font-bold shrink-0">✓ Google Account Active</span>
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                  <button onclick="window.multiAiHub.reloadPane('${pane.id}')" class="px-2 py-0.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] transition cursor-pointer shadow-2xs">
                    🔄 Reload
                  </button>
                  <button onclick="window.multiAiHub.openCompanion('${pane.id}')" class="px-2 py-0.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-[10px] transition cursor-pointer shadow-2xs">
                    ↗ Popout Companion
                  </button>
                </div>
              </div>
            `;
          } else {
            ssoHeaderBar = `
              <div class="px-3 py-1.5 bg-amber-50 dark:bg-amber-950/80 border-b border-amber-300 dark:border-amber-700 text-xs flex items-center justify-between gap-2 shrink-0 select-none">
                <div class="flex items-center gap-2 truncate">
                  <span class="text-amber-600 dark:text-amber-400 font-bold">✨ Google Gemini:</span>
                  <span class="text-amber-900 dark:text-amber-200 text-[11px] truncate">Connect your Google Account for Gemini Advanced</span>
                </div>
                <button onclick="window.googleAuth.signIn()" class="px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-bold transition shadow-xs cursor-pointer shrink-0 flex items-center gap-1.5">
                  <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24"><path fill="#ffffff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/></svg>
                  <span>Sign in with Google</span>
                </button>
              </div>
            `;
          }
        } else if (pane.serviceId === 'chatgpt') {
          if (isGoogleAuth && googleUser) {
            ssoHeaderBar = `
              <div class="px-3 py-1.5 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-100 dark:from-emerald-950/80 dark:via-teal-950/80 dark:to-emerald-900/80 border-b border-emerald-300 dark:border-emerald-700 text-xs flex items-center justify-between gap-2 shrink-0 select-none shadow-2xs">
                <div class="flex items-center gap-2 truncate">
                  <div class="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0 shadow-xs">
                    ${googleUser.picture ? `<img src="${googleUser.picture}" class="w-full h-full rounded-full object-cover" onerror="this.remove()" />` : (googleUser.name || 'G').charAt(0).toUpperCase()}
                  </div>
                  <div class="flex items-center gap-1.5 truncate">
                    <span class="font-bold text-emerald-950 dark:text-emerald-100 truncate">ChatGPT Google SSO:</span>
                    <span class="text-[10px] text-emerald-700 dark:text-emerald-300 font-mono truncate">${googleUser.email}</span>
                  </div>
                  <span class="hidden sm:inline-block text-[9px] px-2 py-0.2 rounded-full bg-emerald-200 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-200 font-mono font-bold shrink-0">✓ Google Credentials Ready</span>
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                  <button onclick="window.multiAiHub.openCompanion('${pane.id}')" class="px-2.5 py-0.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] transition cursor-pointer shadow-2xs flex items-center gap-1">
                    <span>🔑</span> Log In with Google (${googleUser.email})
                  </button>
                  <button onclick="window.multiAiHub.reloadPane('${pane.id}')" class="px-2 py-0.5 rounded-lg bg-gray-200 dark:bg-intel-800 text-gray-800 dark:text-slate-200 font-bold text-[10px] transition cursor-pointer">
                    🔄 Reload
                  </button>
                </div>
              </div>
            `;
          } else {
            ssoHeaderBar = `
              <div class="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/60 border-b border-emerald-200 dark:border-emerald-800 text-xs flex items-center justify-between gap-2 shrink-0 select-none">
                <div class="flex items-center gap-2 truncate">
                  <span class="text-emerald-700 dark:text-emerald-300 font-bold">🟢 OpenAI ChatGPT:</span>
                  <span class="text-emerald-900 dark:text-emerald-200 text-[11px] truncate">Use Google Account for ChatGPT Plus & Team SSO</span>
                </div>
                <button onclick="window.googleAuth.signIn()" class="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold transition shadow-xs cursor-pointer shrink-0 flex items-center gap-1">
                  <span>🔑</span> Sign in with Google Account
                </button>
              </div>
            `;
          }
        }

        // Embedded Live Browser Frame for all services
        let browserElement = '';
        if (isDesktop) {
          browserElement = `
            <webview
              id="${pane.serviceId}Webview"
              src="${pane.currentUrl}"
              partition="persist:sentinel_ai_workspace"
              useragent="${CHROME_UA}"
              allowpopups="true"
              webpreferences="contextIsolation=yes"
              class="w-full h-full border-0 bg-white"
            ></webview>
          `;
        } else {
          // Web preview mode: resilient iframe with live companion helper
          browserElement = `
            <div class="w-full h-full relative flex flex-col bg-white">
              <iframe
                id="browser_frame_${pane.id}"
                src="${pane.currentUrl}"
                sandbox="allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts allow-storage-access-by-user-activation"
                allow="clipboard-read; clipboard-write; microphone; camera"
                class="w-full flex-1 border-none bg-white"
              ></iframe>
              <!-- Web Preview Companion Quick Launcher Bar for Sites Restricting Iframe Embedding -->
              <div class="px-3 py-1.5 bg-gray-50 dark:bg-intel-900 border-t border-gray-200 dark:border-intel-border text-[11px] flex items-center justify-between text-gray-700 dark:text-slate-300">
                <span class="flex items-center gap-1.5 truncate">
                  <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span class="font-semibold">${service.name} Live Session</span>
                  ${isGoogleAuth && (pane.serviceId === 'gemini' || pane.serviceId === 'chatgpt') ? `<span class="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-bold">(${googleUser?.email})</span>` : ''}
                </span>
                <button onclick="window.multiAiHub.openCompanion('${pane.id}')" class="px-2 py-0.5 rounded bg-purple-600 hover:bg-purple-700 text-white font-bold text-[10px] transition cursor-pointer flex items-center gap-1">
                  <span>↗</span> Popout Window
                </button>
              </div>
            </div>
          `;
        }

        const singleFocusBar = layout === 'single' ? `
          <div class="px-3 py-1.5 bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50 dark:from-purple-950/60 dark:via-indigo-950/60 dark:to-blue-950/60 border-b border-purple-200 dark:border-purple-900/50 flex items-center gap-1.5 overflow-x-auto text-xs shrink-0 select-none">
            <span class="text-[10px] font-extrabold uppercase tracking-wider text-purple-700 dark:text-purple-300 mr-1 flex items-center gap-1 shrink-0">
              <span>🎯</span> Focus AI:
            </span>
            ${AI_SERVICES.map((s) => `
              <button
                onclick="window.multiAiHub.switchSingleFocus('${s.id}')"
                class="px-2.5 py-1 rounded-lg text-xs font-bold border transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
                  pane.serviceId === s.id
                    ? 'bg-purple-600 text-white border-purple-500 shadow-xs'
                    : 'bg-white dark:bg-intel-850 text-gray-700 dark:text-slate-300 border-gray-300 dark:border-intel-border hover:bg-gray-100 dark:hover:bg-intel-800'
                }"
              >
                <span>${s.icon}</span>
                <span>${s.shortName}</span>
              </button>
            `).join('')}
          </div>
        ` : '';

        return `
          <div
            id="pane_container_${pane.id}"
            class="flex flex-col bg-white dark:bg-[#1e1f23] border border-gray-300 dark:border-intel-border rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow relative min-w-0 min-h-0"
          >
            ${singleFocusBar}
            ${ssoHeaderBar}
            <!-- PANE BROWSER TOP NAVIGATION & CONTROLS -->
            <div class="p-2 border-b border-gray-200 dark:border-intel-border bg-gray-50 dark:bg-[#25262b] flex items-center justify-between gap-1.5 shrink-0">
              <!-- Left: Service Selector & Logo -->
              <div class="flex items-center gap-1.5 shrink-0">
                <span class="text-base select-none">${service.icon}</span>
                <select
                  onchange="window.multiAiHub.setPaneService('${pane.id}', this.value)"
                  class="bg-white dark:bg-intel-850 border border-gray-300 dark:border-intel-border text-gray-900 dark:text-slate-100 text-[11px] font-bold rounded-lg px-2 py-1 focus:outline-none focus:border-purple-500 cursor-pointer"
                  title="Switch AI Subscription"
                >
                  ${serviceOptions}
                </select>
              </div>

              <!-- Center: Nav buttons & Address Bar -->
              <div class="flex items-center gap-1 flex-1 min-w-0">
                <button onclick="window.multiAiHub.reloadPane('${pane.id}')" class="p-1 rounded-lg hover:bg-gray-200 dark:hover:bg-intel-800 text-gray-600 dark:text-slate-300 transition cursor-pointer" title="Reload Browser">
                  🔄
                </button>
                <button onclick="window.multiAiHub.goHome('${pane.id}')" class="p-1 rounded-lg hover:bg-gray-200 dark:hover:bg-intel-800 text-gray-600 dark:text-slate-300 transition cursor-pointer" title="Go to Default URL">
                  🏠
                </button>
                <input
                  type="text"
                  id="url_input_${pane.id}"
                  value="${pane.currentUrl}"
                  onkeydown="if(event.key==='Enter') window.multiAiHub.navigatePane('${pane.id}', this.value)"
                  placeholder="https://..."
                  class="flex-1 min-w-0 bg-white dark:bg-intel-900 border border-gray-300 dark:border-intel-border text-gray-900 dark:text-slate-200 text-[11px] px-2.5 py-1 rounded-lg focus:outline-none focus:border-purple-500 font-mono truncate"
                  title="Press Enter to navigate"
                />
              </div>

              <!-- Right: Zoom, Popout, Maximize, Remove -->
              <div class="flex items-center gap-1 shrink-0">
                <!-- Zoom Controls -->
                <div class="hidden sm:flex items-center bg-gray-200/70 dark:bg-intel-850 rounded-lg p-0.5 border border-gray-300 dark:border-intel-border text-[10px]">
                  <button onclick="window.multiAiHub.zoomPane('${pane.id}', -0.1)" class="px-1.5 py-0.5 hover:bg-gray-300 dark:hover:bg-intel-800 rounded text-gray-700 dark:text-slate-300 cursor-pointer" title="Zoom Out">-</button>
                  <span id="zoom_badge_${pane.id}" class="px-1 font-mono font-bold text-gray-700 dark:text-slate-300">${Math.round(pane.zoomLevel * 100)}%</span>
                  <button onclick="window.multiAiHub.zoomPane('${pane.id}', 0.1)" class="px-1.5 py-0.5 hover:bg-gray-300 dark:hover:bg-intel-800 rounded text-gray-700 dark:text-slate-300 cursor-pointer" title="Zoom In">+</button>
                </div>

                <!-- Launch Connected Companion Window -->
                <button onclick="window.multiAiHub.openCompanion('${pane.id}')" class="p-1 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-950/60 text-purple-700 dark:text-purple-300 transition cursor-pointer" title="Popout into dedicated companion window for full Google/Microsoft logins">
                  ↗️
                </button>

                <!-- Maximize / Restore -->
                <button onclick="window.multiAiHub.toggleMaximize('${pane.id}')" class="p-1 rounded-lg hover:bg-gray-200 dark:hover:bg-intel-800 text-gray-600 dark:text-slate-300 transition cursor-pointer" title="${pane.isMaximized ? 'Restore View' : 'Maximize Pane'}">
                  ${pane.isMaximized ? '🗗' : '⛶'}
                </button>

                <!-- Remove Pane (if more than 1 pane) -->
                ${
                  this.state.panes.length > 1
                    ? `
                  <button onclick="window.multiAiHub.removePane('${pane.id}')" class="p-1 rounded-lg hover:bg-red-100 dark:hover:bg-red-950/60 text-gray-400 hover:text-red-600 transition cursor-pointer" title="Close this Pane">
                    ✕
                  </button>
                `
                    : ''
                }
              </div>
            </div>

            <!-- BROWSER CONTENT CANVAS -->
            <div class="flex-1 relative overflow-hidden bg-white">
              ${browserElement}
            </div>
          </div>
        `;
      })
      .join('');
  }

  private updateLayoutButtons(): void {
    const layout = this.state.layout;
    const btnIds: Record<string, string> = {
      single: 'multiAiLayoutSingleBtn',
      dual: 'multiAiLayoutDualBtn',
      triple: 'multiAiLayoutTripleBtn',
      quad: 'multiAiLayoutQuadBtn',
      penta: 'multiAiLayoutPentaBtn',
      all: 'multiAiLayoutAllBtn',
    };

    Object.entries(btnIds).forEach(([key, id]) => {
      const el = document.getElementById(id);
      if (el) {
        if (key === layout) {
          el.className =
            'px-2 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer shrink-0 bg-purple-600 text-white shadow-xs';
        } else {
          el.className =
            'px-2 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer shrink-0 text-gray-700 dark:text-slate-300 hover:text-gray-950 dark:hover:text-white';
        }
      }
    });
  }

  private attachDomHandlers(): void {
    const singleBtn = document.getElementById('multiAiLayoutSingleBtn');
    if (singleBtn) singleBtn.onclick = () => this.setLayout('single');

    const dualBtn = document.getElementById('multiAiLayoutDualBtn');
    if (dualBtn) dualBtn.onclick = () => this.setLayout('dual');

    const tripleBtn = document.getElementById('multiAiLayoutTripleBtn');
    if (tripleBtn) tripleBtn.onclick = () => this.setLayout('triple');

    const quadBtn = document.getElementById('multiAiLayoutQuadBtn');
    if (quadBtn) quadBtn.onclick = () => this.setLayout('quad');

    const pentaBtn = document.getElementById('multiAiLayoutPentaBtn');
    if (pentaBtn) pentaBtn.onclick = () => this.setLayout('penta');

    const allBtn = document.getElementById('multiAiLayoutAllBtn');
    if (allBtn) allBtn.onclick = () => this.setLayout('all');

    const addPaneBtn = document.getElementById('multiAiAddPaneBtn');
    if (addPaneBtn) addPaneBtn.onclick = () => this.addPane('custom');

    const closeBtn = document.getElementById('multiAiCloseBtn');
    if (closeBtn) closeBtn.onclick = () => this.close();

    const broadcastSendBtn = document.getElementById('multiAiBroadcastSendBtn');
    if (broadcastSendBtn) broadcastSendBtn.onclick = () => this.broadcastPrompt();

    const autoSubmitBtn = document.getElementById('multiAiAutoSubmitToggleBtn');
    if (autoSubmitBtn) autoSubmitBtn.onclick = () => this.toggleAutoSubmit();

    const copyPromptBtn = document.getElementById('multiAiCopyPromptBtn');
    if (copyPromptBtn) {
      copyPromptBtn.onclick = () => {
        const input = document.getElementById('multiAiBroadcastInput') as HTMLTextAreaElement | null;
        if (input && input.value.trim()) {
          navigator.clipboard.writeText(input.value.trim());
          this.showToast('📋 Prompt copied to clipboard!');
        } else {
          this.showToast('Please type a prompt first.');
        }
      };
    }

    const broadcastInput = document.getElementById('multiAiBroadcastInput') as HTMLTextAreaElement | null;
    if (broadcastInput) {
      broadcastInput.oninput = () => {
        this.updateBroadcastCounts();
        this.state.broadcastPrompt = broadcastInput.value;
      };
      broadcastInput.onkeydown = (e: KeyboardEvent) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          this.broadcastPrompt();
        }
      };
    }

    // Login modal triggers
    const loginHelpBtn = document.getElementById('multiAiLoginHelpBtn');
    const loginModal = document.getElementById('multiAiLoginModal');
    const closeLoginModalBtn = document.getElementById('closeMultiAiLoginModalBtn');
    const ackLoginModalBtn = document.getElementById('acknowledgeLoginModalBtn');

    if (loginHelpBtn && loginModal) {
      loginHelpBtn.onclick = () => loginModal.classList.remove('hidden');
    }
    if (closeLoginModalBtn && loginModal) {
      closeLoginModalBtn.onclick = () => loginModal.classList.add('hidden');
    }
    if (ackLoginModalBtn && loginModal) {
      ackLoginModalBtn.onclick = () => loginModal.classList.add('hidden');
    }
  }

  private attachGlobalListeners(): void {
    // Keyboard shortcut: Ctrl + Shift + M or Alt + M to toggle Multi-AI Hub
    document.addEventListener('keydown', (e: KeyboardEvent) => {
      if ((e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'm') || (e.altKey && e.key.toLowerCase() === 'm')) {
        e.preventDefault();
        this.toggle();
      }
    });

    // Wire up header toggle button
    const toggleBtn = document.getElementById('toggleMultiAiBtn');
    if (toggleBtn) {
      toggleBtn.onclick = () => this.toggle();
    }

    // Wire up sidebar toggle button if present
    const sidebarBtn = document.getElementById('sidebarMultiAiBtn');
    if (sidebarBtn) {
      sidebarBtn.onclick = () => this.toggle();
    }
  }
}

// Global instance handle
let globalMultiAiHub: MultiAiHubManager | null = null;

export function initMultiAiHub(): MultiAiHubManager {
  if (!globalMultiAiHub) {
    globalMultiAiHub = new MultiAiHubManager();
    (window as any).multiAiHub = globalMultiAiHub;
    globalMultiAiHub.init();
  }
  return globalMultiAiHub;
}
