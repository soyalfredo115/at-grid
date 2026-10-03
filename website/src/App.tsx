import { useCallback, useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { Reveal } from './components/Reveal'
import { InstallLine } from './components/CodeBlock'
import { LiveDemo } from './demo/LiveDemo'
import { Quickstart } from './sections/Quickstart'
import { ApiDocs } from './sections/ApiDocs'

type Theme = 'light' | 'dark'

function useTheme() {
  const [theme, setTheme] = useState<Theme>(
    () => (document.documentElement.dataset.theme as Theme) || 'light',
  )

  const toggle = useCallback(() => {
    setTheme((t) => {
      const next = t === 'light' ? 'dark' : 'light'
      document.documentElement.dataset.theme = next
      localStorage.setItem('atgrid-site-theme', next)
      return next
    })
  }, [])

  return { theme, toggle }
}

const FEATURES: { title: string; desc: string }[] = [
  {
    title: 'Orden multi-columna',
    desc: 'Click en el header ordena; Shift+click encadena columnas. El índice de prioridad se muestra junto a la flecha.',
  },
  {
    title: 'Columnas manipulables',
    desc: 'Reordenar arrastrando el header, redimensionar desde el borde, fijar a izquierda o derecha, ocultar y mostrar desde el panel de columnas, autosize con doble click.',
  },
  {
    title: 'Agrupación con subtotales',
    desc: 'Arrastrá un header a la barra de agrupación (o usá el menú de columna). Grupos anidados, filas de grupo con agregados por columna, expandir y colapsar todo.',
  },
  {
    title: 'Filtros tipados por columna',
    desc: 'Texto (contiene), numérico con expresiones (>1000, 5..10, !=0), rango de fechas y set de valores con checkboxes y conteo. Más la búsqueda global sobre todas las columnas.',
  },
  {
    title: 'Selección con agregados',
    desc: 'Checkboxes por fila y una barra flotante que suma, promedia o cuenta lo seleccionado según el aggregate de cada columna, con espacio para acciones en lote propias.',
  },
  {
    title: 'Export Excel sin librerías',
    desc: 'El .xlsx se genera con código propio (ZIP + SpreadsheetML a mano): números como números reales, encabezados en negrita. También copia TSV al portapapeles.',
  },
  {
    title: 'Persistencia de estado',
    desc: 'Con un storageKey el grid recuerda orden, anchos, sort, agrupación, columnas ocultas y fijadas, y tamaño de página entre sesiones. Restablecer vuelve al estado declarado.',
  },
  {
    title: 'Teclado de primera clase',
    desc: 'Flechas para moverse, Enter para abrir o expandir, Espacio para seleccionar, PageUp/PageDown para paginar. Tooltips automáticos en celdas con texto cortado.',
  },
  {
    title: 'Un solo look, dos frameworks',
    desc: 'React 18 y Angular 18/19 (standalone, signals) con la misma funcionalidad y apariencia. El tema sale de variables CSS — esta página lo re-temea a monocromo sin tocar el paquete.',
  },
]

export default function App() {
  const { theme, toggle } = useTheme()

  // El grid de la demo lee sus variables CSS del :root del sitio
  useEffect(() => {
    document.documentElement.style.colorScheme = theme
  }, [theme])

  return (
    <>
      <header className="topbar">
        <div className="wrap topbar-inner">
          <a className="brand" href="#top" aria-label="AtGrid, inicio">
            at-grid<span className="cursor-block" aria-hidden="true" />
          </a>
          <nav className="topnav" aria-label="Secciones">
            <a href="#demo">demo</a>
            <a href="#caracteristicas">características</a>
            <a href="#inicio-rapido">inicio rápido</a>
            <a href="#api">api</a>
          </nav>
          <div className="topbar-actions">
            <a
              className="icon-btn"
              href="https://www.npmjs.com/package/@soyalfredo115/at-grid-react"
              target="_blank"
              rel="noreferrer"
            >
              npm
            </a>
            <button
              className="icon-btn"
              onClick={toggle}
              aria-label={theme === 'light' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}
            >
              {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
            </button>
          </div>
        </div>
      </header>

      <main id="top">
        <section className="hero">
          <div className="wrap hero-grid">
            <div>
              <Reveal>
                <p className="hero-kicker">React 18 · Angular 18/19 · MIT</p>
              </Reveal>
              <Reveal delay={80}>
                <h1>
                  Tabla declarativa
                  <br />
                  con superpoderes.
                </h1>
              </Reveal>
              <Reveal delay={160}>
                <p className="hero-sub">
                  Orden multi-columna, filtros tipados, agrupación con subtotales, selección con agregados, export a
                  Excel sin librerías y estado persistente. Todo declarado en un arreglo de columnas — misma
                  funcionalidad y mismo look en React y Angular.
                </p>
              </Reveal>
              <Reveal delay={240}>
                <InstallLine command="npm install @soyalfredo115/at-grid-react" />
              </Reveal>
            </div>
            <Reveal delay={320}>
              <dl className="hero-meta">
                <div>
                  <dt>dependencias de runtime</dt>
                  <dd>0 (Angular) · peers ligeros (React)</dd>
                </div>
                <div>
                  <dt>export .xlsx</dt>
                  <dd>código propio, sin SheetJS</dd>
                </div>
                <div>
                  <dt>theming</dt>
                  <dd>variables CSS</dd>
                </div>
                <div>
                  <dt>i18n</dt>
                  <dd>es / en (React)</dd>
                </div>
                <div>
                  <dt>licencia</dt>
                  <dd>MIT</dd>
                </div>
              </dl>
            </Reveal>
          </div>
        </section>

        <section className="section" id="demo">
          <div className="wrap">
            <Reveal className="section-head">
              <span className="section-num">01</span>
              <h2>La demo es el argumento</h2>
            </Reveal>
            <Reveal>
              <p className="section-intro">
                Esto no es una captura: es <code>&lt;AtGrid /&gt;</code> corriendo con 64 facturas. Ordená, filtrá,
                agrupá, seleccioná y exportá. El estado se guarda en tu navegador — recargá y sigue ahí.
              </p>
            </Reveal>
            <Reveal delay={100}>
              <LiveDemo />
            </Reveal>
            <Reveal delay={160}>
              <ul className="demo-hints">
                <li>
                  <kbd>Shift</kbd> + click en un header encadena el multi-sort
                </li>
                <li>Arrastrá el header «Cliente» a la barra superior para agrupar con subtotales</li>
                <li>
                  En «Monto USD» probá el filtro <kbd>&gt;20000</kbd> o <kbd>500..5000</kbd>
                </li>
                <li>Seleccioná filas: la barra inferior suma la selección y deja exportarla a Excel</li>
                <li>Doble click en el borde de un header lo ajusta al contenido</li>
                <li>El menú de cada columna permite fijarla, agruparla u ocultarla</li>
              </ul>
            </Reveal>
          </div>
        </section>

        <section className="section" id="caracteristicas">
          <div className="wrap">
            <Reveal className="section-head">
              <span className="section-num">02</span>
              <h2>Características</h2>
            </Reveal>
            <ol className="feature-list">
              {FEATURES.map((f, i) => (
                <Reveal key={f.title} as="li" delay={Math.min(i * 40, 160)}>
                  <h3>{f.title}</h3>
                  <p>{f.desc}</p>
                </Reveal>
              ))}
            </ol>
          </div>
        </section>

        <section className="section" id="inicio-rapido">
          <div className="wrap">
            <Reveal className="section-head">
              <span className="section-num">03</span>
              <h2>Inicio rápido</h2>
            </Reveal>
            <Reveal>
              <Quickstart />
            </Reveal>
          </div>
        </section>

        <section className="section" id="api">
          <div className="wrap">
            <Reveal className="section-head">
              <span className="section-num">04</span>
              <h2>Referencia de API</h2>
            </Reveal>
            <ApiDocs />
          </div>
        </section>
      </main>

      <footer className="footer wrap">
        <span>AtGrid — MIT © 2026 Alfredo</span>
        <span>
          <a href="https://www.npmjs.com/package/@soyalfredo115/at-grid-react" target="_blank" rel="noreferrer">
            at-grid-react
          </a>
          {' · '}
          <a href="https://www.npmjs.com/package/@soyalfredo115/at-grid-angular" target="_blank" rel="noreferrer">
            at-grid-angular
          </a>
          {' · '}
          <a href="https://www.npmjs.com/package/@soyalfredo115/at-grid-types" target="_blank" rel="noreferrer">
            at-grid-types
          </a>
        </span>
      </footer>
    </>
  )
}
