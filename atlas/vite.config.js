import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'

function agentDebugLogPlugin() {
  return {
    name: 'agent-debug-log',
    configureServer(server) {
      server.middlewares.use('/__agent_debug', (req, res, next) => {
        if (req.method !== 'POST') return next()
        let body = ''
        req.on('data', (c) => { body += c })
        req.on('end', () => {
          try {
            fs.appendFileSync('/opt/cursor/logs/debug.log', body.trim() + '\n')
          } catch { /* ignore */ }
          res.statusCode = 204
          res.end()
        })
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), agentDebugLogPlugin()],
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
