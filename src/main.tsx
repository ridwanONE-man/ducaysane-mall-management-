import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {ConfirmProvider} from './components/ConfirmDialog';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConfirmProvider>
      <App />
    </ConfirmProvider>
  </StrictMode>,
);
