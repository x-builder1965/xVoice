// -- preload.js -------------------------------------------------------
// copyright = 'Copyright © 2026- @x-builder, Japan';
// email     = 'x-builder@gmail.com';
// appName   = 'xVoice -テキスト音声読み上げ- Ver1.54.0';
// ---------------------------------------------------------------------
const { contextBridge, ipcRenderer } = require('electron');
const os = require('os');
const path = require('path');
const { promises: fs } = require('fs');

// 🔲初期処理🔲
// 🔧 起動時対応: キャッシュディレクトリを事前に作成し、
// 一部ライブラリが出す "Unable to create cache" ワーニングを抑制します。
// - ユーザーのホームに .cache と AppData\Local\xPlayerCache を作ります（存在しなくても安全）。
// - console.warn をラップして該当メッセージを無視します（副作用を最小化するため限定的に）。
(async () => {
    try {
        const home = os.homedir();
        const possibleCacheDirs = [
            path.join(home, '.cache'),
            path.join(home, 'AppData', 'Local', 'xPlayerCache')
        ];
        for (const d of possibleCacheDirs) {
            try {
                await fs.mkdir(d, { recursive: true });
            } catch (err) {
                // 作成失敗は重大ではないので無視（権限などの問題があれば警告は抑制）
            }
        }
    } catch (e) {
        // ここでのエラーは無視
    }

    // 特定ワーニングの抑制（内容が変わらない限りのみ抑制）
    try {
        const origWarn = console.warn.bind(console);
        console.warn = (...args) => {
            try {
                if (args && args.length > 0 && typeof args[0] === 'string' && args[0].includes('Unable to create cache')) {
                    return; // 抑制
                }
            } catch (e) {
                // エラーが起きたら通常の warn を呼ぶ
            }
            origWarn(...args);
        };
    } catch (e) {
        // 抑制処理に失敗してもアプリは継続
    }
})();

contextBridge.exposeInMainWorld('api', {
    fs,
    os: { homedir: os.homedir },
    path,
    checkIsSecondaryInstance: () => ipcRenderer.invoke('check-secondary-instance'),
    getLaunchArgs: () => ipcRenderer.invoke('get-launch-args'),
    initEngine: (address) => ipcRenderer.invoke('init-engine', address),
    connectEngine: (address) => ipcRenderer.invoke('connect-engine', address),
    disconnectEngine: () => ipcRenderer.invoke('disconnect-engine'),
    selectFile: () => ipcRenderer.invoke('select-file'),
    selectFolder: () => ipcRenderer.invoke('select-folder'),
    readFileByPath: (filePath) => ipcRenderer.invoke('read-file-by-path', filePath),
    processDroppedPaths: (filePaths) => ipcRenderer.invoke('process-dropped-paths', filePaths),
    saveTextFile: (text, targetPath) => ipcRenderer.invoke('save-text-file', text, targetPath),
    generateAudio: (buffers, defaultFilename) => ipcRenderer.invoke('generate-audio', buffers, defaultFilename),
    onEngineProgress: (callback) => ipcRenderer.on('engine-progress', (event, value) => callback(value)),
    saveSettingsFile: (targetFilePath, data) => ipcRenderer.invoke('save-settings-file', targetFilePath, data),
    savePlaylistFile: (paths) => ipcRenderer.invoke('save-playlist-file', paths),
    onPlaylistProgress: (callback) => ipcRenderer.on('playlist-progress', (event, value) => callback(value))
});
