'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  saveHnSettings: (s)  => ipcRenderer.invoke('save-hn-settings', s),
  getAppInfo:      ()   => ipcRenderer.invoke('get-app-info'),
  checkForUpdates: ()   => ipcRenderer.invoke('check-for-updates'),
  printLabels:     (html) => ipcRenderer.invoke('print-labels', html),
  printCompactLabel: (html) => ipcRenderer.invoke('print-compact-label', html),
});
