import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  root: 'shell-remembers',
  base: process.env.BASE_PATH ?? '/shell-remembers/',
  plugins: [react()],
  build: {
    outDir: '../dist/shell-remembers',
    emptyOutDir: true,
  },
})
