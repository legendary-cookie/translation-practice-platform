// Browser checks use synthetic exam content when the content catalog is incomplete.
require('../tests/register-typescript.cjs')
const { profiles } = require('../tests/catti3-fixtures.cjs')
exports.ensureExamFixture = async function ensureExamFixture(page) {
  await page.waitForFunction(async () => (await indexedDB.databases()).some(db => db.name === 'lingo-practice-local'))
  await page.evaluate(async profile => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('lingo-practice-local')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    try {
      const records = await new Promise((resolve, reject) => {
        const request = db.transaction('examProfiles').objectStore('examProfiles').getAll()
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      if (records.length) return
      await new Promise((resolve, reject) => {
        const tx = db.transaction('examProfiles', 'readwrite')
        tx.objectStore('examProfiles').put(profile)
        tx.oncomplete = resolve
        tx.onabort = () => reject(tx.error)
      })
    } finally { db.close() }
  }, profiles()[0])
  await page.reload()
  await page.locator('.sidebar').waitFor()
}
