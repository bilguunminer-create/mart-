import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Enables installation as the standalone US&K Admin app and caches its app shell.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/admin-sw.js');
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
