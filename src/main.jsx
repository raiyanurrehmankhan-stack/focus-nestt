import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { migrateLegacyData } from './services/localApi.js';
import { installAudioUnlock } from './services/sound.js';
import './styles/index.css';

// Links from the first prototype used hash routes (#dashboard, #focus, …).
const LEGACY = { dashboard: '/', focus: '/focus', checkin: '/check-in', sleep: '/sleep', nightlock: '/night-lock', quests: '/quests', wins: '/wins', activities: '/activities', community: '/community', support: '/support', settings: '/settings' };
const legacy = LEGACY[location.hash.slice(1)];
if (legacy) history.replaceState(null, '', legacy);

// Keep data saved by the first prototype (localStorage "focusnest-v1").
migrateLegacyData();
try { if (localStorage.getItem('fn:reduce-motion') === '1') document.documentElement.classList.add('reduce-motion'); } catch { /* ignore */ }
installAudioUnlock();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
