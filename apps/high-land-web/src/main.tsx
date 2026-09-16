import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';
import './overflowFixes.css';
import './highLandUiV2.css';
import './productionControls.css';
import './siteShellV5.css';
import './highLandBoardPriority.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
