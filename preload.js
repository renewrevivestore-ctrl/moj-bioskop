const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  json: (url, opts) => ipcRenderer.invoke('http:json', url, opts),
  buffer: (url, opts) => ipcRenderer.invoke('http:buffer', url, opts),
  cached: (key, url, maxAgeHours, force) => ipcRenderer.invoke('cache:json', key, url, maxAgeHours, force),
  clearCache: () => ipcRenderer.invoke('cache:clear'),
  catalog: (url) => ipcRenderer.invoke('catalog:load', url),
  streamHeaders: (url, referer, ua) => ipcRenderer.invoke('stream:headers', url, referer, ua),
  checkStream: (url, referer, ua) => ipcRenderer.invoke('stream:check', url, referer, ua),
  open: (url) => ipcRenderer.invoke('open:external', url),
  pickSubtitle: () => ipcRenderer.invoke('file:subtitle'),
  version: () => ipcRenderer.invoke('app:version'),
  checkUpdate: () => ipcRenderer.invoke('update:check'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  onUpdate: (cb) => ipcRenderer.on('update:status', (_e, s) => cb(s)),
});
