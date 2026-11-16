'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Only a v2.0.3 renderer still cached by the service worker calls these two.
  lookupHN:       (hn) => ipcRenderer.invoke('lookup-hn', hn),
  getHnSettings:  ()   => ipcRenderer.invoke('get-hn-settings'),
  saveHnSettings: (s)  => ipcRenderer.invoke('save-hn-settings', s),
  getAppInfo:      ()   => ipcRenderer.invoke('get-app-info'),
  checkForUpdates: ()   => ipcRenderer.invoke('check-for-updates'),
  printLabels:     (html) => ipcRenderer.invoke('print-labels', html),
  printCompactLabel: (html) => ipcRenderer.invoke('print-compact-label', html),
});
