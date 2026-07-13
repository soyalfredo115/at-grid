import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import i18next from 'i18next'
import { I18nextProvider } from 'react-i18next'
import '@soyalfredo115/at-grid-react/styles.css'
// import './theme-override.css' // descomentar para ver cómo se re-tematiza AtGrid
import gridEs from '@soyalfredo115/at-grid-react/locales/es/grid.json'
import gridEn from '@soyalfredo115/at-grid-react/locales/en/grid.json'
import App from './App'

i18next.init({
  lng: 'es',
  fallbackLng: 'es',
  resources: {
    es: { grid: gridEs },
    en: { grid: gridEn },
  },
  interpolation: { escapeValue: false },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nextProvider i18n={i18next}>
      <App />
    </I18nextProvider>
  </StrictMode>,
)
