import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

if (import.meta.env.DEV || location.search.includes('debug')) {
  import('eruda').then(m => m.default.init());
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
