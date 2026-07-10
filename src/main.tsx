import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App'

// The desktop build is already served from the files bundled inside Electron
// and has its own signed updater. Registering the PWA service worker there can
// activate a newly bundled worker a few seconds after launch and reload the
// Login page while the user is typing. Keep offline caching only for the web
// and installed-PWA builds.
if (!window.electronAPI) {
  registerSW({ immediate: true })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
