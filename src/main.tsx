import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { hydrateNativeWorkspace } from './native/preferences'
import './styles.css'

const root = document.getElementById('root')

if (!root) {
  throw new Error('The application root is missing.')
}

void hydrateNativeWorkspace().then(() => {
  createRoot(root).render(<StrictMode><App /></StrictMode>)
}).catch(() => {
  // Do not overwrite unknown native preferences with browser defaults.
  const message = document.createElement('p')
  message.setAttribute('role', 'alert')
  message.textContent = 'Saved preferences could not be read. Restart the app to retry. Your practice data has not been deleted. / 无法读取设置，请重启重试。练习数据未被删除。'
  root.append(message)
})

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js')
  })
}
