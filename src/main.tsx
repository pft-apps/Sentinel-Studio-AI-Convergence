import './index.css';
import { startIntelStudio } from './intelEngine.ts';
import { initMultiAiHub } from './multiAiHub.ts';
import { googleAuth } from './googleAuth.ts';

function boot() {
  startIntelStudio();
  initMultiAiHub();
  googleAuth.renderHeaderWidget();
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
