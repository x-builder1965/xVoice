// -- main.js ----------------------------------------------------------
// copyright = 'Copyright © 2026- @x-builder, Japan';
// email     = 'x-builder@gmail.com';
// appName   = 'xVoice -テキスト音声読み上げ- Ver1.46.0';
// ---------------------------------------------------------------------
// 🔲イミディエイト定義🔲
// インクルードエリアス定義
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');
const http = require('http');
const { exec, spawn } = require('child_process');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const gotTheLock = app.requestSingleInstanceLock();     // 🔧 単一インスタンスロックの取得（重複起動の判定）

// AivisSpeech-Engine定義
const ENGINE_PATH = 'C:\\Program Files\\AivisSpeech\\AivisSpeech-Engine';
const ENGINE_EXE = 'run.exe';
const DEFAULT_AIVIS_HOST = 'http://127.0.0.1:10101';

// 🔲グローバル変数🔲
let mainWindow = null;
// 本アプリ経由でエンジンを起動したかを管理するフラグ
let isEngineSpawnedByApp = false;
let isSecondaryInstance = false;    // 二重起動（多重起動）判定フラグ（true の場合はセカニアリインスタンスとして動作）

// 🔲初期設定🔲
// 初回起動判定
setupFirstLaunch();
// FFMpegオブジェクト生成
ffmpeg.setFfmpegPath(ffmpegStatic.replace('app.asar', 'app.asar.unpacked'));

// 🔲app イベント🔲
// 初回起動判定結果返却
registerIpcMainCheckSecondaryInstance();
// アプリ初期処理
registerAppWhenReady();
// アプリ終了処理
registerAppOnWillQuit();
// アプリ終了後処理
registerAppOnWindowAllClosed();

// 🔲IPC ハンドラー登録🔲
// 起動時引数取得ハンドラー
registerIpcMainGetLaunchArgs();
// アプリ起動時の初期化チェック（動的アドレス指定対応）ハンドラー
registerIpcMainInitEngine();
// 手動接続・自起動ハンドラー
registerIpcMainConnectEngine();
// 手動切断ハンドラー
registerIpcMainDisconnectEngine();
// Engine再起動処理ハンドラー
registerIpcMainRestartEngine();
// 音声保存処理ハンドラー
registerIpcMainGenerateAudio();
// IPC通信: フォルダ選択ハンドラー
registerIpcMainSelectFolder();
// ファイル選択ダイアログを表示するIPCハンドラー
registerIpcMainSelectFile();
// 指定されたパスのファイルを直接読み込むIPCハンドラー
registerIpcMainReadFileByPath();
// テキスト保存用 IPC Main 処理ハンドラー
registerIpcMainSaveTextFile();
// 設定ファイル保存用 IPC Main 処理ハンドラー
registerIpcMainSaveSettingsFile();
// プレイリスト保存 IPCハンドラー
registerIpcMainSavePlaylistFile();
// Ｄ＆Ｄ IPCハンドラー
registerIpcMainProcessDroppedPaths();

// 🔲初期設定🔲
// 初回起動判定
function setupFirstLaunch() {
    if (!gotTheLock) {
        // 2つ目以降の起動（重複起動）の場合
        isSecondaryInstance = true;
        // 重複起動時も一時的なバックグラウンド処理や設定同期のため即時quitせずフラグのみ保持するか、
        // あるいは後続の処理で設定を同期させます。
    } else {
        // 初回起動（プライマリインスタンス）の場合、2つ目が起動された際のイベントをキャッチ
        app.on('second-instance', (event, commandLine, workingDirectory) => {
            if (mainWindow) {
                if (mainWindow.isMinimized()) mainWindow.restore();
                mainWindow.focus();
            }
        });
    }
}

// 🔲app イベント🔲
// アプリ初期処理
function registerAppWhenReady() {
    app.whenReady().then(createWindow);
}

// アプリ終了処理
function registerAppOnWillQuit() {
    app.on('will-quit', async (event) => {
        // 本アプリによって起動された場合のみエンジンを終了
        if (isEngineSpawnedByApp) {
            event.preventDefault();
            await stopAivisEngine();
            process.exit(0);
        }
    });
}

// アプリ終了後処理
function registerAppOnWindowAllClosed() {
    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') app.quit();
    });
}

// 🔲IPC ハンドラー登録🔲
// 初回起動判定結果返却
function registerIpcMainCheckSecondaryInstance() {
    ipcMain.handle('check-secondary-instance', async () => {
        return isSecondaryInstance;
    });
}

// 起動時引数取得ハンドラー
function registerIpcMainGetLaunchArgs() {
    ipcMain.handle('get-launch-args', async () => {
        const filePath = await getArgFilePath();
        if (filePath) {
            const fileData = await readTextFile(filePath);
            if (fileData) {
                return {
                    filePath: fileData.path,
                    content: fileData.content
                };
            }
        }
        return null;
    });
}

// アプリ起動時の初期化チェック（動的アドレス指定対応）ハンドラー
function registerIpcMainInitEngine() {
    ipcMain.handle('init-engine', async (event, address = DEFAULT_AIVIS_HOST) => {
        const isHealthy = await checkEngineHealth(address);
        if (isHealthy) {
            return { success: true, isSelfConnected: false };
        }
        return { success: false, isSelfConnected: false };
    });
}

// 手動接続・自起動ハンドラー
function registerIpcMainConnectEngine() {
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
}

// 手動切断ハンドラー
function registerIpcMainDisconnectEngine() {
    ipcMain.handle('disconnect-engine', async () => {
        if (isEngineSpawnedByApp) {
            await stopAivisEngine();
        }
        return { success: true };
    });
}

// Engine再起動処理ハンドラー
function registerIpcMainRestartEngine() {
    ipcMain.handle('restart-engine', async (event, address = DEFAULT_AIVIS_HOST) => {
        // 手動再起動時は一旦強制停止してから再起動（自前管理化する）
        await stopAivisEngine();
        await new Promise(r => setTimeout(r, 1000));
        const success = await startAivisEngine(address);
        return { success };
    });
}

// 音声保存処理ハンドラー
function registerIpcMainGenerateAudio() {
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

            await fs.writeFile(tempWavPath, combinedBuffer);

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
            try {
                await fs.unlink(tempWavPath);
            } catch (error) {
                // ENOENT (ファイルが存在しない) 以外のエラーであれば再スロー
                if (error.code !== 'ENOENT') {
                    throw error;
                }
            }
        }
    });
}

// IPC通信: フォルダ選択ハンドラー
function registerIpcMainSelectFolder() {
    ipcMain.handle('select-folder', async () => {
        const result = await dialog.showOpenDialog({
            title: 'フォルダの選択',
            properties: ['openDirectory']
        });

        if (result.canceled || result.filePaths.length === 0) {
            return null;
        }

        const folderPath = result.filePaths[0];
        return await scanFolderAndCollectFiles(folderPath);
    });
}

// ファイル選択ダイアログを表示するIPCハンドラー
function registerIpcMainSelectFile() {
    ipcMain.handle('select-file', async () => {
        const result = await dialog.showOpenDialog({
            properties: ['openFile', 'multiSelections'],
            filters: [
                { name: 'プレイリスト / テキストファイル', extensions: ['amppl', 'txt'] },
                { name: 'テキストファイル (*.txt)', extensions: ['txt'] },
                { name: 'プレイリストファイル (*.amppl)', extensions: ['amppl'] },
                { name: 'すべてのファイル', extensions: ['*'] }
            ]
        });

        if (result.canceled || result.filePaths.length === 0) {
            return null;
        }

        const rawItemMap = new Map(); // 重複排除用マップ (Key: filePath)

        for (const selectedPath of result.filePaths) {
            const ext = path.extname(selectedPath);

            if (ext.toLowerCase() === '.amppl') {
                const itemsFromPlaylist = await parsePlaylistFile(selectedPath);
                for (const item of itemsFromPlaylist) {
                    if (!rawItemMap.has(item.path)) {
                        rawItemMap.set(item.path, item);
                    }
                }
            } else if (ext.toLowerCase() === '.txt') {
                try {
                    const stats = await fs.stat(selectedPath);
                    const parsedPath = path.parse(selectedPath);

                    if (!rawItemMap.has(selectedPath)) {
                        rawItemMap.set(selectedPath, {
                            path: selectedPath,
                            file: parsedPath.name,
                            ext: ext.replace(/^\./, ''),
                            createTime: stats.birthtime
                        });
                    }
                } catch (err) {
                    console.error(`ファイル情報取得失敗: ${selectedPath}`, err);
                }
            }
        }

        // ファイル内容を読み込んで各要素オブジェクトに合体
        const fileDataList = [];
        for (const item of rawItemMap.values()) {
            try {
                const content = await fs.readFile(item.path, 'utf-8');
                fileDataList.push({
                    ...item,
                    content: content
                });
            } catch (err) {
                console.error(`ファイル読み込み失敗: ${item.path}`, err);
            }
        }

        return fileDataList; // 配列で返却
    });
}

// 指定されたパスのファイルを直接読み込むIPCハンドラー
function registerIpcMainReadFileByPath() {
    ipcMain.handle('read-file-by-path', async (event, filePath) => {
        return readTextFile(filePath);
    });
}

// テキスト保存用 IPC Main 処理ハンドラー
function registerIpcMainSaveTextFile() {
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
            await fs.writeFile(filePath, textContent, 'utf-8');
            return { success: true, filePath };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });
}

// 設定ファイル保存用 IPC Main 処理ハンドラー
function registerIpcMainSaveSettingsFile() {
    ipcMain.handle('save-settings-file', async (event, targetFilePath, data) => {
        const tempFilePath = `${targetFilePath}`;
        
        // アトミック書き込み（書き込み完了を確実に待ってからリネーム）
        await fs.writeFile(tempFilePath, data, 'utf8');
        await fs.rename(tempFilePath, targetFilePath);
        return true;
    });
}

// プレイリスト保存 IPCハンドラー
function registerIpcMainSavePlaylistFile() {
    ipcMain.handle('save-playlist-file', async (event, paths) => {
        if (!paths || !Array.isArray(paths) || paths.length === 0) {
            return { success: false, reason: 'empty' };
        }

        // 保存ダイアログを表示
        const result = await dialog.showSaveDialog({
            title: 'プレイリストファイルを保存',
            defaultPath: 'xVoice.amppl', // デフォルトファイル名
            filters: [
                { name: 'プレイリストファイル', extensions: ['amppl'] },
                { name: 'すべてのファイル', extensions: ['*'] }
            ]
        });

        // キャンセル時は何もしない
        if (result.canceled || !result.filePath) {
            return { success: false, reason: 'canceled' };
        }

        try {
            // パス一覧を改行コード (CRLFまたはLF) で結合
            const content = paths.join('\r\n');
            
            // UTF-8 形式で保存
            await fs.writeFile(result.filePath, content, 'utf-8');

            return { success: true, filePath: result.filePath };
        } catch (error) {
            console.error('プレイリスト保存エラー:', error);
            return { success: false, error: error.message };
        }
    });
}

// Ｄ＆Ｄ IPCハンドラー
function registerIpcMainProcessDroppedPaths() {
    ipcMain.handle('process-dropped-paths', async (event, filePaths) => {
        return await processDroppedPaths(filePaths);
    });
}

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

    // --- ★デバッガ・アタッチ待ち対応★ ---
    let isLoaded = false;
    const loadApp = () => {
        if (!isLoaded) {
            isLoaded = true;
            mainWindow.loadFile('index.html');
            mainWindow.webContents.closeDevTools();
        }
    };

    // 開発パッケージ未構成時またはデバッグ用の処理
    if (!app.isPackaged) {
        // DevToolsが開かれたらロードを開始（アタッチ完了を保証）
        mainWindow.webContents.once('devtools-opened', () => {
            loadApp();
        });

        // 自動的にDevToolsを開く
        mainWindow.webContents.openDevTools();

        // 万が一DevToolsが開かなくても1秒後にはフォールバックでロード
        setTimeout(() => {
            loadApp();
        }, 1000);
    } else {
        // 本番ビルド時は直接ロード
        loadApp();
    }
    // --------------------------------------
    
    mainWindow.maximize();

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    return mainWindow;
}

// コマンドライン引数から .txt ファイルパスを取得
async function getArgFilePath() {
    // 開発環境とパッケージ後で process.argv の構造が変わるため考慮
    const args = process.argv.slice(app.isPackaged ? 1 : 2);
    for (const arg of args) {
        // オプション引数(--等)を除く .txt ファイルパスを検索
        if (!arg.startsWith('-') && arg.toLowerCase().endsWith('.txt')) {
            try {
                // 成功すると何も返さず通過、失敗すると catch へ飛ぶ
                await fs.access(arg);
                return path.resolve(arg);
            } catch {
                // ファイルが存在しない、またはアクセス権限がない場合はスキップ
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
            mainWindow.webContents.send('engine-progress', progressData);
        }
        return true;
    }

    // --- (以下、既存の run.exe 起動処理) ---
    try {
        const fullExePath = path.join(ENGINE_PATH, ENGINE_EXE);
        await fs.access(fullExePath);
    } catch (error) {
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
            mainWindow.webContents.send('engine-progress', progressData);
        }

        if (await checkEngineHealth(address)) {
            if (mainWindow && !mainWindow.isDestroyed()) {
                const completeData = { current: maxTries, total: maxTries, isRunning: true };
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
async function readTextFile(filePath) {
    try {
        const content = await fs.readFile(filePath, 'utf-8');
        return { path: filePath, content: content };
    } catch (err) {
        console.error('File Read Error:', err);
        return null;
    }
}

// .amppl プレイリストファイルを解析してテキストファイル群を読み込む
async function parseAmpplFile(playlistPath) {
    try {
        const content = await fs.promises.readFile(playlistPath, 'utf8');
        // 改行で分割し、空行を除外
        const lines = content.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
        const loadedItems = [];

        for (const linePath of lines) {
            // .txt ファイルのみを対象とする (.mp4 等はスキップ)
            if (path.extname(linePath).toLowerCase() === '.txt') {
                try {
                    const fileData = await readTextFile(linePath);
                    if (fileData) {
                        loadedItems.push(fileData);
                    }
                } catch (err) {
                    console.warn(`[Playlist] ファイルの読み込みに失敗しました: ${linePath}`, err);
                }
            }
        }
        return loadedItems;
    } catch (error) {
        console.error(`[Playlist] .amppl の読み込みエラー: ${playlistPath}`, error);
        return [];
    }
}

// プレイリストファイル (.amppl) を解析し、存在する .txt ファイルの詳細情報一覧を取得する関数
// @param {string} playlistPath 
// @returns {Promise<Array<{path: string, file: string, ext: string, createTime: Date}>>}
async function parsePlaylistFile(playlistPath) {
    try {
        const content = await fs.readFile(playlistPath, 'utf-8');
        const lines = content.split(/\r?\n/);
        const validTxtPaths = [];

        for (let line of lines) {
            const trimmedPath = line.trim();
            if (!trimmedPath) continue;

            const ext = path.extname(trimmedPath);

            // .txt ファイルかつ実際に存在するかチェック（.mp4等を除外）
            if (ext.toLowerCase() === '.txt') {
                try {
                    const stats = await fs.stat(trimmedPath);
                    const parsedPath = path.parse(trimmedPath);

                    validTxtPaths.push({
                        path: trimmedPath,
                        file: parsedPath.name,        // 拡張子なしファイル名
                        ext: ext.replace(/^\./, ''),  // 拡張子 (先頭ドットなし)
                        createTime: stats.birthtime   // 作成日時 (環境により stats.ctime)
                    });
                } catch {
                    console.warn(`ファイルが存在しません: ${trimmedPath}`);
                }
            }
        }
        return validTxtPaths;
    } catch (error) {
        console.error('プレイリスト解析エラー:', error);
        return [];
    }
}

// ディレクトリ内を再帰的に検索してテキスト情報を取得する関数
async function scanFolderAndCollectFiles(dirPath) {
    let results = [];
    
    try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);

            if (entry.isDirectory()) {
                // サブフォルダを再帰的に検索
                const subResults = await scanFolderAndCollectFiles(fullPath);
                results = results.concat(subResults);
            } else if (entry.isFile()) {
                const ext = path.extname(entry.name).toLowerCase();

                if (ext === '.txt') {
                    // .txt ファイルの読み込み
                    try {
                        const content = await fs.readFile(fullPath, 'utf-8');
                        results.push({ path: fullPath, content });
                    } catch (err) {
                        console.warn(`ファイル読み込みエラー: ${fullPath}`, err);
                    }
                } else if (ext === '.amppl') {
                    // .amppl プレイリストファイルの展開読み込み
                    const playlistItems = await parsePlaylistFile(fullPath);
                    for (const item of playlistItems) {
                        try {
                            const content = await fs.readFile(item.path, 'utf-8');
                            results.push({ path: item.path, content });
                        } catch (err) {
                            console.warn(`プレイリスト内テキスト読み込みエラー: ${item.path}`, err);
                        }
                    }
                }
            }
        }
    } catch (error) {
        console.error(`フォルダスキャンエラー: ${dirPath}`, error);
    }

    // 重複パスの排除（同一テキストが複数回登録されるのを防止）
    const uniqueMap = new Map();
    for (const item of results) {
        if (!uniqueMap.has(item.path)) {
            uniqueMap.set(item.path, item);
        }
    }

    return Array.from(uniqueMap.values());
}

// ドロップされたパス一覧を処理するメイン関数
async function processDroppedPaths(filePaths) {
    let results = [];

    for (const targetPath of filePaths) {
        try {
            const stats = await fs.stat(targetPath);

            if (stats.isDirectory()) {
                // フォルダの場合は再帰スキャン
                const subResults = await scanFolderAndCollectFiles(targetPath);
                results = results.concat(subResults);
            } else if (stats.isFile()) {
                // ファイルの場合は単体処理
                const fileResult = await processSingleFile(targetPath);
                if (fileResult) {
                    results = results.concat(fileResult);
                }
            }
        } catch (err) {
            console.warn(`パス処理エラー: ${targetPath}`, err);
        }
    }

    // 重複パスの排除
    const uniqueMap = new Map();
    for (const item of results) {
        if (!uniqueMap.has(item.path)) {
            uniqueMap.set(item.path, item);
        }
    }

    return Array.from(uniqueMap.values());
}

// 単一ファイル（.txt / .amppl）の処理
async function processSingleFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();

    if (ext === '.txt') {
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            return [{ path: filePath, content }];
        } catch (err) {
            console.warn(`テキスト読み込みエラー: ${filePath}`, err);
        }
    } else if (ext === '.amppl') {
        const playlistItems = await parsePlaylistFile(filePath);
        const items = [];
        for (const item of playlistItems) {
            try {
                const content = await fs.readFile(item.path, 'utf-8');
                items.push({ path: item.path, content });
            } catch (err) {
                console.warn(`プレイリスト内テキスト読み込みエラー: ${item.path}`, err);
            }
        }
        return items;
    }
    return null;
}
