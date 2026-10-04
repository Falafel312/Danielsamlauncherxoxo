const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('rift', {
  configureAccount: input => ipcRenderer.invoke('rift:account', input),
  getState: () => ipcRenderer.invoke('rift:state'),
  refresh: () => ipcRenderer.invoke('rift:refresh'),
  saveSettings: input => ipcRenderer.invoke('rift:settings', input),
  getBuild: (champion, role, refresh) => ipcRenderer.invoke('rift:build', champion, role, refresh),
  updates: (action, url) => ipcRenderer.invoke('rift:updates', action, url),
  overlay: action => ipcRenderer.invoke('rift:overlay', action),
  window: action => ipcRenderer.invoke('rift:window', action),
  onState: callback => { const listener = (_event, state) => callback(state); ipcRenderer.on('rift:state', listener); return () => ipcRenderer.removeListener('rift:state', listener); },
});
