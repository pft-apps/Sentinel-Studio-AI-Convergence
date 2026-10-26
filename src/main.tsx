import './index.css';
import { startIntelStudio } from './intelEngine.ts';
import { initMultiAiHub } from './multiAiHub.ts';

function boot() {
  startIntelStudio();
  initMultiAiHub();
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
