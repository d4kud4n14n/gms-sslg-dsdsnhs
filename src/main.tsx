import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ensureRuntimeSupabaseConfig } from './lib/supabase'

const root = createRoot(document.getElementById('root')!)

ensureRuntimeSupabaseConfig().finally(() => {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
