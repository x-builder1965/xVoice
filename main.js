// -- main.js ----------------------------------------------------------
// copyright = 'Copyright © 2026- @x-builder, Japan';
// email     = 'x-builder@gmail.com';
// appName   = 'xVoice -テキスト音声読み上げ- Ver1.24.0';
// ---------------------------------------------------------------------
// 🔲イミディエイト定義🔲
// インクルードエリアス定義
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const { exec, spawn } = require('child_process');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');

// AivisSpeech-Engine定義
const ENGINE_PATH = 'C:\\Program Files\\AivisSpeech\\AivisSpeech-Engine';
const ENGINE_EXE = 'run.exe';
const DEFAULT_AIVIS_HOST = 'http://127.0.0.1:10101';

// 🔲グローバル変数🔲
let mainWindow = null;
// 本アプリ経由でエンジンを起動したかを管理するフラグ
let isEngineSpawnedByApp = false;

// 🔲初期設定🔲
// FFMpegオブジェクト生成
ffmpeg.setFfmpegPath(ffmpegStatic.replace('app.asar', 'app.asar.unpacked'));

// 🔲app イベント🔲
// アプリ初期化 ＆ 終了処理
app.whenReady().then(createWindow);

// アプリ終了処理
app.on('will-quit', async (event) => {
    // 本アプリによって起動された場合のみエンジンを終了
    if (isEngineSpawnedByApp) {
        event.preventDefault();
        await stopAivisEngine();
        process.exit(0);
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

// 🔲IPC ハンドラー登録🔲
// 起動時引数取得ハンドラー（★２）
ipcMain.handle('get-launch-args', async () => {
    const filePath = getArgFilePath();
    if (filePath) {
        const fileData = readTextFile(filePath);
        if (fileData) {
            return {
                filePath: fileData.path,
                content: fileData.content
            };
        }
    }
    return null;
});

// アプリ起動時の初期化チェック（動的アドレス指定対応）
ipcMain.handle('init-engine', async (event, address = DEFAULT_AIVIS_HOST) => {
    const isHealthy = await checkEngineHealth(address);
    if (isHealthy) {
        return { success: true, isSelfConnected: false };
    }
    return { success: false, isSelfConnected: false };
});

// 手動接続・自起動ハンドラー
ipcMain.handle('connect-engine', async (event, address = DEFAULT_AIVIS_HOST) => {
    // 1. 指定されたアドレスのヘルスチェック
    let isHealthy = await checkEngineHealth(address);
    if (isHealthy) {
        return { success: true, isSelfConnected: false };
    }

    // 2. ローカル環境（localhost / 127.0.0.1）の場合は自起動を試みる
    if (address.includes('127.0.0.1') || address.includes('localhost')) {
        const launched = await startAivisEngine(address);
        if (launched) {
            return { success: true, isSelfConnected: true };
        }
    }

    return { success: false, error: 'AivisSpeech Engine サーバーに接続できませんでした。' };
});

// 手動切断ハンドラー
ipcMain.handle('disconnect-engine', async () => {
    if (isEngineSpawnedByApp) {
        await stopAivisEngine();
    }
    return { success: true };
});

// Engine再起動処理
ipcMain.handle('restart-engine', async (event, address = DEFAULT_AIVIS_HOST) => {
    // 手動再起動時は一旦強制停止してから再起動（自前管理化する）
    await stopAivisEngine();
    await new Promise(r => setTimeout(r, 1000));
    const success = await startAivisEngine(address);
    return { success };
});

// 音声保存処理
ipcMain.handle('generate-audio', async (event, arrayBufferArray, defaultFilename = 'xVoice生成.mp3') => {
    const { filePath } = await dialog.showSaveDialog({
        title: '全文MP3ファイルを保存',
        defaultPath: defaultFilename || 'xVoice生成.mp3',
        filters: [{ name: 'Audio', extensions: ['mp3'] }]
    });

    if (!filePath) return false;

    const tempWavPath = path.join(os.tmpdir(), `combined_${Date.now()}.wav`);

    try {
        const pcmBuffers = [];
        arrayBufferArray.forEach((ab, index) => {
            const buf = Buffer.from(ab);
            if (index === 0) {
                pcmBuffers.push(buf);
            } else {
                pcmBuffers.push(buf.subarray(44));
            }
        });

        const combinedBuffer = Buffer.concat(pcmBuffers);
        const totalDataSize = combinedBuffer.length - 44;
        combinedBuffer.writeUInt32LE(combinedBuffer.length - 8, 4);
        combinedBuffer.writeUInt32LE(totalDataSize, 40);

        fs.writeFileSync(tempWavPath, combinedBuffer);

        await new Promise((resolve, reject) => {
            ffmpeg(tempWavPath)
                .toFormat('mp3')
                .audioBitrate(192)
                .on('end', resolve)
                .on('error', reject)
                .save(filePath);
        });

        return true;
    } catch (err) {
        console.error('MP3 Generate Error:', err);
        return false;
    } finally {
        if (fs.existsSync(tempWavPath)) {
            fs.unlinkSync(tempWavPath);
        }
    }
});

// ファイル選択ダイアログを表示するIPCハンドラー
ipcMain.handle('select-file', async () => {
    const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [
            { name: 'テキストファイル', extensions: ['txt'] },
            { name: 'すべてのファイル', extensions: ['*'] }
        ]
    });

    if (result.canceled || result.filePaths.length === 0) {
        return null;
    }

    return readTextFile(result.filePaths[0]);
});

// 指定されたパスのファイルを直接読み込むIPCハンドラー
ipcMain.handle('read-file-by-path', async (event, filePath) => {
    return readTextFile(filePath);
});

// テキスト保存用 IPC Main 処理
ipcMain.handle('save-text-file', async (event, textContent, defaultPath) => {
    const win = BrowserWindow.getFocusedWindow();

    // 指定パスが存在する場合はそれを使用し、無ければデフォルトのファイル名を設定
    const targetPath = (defaultPath && defaultPath.trim() !== '') 
        ? defaultPath 
        : 'xVoice_text.txt';

    const { canceled, filePath } = await dialog.showSaveDialog(win, {
        title: 'ファイルを保存',
        defaultPath: targetPath,
        filters: [
            { name: 'テキストファイル', extensions: ['txt'] },
            { name: 'すべてのファイル', extensions: ['*'] }
        ]
    });

    if (canceled || !filePath) {
        return { success: false };
    }

    try {
        fs.writeFileSync(filePath, textContent, 'utf-8');
        return { success: true, filePath };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// 🔲共通ヘルパー関数🔲
// window生成
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 720,
        title: 'xVoice -テキスト読み上げ-',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            webSecurity: true,
            sandbox: false
        },
        icon: path.join(__dirname, 'xVoice.ico'),
        autoHideMenuBar: true,
        show: false // ちらつき防止
    });

    mainWindow.loadFile('index.html');
    mainWindow.maximize();

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    return mainWindow;
}

// コマンドライン引数から .txt ファイルパスを取得
function getArgFilePath() {
    // 開発環境とパッケージ後で process.argv の構造が変わるため考慮
    const args = process.argv.slice(app.isPackaged ? 1 : 2);
    for (const arg of args) {
        // オプション引数(--等)を除く .txt ファイルパスを検索
        if (!arg.startsWith('-') && arg.toLowerCase().endsWith('.txt')) {
            if (fs.existsSync(arg)) {
                return path.resolve(arg);
            }
        }
    }
    return null;
}

// Engineのヘルスチェック (起動完了待ち) 
function checkEngineHealth(address = DEFAULT_AIVIS_HOST) {
    return new Promise((resolve) => {
        try {
            const parsedUrl = new URL(address);
            const req = http.get({
                hostname: parsedUrl.hostname,
                port: parsedUrl.port || 80,
                path: '/version',
                timeout: 1500
            }, (res) => {
                resolve(res.statusCode === 200);
            });
            req.on('error', () => resolve(false));
            req.on('timeout', () => {
                req.destroy();
                resolve(false);
            });
        } catch (e) {
            resolve(false);
        }
    });
}

// プロセス存在確認関数 (イメージ名指定)
function checkProcessRunning(exeName = ENGINE_EXE) {
    return new Promise((resolve) => {
        exec(`tasklist /FI "IMAGENAME eq ${exeName}" /NH`, (error, stdout) => {
            if (error || !stdout) {
                resolve(false);
                return;
            }
            // 該当プロセスが見つからない場合は "情報: ..." (No tasks running) が返る
            const isRunning = !stdout.includes('情報:') && !stdout.includes('No tasks') && stdout.trim().length > 0;
            resolve(isRunning);
        });
    });
}

// イメージ名指定での起動確認を含めた Engine起動状態確認＆起動処理
async function startAivisEngine(address = DEFAULT_AIVIS_HOST) {
    // 1. イメージ名(run.exe)でプロセスが生存しているか確認
    const isProcessRunning = await checkProcessRunning(ENGINE_EXE);
    
    // 2. HTTPヘルスチェック
    const isHttpHealthy = await checkEngineHealth(address);

    // プロセスが存在し、かつHTTP応答もある場合
    if (isProcessRunning && isHttpHealthy) {
        if (mainWindow) {
            const progressData = { current: 60, total: 60, isRunning: true };
            mainWindow.webContents.send('engine-progress-update', progressData);
            mainWindow.webContents.send('engine-progress', progressData);
        }
        return true;
    }

    // --- (以下、既存の run.exe 起動処理) ---
    const fullExePath = path.join(ENGINE_PATH, ENGINE_EXE);
    if (!fs.existsSync(fullExePath)) {
        console.error('ローカル Engine 実行ファイルが見つかりません:', fullExePath);
        return false;
    }

    // run.exe 起動
    const child = spawn(ENGINE_EXE, ['--host', '0.0.0.0', '--port', '10101', '--load_all_models'], {
        cwd: ENGINE_PATH,
        detached: true,
        stdio: 'ignore'
    });
    child.unref();

    isEngineSpawnedByApp = true;

    const maxTries = 60;
    for (let i = 1; i <= maxTries; i++) {
        await new Promise(r => setTimeout(r, 2000));

        if (mainWindow && !mainWindow.isDestroyed()) {
            const progressData = { current: i, total: maxTries, isRunning: false };
            mainWindow.webContents.send('engine-progress-update', progressData);
            mainWindow.webContents.send('engine-progress', progressData);
        }

        if (await checkEngineHealth(address)) {
            if (mainWindow && !mainWindow.isDestroyed()) {
                const completeData = { current: maxTries, total: maxTries, isRunning: true };
                mainWindow.webContents.send('engine-progress-update', completeData);
                mainWindow.webContents.send('engine-progress', completeData);
            }
            return true;
        }
    }
    return false;
}

// Engine停止処理 (taskkill) 
function stopAivisEngine() {
    return new Promise((resolve) => {
        exec(`taskkill /F /IM ${ENGINE_EXE}`, () => {
            isEngineSpawnedByApp = false; // 停止完了後にフラグをリセット
            resolve(true);
        });
    });
}

// ファイル読み込みの共通処理
function readTextFile(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        return { path: filePath, content: content };
    } catch (err) {
        console.error('File Read Error:', err);
        return null;
    }
}
