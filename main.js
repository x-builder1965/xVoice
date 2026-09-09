// -- main.js ----------------------------------------------------------
// copyright = 'Copyright © 2026- @x-builder, Japan';
// email     = 'x-builder@gmail.com';
// appName   = 'xVoice -テキスト音声読み上げ- Ver1.00.0';
// ---------------------------------------------------------------------
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const { exec, spawn } = require('child_process');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');

ffmpeg.setFfmpegPath(ffmpegStatic.replace('app.asar', 'app.asar.unpacked'));

const ENGINE_PATH = 'C:\\Program Files\\AivisSpeech\\AivisSpeech-Engine';
const ENGINE_EXE = 'run.exe';
const AIVIS_HOST = 'http://127.0.0.1:10101';

let mainWindow = null;

// --- Engineのヘルスチェック (起動完了待ち) ---
function checkEngineHealth() {
    return new Promise((resolve) => {
        http.get(`${AIVIS_HOST}/version`, (res) => {
            resolve(res.statusCode === 200);
        }).on('error', () => {
            resolve(false);
        });
    });
}

// --- Engine起動状態確認＆起動処理 ---
async function startAivisEngine() {
    const isRunning = await checkEngineHealth();
    if (isRunning) {
        if (mainWindow) mainWindow.webContents.send('engine-progress-update', { current: 60, total: 60, isRunning: true });
        return true;
    }

    // run.exe 起動
    spawn(ENGINE_EXE, ['--host', '0.0.0.0', '--port', '10101', '--load_all_models'], {
        cwd: ENGINE_PATH,
        detached: true,
        stdio: 'ignore'
    }).unref();

    const maxTries = 60;
    for (let i = 1; i <= maxTries; i++) {
        await new Promise(r => setTimeout(r, 1000));

        // 進捗状況を画面に送出
        if (mainWindow) {
            mainWindow.webContents.send('engine-progress-update', { current: i, total: maxTries, isRunning: false });
        }

        if (await checkEngineHealth()) {
            if (mainWindow) {
                mainWindow.webContents.send('engine-progress-update', { current: maxTries, total: maxTries, isRunning: true });
            }
            return true;
        }
    }
    return false;
}

// --- Engine停止処理 (taskkill) ---
function stopAivisEngine() {
    return new Promise((resolve) => {
        exec(`taskkill /F /IM ${ENGINE_EXE}`, () => resolve(true));
    });
}

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

// --- IPC ハンドラー登録 ---

// アプリ起動時の初期化・Engine起動処理
ipcMain.handle('init-engine', async () => {
    return await startAivisEngine();
});

// Engine再起動処理
ipcMain.handle('restart-engine', async () => {
    await stopAivisEngine();
    await new Promise(r => setTimeout(r, 1000));
    return await startAivisEngine();
});

// 音声保存処理
ipcMain.handle('save-audio', async (event, arrayBufferArray, defaultFilename = 'xVoice生成.mp3') => {
    const { filePath } = await dialog.showSaveDialog({
        title: '全文MP3ファイルを保存',
        defaultPath: defaultFilename || 'xVoice生成.mp3', // 受け取ったファイル名をセット
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
        console.error('MP3 Save Error:', err);
        return false;
    } finally {
        if (fs.existsSync(tempWavPath)) {
            fs.unlinkSync(tempWavPath);
        }
    }
});

// --- アプリ初期化 ＆ 終了処理 ---
app.whenReady().then(createWindow);

// アプリ終了時に Engine を停止
app.on('will-quit', async (event) => {
    event.preventDefault();
    await stopAivisEngine();
    process.exit(0);
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
