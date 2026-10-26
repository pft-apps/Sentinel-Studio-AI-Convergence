# Sentinel Studio™ — Step 3: Executive Multi-AI & Knowledge OS Workstation

**Architect & Developer:** Patrick Jay F. Tanap, CPA, CICA  
**Platform Version:** 2.5.0 (Step 3 Multi-Target Workstation Active)  
**Enterprise Framework:** ERI × EPEx Capability Hub

---

## 1. Architectural Overview & Dual-Environment Resilience (Poka-Yoke)

Step 3 elevates **Sentinel Studio™** into a sovereign Multi-AI Orchestration & Knowledge OS Workstation. Users can dispatch prompts across local edge models and persistent enterprise AI portals (Microsoft Copilot, OpenAI ChatGPT, Google Gemini), compare outputs side-by-side, synthesize consensus, and distill durable rules directly into the IndexedDB Memory Vault.

### Dual-Environment Detection
```typescript
const isDesktop = typeof (window as any).sentinelDesktop !== 'undefined' && (window as any).sentinelDesktop.isDesktop;
```

1. **Desktop Mode (Electron Portable `.exe`):**
   - Renders native `<webview>` instances with:
     - `partition="persist:sentinel_ai_workspace"`
     - `allowpopups="true"`
     - `webpreferences="contextIsolation=yes"`
   - Enterprise Single Sign-On (SSO) credentials, cookies, and tokens persist indefinitely across application restarts in a sandboxed user partition.
   - Headers sanitized via `configurePartitionHeaders` in `main.js` so frame ancestors do not block embeds.

2. **Web Preview Fallback (Google AI Studio / Standard Browsers):**
   - Automatically detects non-desktop browser runtimes.
   - Renders authentic, interactive enterprise simulation panes with active partition badges:  
     `[ 🌐 Browser Preview Mode: Native Multi-Session Partition Active in Desktop .exe ]`
   - Fully interactive: supports in-pane prompt input, sample dispatches, realistic enterprise intelligence generation, quick clipboard copying, and immediate transfer to Work Desk and Memory Hub.
   - Poka-Yoke: Never throws unhandled DOM or iframe exceptions.

---

## 2. Multi-Target Engine Dispatch Bar

Located directly above the input prompt bar (`#engineDispatchBar`):
- **Dispatch Selectors:**
  - `[ ⚡ Local Edge ]`: Directs prompts to on-device WebGPU/LiteRT neural weights (Qwen 2.5 / Gemma 4), keeping all computation completely local.
  - `[ 🔷 Copilot ]`: Dispatches to Microsoft Copilot with M365 Business Graph & compliance citations.
  - `[ 🟢 ChatGPT ]`: Dispatches to OpenAI ChatGPT with quantitative variance modeling & FMEA matrices.
  - `[ 🔵 Gemini ]`: Dispatches to Google Gemini 2.5 Pro with multimodal synthesis and executive presentation slides.
  - `[ 🌐 Broadcast All ]`: Dispatches simultaneously to the local edge engine and all external enterprise panes.
- **Prompt Synchronization:** Automatically copies prompt text to the system clipboard with an informative toast notification: `[ Prompt Copied for Enterprise AI Session ]`.

---

## 3. Persistent Workspace Panes & View Modes

Integrated alongside the Canvas/Work Desk with an interactive horizontal split resizer (`#multiAiResizer`):
- **View Modes:**
  - `Single View`: Maximized view of the active selected enterprise engine.
  - `Split Compare View`: 50/50 comparison pane between Local Edge or secondary engine and primary engine.
  - `Executive Synthesis Grid`: 3-column multi-pane evaluation matrix across Copilot, ChatGPT, and Gemini.
- **Engine Tab Strip (`#multiAiEngineTabs`):** Instant switching between Copilot, ChatGPT, and Gemini with active session indicator dots.
- **Session Controls:** Fast reload button and external browser tab pop-out button.

---

## 4. Multi-Engine Synthesis Tray & Work Desk Integration

Action bar docked at the bottom of the multi-AI workstation container (`#multiEngineSynthesisTray`):
1. **`[ 📥 Import to Work Desk ]`**:
   - Opens `#importDeskModal` with format auto-detection:
     - `.docx` Executive Observation Memorandum
     - `.xlsx` Tabular Audit Ledger / Reconciliation Grid
     - `.pptx` 16:9 Presentation Slides
   - Loads content directly into `#workDeskEditor` and synchronizes with Canvas and Notepad views.
2. **`[ ⚡ Synthesize Best ]`**:
   - Compares findings across loaded engines.
   - Identifies consensus findings (e.g. DOA threshold circumvention, PO splitting).
   - Flags discrepancies in calculations, RPN scores, or policy interpretations.
   - Recommends a unified single source of truth for executive management review.
3. **`[ 🧠 Distill to Memory Hub ]`**:
   - Parses durable corporate policies, DOA limits, or vendor benchmarks from engine sessions.
   - Opens `#distillMemoryModal` for rapid rule editing, categorization (`Policy Rule`, `Threshold`, `Correction`, etc.), and pin toggling.
   - Commits directly into `sentinel_memory_vault` in IndexedDB for perpetual in-context recall in future chat sessions.

---

## 5. UI/UX Brand Compliance & Theme Harmonization

- **Corporate Palette Compliance:**
  - Primary Frame: Deep Corporate Navy (`#06234D`)
  - Accent / Primary Action: Royal Blue (`#003886`)
  - Badges & Focus Rings: Electric Turquoise (`#00C4E7`)
  - Reasoning Trays & Synthesis Highlights: Executive Purple (`#7F59E9`)
- **Typography:** Futura, Trebuchet MS, Arial, monospace tags for IDs and code.
- **Zero FOUC & High Contrast:** Flawless light/dark/system theme synchronization with no light-on-light or dark-on-dark contrast collisions.
