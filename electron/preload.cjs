'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  lookupHN:       (hn) => ipcRenderer.invoke('lookup-hn', hn),
  getHnSettings:  ()   => ipcRenderer.invoke('get-hn-settings'),
  saveHnSettings: (s)  => ipcRenderer.invoke('save-hn-settings', s),
  getAppInfo:      ()   => ipcRenderer.invoke('get-app-info'),
  checkForUpdates: ()   => ipcRenderer.invoke('check-for-updates'),
});
