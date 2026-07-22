import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Use /Cursor/ only for GitHub Pages builds (GITHUB_PAGES=true).
  base: process.env.GITHUB_PAGES === 'true' ? '/Cursor/' : '/',
  server: {
    host: true,
    allowedHosts: true,
  },
  preview: {
    host: true,
    allowedHosts: true,
  },
})
