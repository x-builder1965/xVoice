// -- preload.js -------------------------------------------------------
// copyright = 'Copyright © 2026- @x-builder, Japan';
// email     = 'x-builder@gmail.com';
// appName   = 'xVoice -テキスト音声読み上げ- Ver1.24.0';
// ---------------------------------------------------------------------
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    getLaunchArgs: () => ipcRenderer.invoke('get-launch-args'),
    initEngine: (address) => ipcRenderer.invoke('init-engine', address),
    connectEngine: (address) => ipcRenderer.invoke('connect-engine', address),
    disconnectEngine: () => ipcRenderer.invoke('disconnect-engine'),
    selectFile: () => ipcRenderer.invoke('select-file'),
    readFileByPath: (filePath) => ipcRenderer.invoke('read-file-by-path', filePath),
    saveTextFile: (text, targetPath) => ipcRenderer.invoke('save-text-file', text, targetPath),
    generateAudio: (buffers, defaultFilename) => ipcRenderer.invoke('generate-audio', buffers, defaultFilename),
    onEngineProgress: (callback) => ipcRenderer.on('engine-progress', (event, value) => callback(value))
});