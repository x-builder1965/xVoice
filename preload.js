// -- preload.js -------------------------------------------------------
// copyright = 'Copyright © 2026- @x-builder, Japan';
// email     = 'x-builder@gmail.com';
// appName   = 'xVoice -テキスト音声読み上げ- Ver1.12.0';
// ---------------------------------------------------------------------
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    initEngine: () => ipcRenderer.invoke('init-engine'),
    restartEngine: () => ipcRenderer.invoke('restart-engine'),
    onEngineProgress: (callback) => ipcRenderer.on('engine-progress-update', (_event, value) => callback(value)),
    selectFile: () => ipcRenderer.invoke('select-file'),
    readFileByPath: (filePath) => ipcRenderer.invoke('read-file-by-path', filePath), // 追加
    generateAudio: (buffers, defaultFilename) => ipcRenderer.invoke('generate-audio', buffers, defaultFilename),
    saveTextFile: (text, defaultPath) => ipcRenderer.invoke('save-text-file', text, defaultPath)
});
