import '@fontsource-variable/martian-mono/standard.css';
import '@fontsource-variable/syne/index.css';
import './styles/tokens.css';
import './styles/global.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';

const root = document.getElementById('root');
if (!root) throw new Error('LIFE/MAINTENANCE: #root not found');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
