import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import gridEs from '@soyalfredo115/at-grid-react/locales/es/grid.json'
import gridEn from '@soyalfredo115/at-grid-react/locales/en/grid.json'
import '@soyalfredo115/at-grid-react/styles.css'
import './styles.css'
import App from './App'

i18next.use(initReactI18next).init({
  lng: 'es',
  fallbackLng: 'en',
  resources: {
    es: { grid: gridEs },
    en: { grid: gridEn },
  },
  interpolation: { escapeValue: false },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
