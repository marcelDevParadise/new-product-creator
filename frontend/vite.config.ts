import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { execFileSync } from 'node:child_process'
import path from 'path'

const repositoryRoot = path.resolve(__dirname, '..')

function git(...args: string[]): string {
  return execFileSync('git', args, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim()
}

function resolveAppVersion(): string {
  const configuredVersion = process.env.APP_VERSION?.trim() || process.env.VITE_APP_VERSION?.trim()
  if (configuredVersion) {
    return configuredVersion.startsWith('v') ? configuredVersion : `v${configuredVersion}`
  }

  try {
    const isDirty = git('status', '--porcelain').length > 0
    if (!isDirty) {
      const exactTag = git('describe', '--tags', '--exact-match')
      if (/^v\d+\.\d+\.\d+$/.test(exactTag)) return exactTag
    }

    const shortCommit = git('rev-parse', '--short=8', 'HEAD')
    return `dev-${shortCommit}${isDirty ? '-dirty' : ''}`
  } catch {
    return 'dev-local'
  }
}

const appVersion = resolveAppVersion()

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8000',
    },
  },
})
