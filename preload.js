// -- preload.js -------------------------------------------------------
// copyright = 'Copyright © 2026- @x-builder, Japan';
// email     = 'x-builder@gmail.com';
// appName   = 'xVoice -テキスト音声読み上げ- Ver1.00.0';
// ---------------------------------------------------------------------
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    initEngine: () => ipcRenderer.invoke('init-engine'),
    restartEngine: () => ipcRenderer.invoke('restart-engine'),
    saveAudio: (audioBuffers, defaultFilename) => ipcRenderer.invoke('save-audio', audioBuffers, defaultFilename),
    onEngineProgress: (callback) => ipcRenderer.on('engine-progress-update', (event, value) => callback(value))
});
