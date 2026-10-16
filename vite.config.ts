import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

function emitPrecacheManifest(): Plugin {
  return {
    name: 'emit-precache-manifest',
    generateBundle(_options, bundle) {
      const assets = new Set<string>()
      function addEntry(fileName: string) {
        if (assets.has(fileName)) return
        const entry = bundle[fileName]
        if (!entry) return
        assets.add(fileName)
        if (entry.type === 'chunk') {
          entry.imports.forEach(addEntry)
          entry.viteMetadata?.importedCss.forEach((css) => assets.add(css))
        }
      }
      // Model runtimes and workers are cached on demand, after explicit model preparation.
      Object.values(bundle).filter((entry) => entry.type === 'chunk' && entry.isEntry).forEach((entry) => addEntry(entry.fileName))
      Object.keys(bundle).filter((fileName) => fileName.endsWith('.css')).forEach((fileName) => assets.add(fileName))
      this.emitFile({
        type: 'asset',
        fileName: 'precache-manifest.json',
        source: JSON.stringify({ assets: [...assets].sort() }, null, 2),
      })
    },
  }
}

function versionServiceWorker(): Plugin {
  let outputDirectory = ''

  function listFiles(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const entryPath = join(directory, entry.name)
      return entry.isDirectory() ? listFiles(entryPath) : [entryPath]
    })
  }

  return {
    name: 'version-service-worker',
    apply: 'build',
    configResolved(config) {
      outputDirectory = resolve(config.root, config.build.outDir)
    },
    closeBundle() {
      const serviceWorkerPath = join(outputDirectory, 'sw.js')
      const template = readFileSync(serviceWorkerPath, 'utf8')
      const releaseHash = createHash('sha256')

      for (const filePath of listFiles(outputDirectory)
        .filter((filePath) => filePath !== serviceWorkerPath)
        .sort()) {
        releaseHash.update(relative(outputDirectory, filePath).split(sep).join('/'))
        releaseHash.update('\0')
        releaseHash.update(readFileSync(filePath))
        releaseHash.update('\0')
      }
      releaseHash.update(template)

      const releaseId = releaseHash.digest('hex').slice(0, 12)
      const cacheNamePlaceholder = 'lingo-practice-shell-__RELEASE_ID__'
      const versionedCacheName = `lingo-practice-shell-${releaseId}`
      const output = template.replace(cacheNamePlaceholder, versionedCacheName)

      if (output === template) {
        throw new Error(`The service worker is missing the ${cacheNamePlaceholder} placeholder.`)
      }
      writeFileSync(serviceWorkerPath, output)
    },
  }
}

export default defineConfig({
  plugins: [react(), emitPrecacheManifest(), versionServiceWorker()],
  build: {
    target: 'es2022',
  },
})
