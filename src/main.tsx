import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {ConfirmProvider} from './components/ConfirmDialog';
import {UpdateBanner} from './components/UpdateBanner';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConfirmProvider>
      <App />
      <UpdateBanner />
    </ConfirmProvider>
  </StrictMode>,
);
