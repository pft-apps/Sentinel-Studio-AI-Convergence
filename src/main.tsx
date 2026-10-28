import './index.css';
import { startIntelStudio } from './intelEngine.ts';
import { initMultiAiHub } from './multiAiHub.ts';
import { googleAuth } from './googleAuth.ts';
import { aiConference } from './aiConference.ts';

function boot() {
  startIntelStudio();
  initMultiAiHub();
  googleAuth.renderHeaderWidget();
  aiConference.init();
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
