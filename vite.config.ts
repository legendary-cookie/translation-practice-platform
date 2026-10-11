import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

function emitPrecacheManifest(): Plugin {
  return {
    name: 'emit-precache-manifest',
    generateBundle(_options, bundle) {
      const assets = Object.keys(bundle).filter((fileName) => /\.(?:js|css)$/u.test(fileName))
      this.emitFile({
        type: 'asset',
        fileName: 'precache-manifest.json',
        source: JSON.stringify({ assets }, null, 2),
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), emitPrecacheManifest()],
  build: {
    target: 'es2022',
  },
})
