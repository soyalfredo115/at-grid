import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' para que el build funcione servido desde cualquier subruta (GitHub Pages, etc.)
export default defineConfig({
  plugins: [react()],
  base: './',
})
