import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// The font is imported here (not with @import in index.css): the build then finds its .woff2 files and ships them.
import '@fontsource-variable/geist'
import './index.css'
import './i18n'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
