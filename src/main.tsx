import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const inventoryMode = new URLSearchParams(window.location.search).get('admin') === 'inventory';

// The dedicated warehouse shortcut installs a separate PWA name, icon and start URL.
if (inventoryMode) {
  document.title = 'US&K Агуулах';
  document.querySelector('link[rel="manifest"]')?.setAttribute('href', '/inventory.webmanifest');
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(inventoryMode ? '/inventory-sw.js' : '/admin-sw.js');
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
