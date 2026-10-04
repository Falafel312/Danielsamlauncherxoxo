import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import '@fontsource-variable/inter';
import '@fontsource-variable/space-grotesk';
import './styles.css';
import './redesign.css';
createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
