// -- renderer.js ------------------------------------------------------
// copyright = 'Copyright © 2026- @x-builder, Japan';
// email     = 'x-builder@gmail.com';
// appName   = 'xVoice -テキスト音声読み上げ- Ver1.34.0';
// ---------------------------------------------------------------------
// 🔲イミディエイト定義🔲
const DEFAULT_HOST = 'http://127.0.0.1:10101';
// --- localStorage保存・復元用キー定数 ---
const STORAGE_KEYS = {
    FILE_PATH: 'xVoice_filePath',
    TEXT: 'xVoice_text',
    TEXT_BACKUP: 'xVoice_textBackup',
    LINE_INDEX: 'xVoice_lineIndex',
    VOLUME: 'xVoice_volume',
    FONT_SIZE: 'xVoice_fontSize',
    SPEAKER: 'xVoice_speaker',
    TEXT_DIRECTION: 'xVoice_textDirection',
    SERVER_ADDRESS: 'xVoice_serverAddress'
};
// ショートカットキーと各ボタンのIDのマッピング定義
const shortcutMap = {
    'ctrl+t': { control: 'btn-theme',       editing: true },
    'ctrl+f': { control: 'btn-file-select', editing: true },
    'ctrl+c': { control: 'btn-file-clear',  editing: false },
    'ctrl+n': { control: 'btn-connect',     editing: true },
    'ctrl+r': { control: 'btn-ruby',        editing: true },
    'ctrl+u': { control: 'btn-unity',       editing: true },
    'ctrl+s': { control: 'btn-save',        editing: true },
    'ctrl+p': { control: 'btn-speak',       editing: true },
    'ctrl+g': { control: 'btn-generate',    editing: true },
};
const PREFETCH_LINES = 10;       // 常に何行先までキャッシュ（先読み）を維持するか
const audioCache = new Map();    // 音声データキャッシュ (key: lineIndex, value: audioData)
const settingsFilePath = getUserSettingsPath(); // 設定ファイルパス取得

// 🔲DOM定義🔲
let mainContainer = null;
let btnTheme = null;
let speakerSelect = null;
let btnConnect = null;      // 「🔄接続 / ❌切断」トグルボタン
let inputAddress = null;    // 「アドレス入力」欄
let engineProgress = null;
let btnFileSelect = null;
let filePathDisplay = null;
let textInput = null;
let fontSizeSelect = null;
let btnFileClear = null;
let btnRuby = null;
let btnUnity = null;
let btnSave = null;
let btnSpeak = null;
let btnGenerate = null;
let audioPlayer = null;
let audioPlayerNext = null;
let statusDiv = null;
let engineProgressBar = null;
let textProgressContainer = null;
let textProgressBar = null;
let textBufferProgressBar = null;
let mp3ProgressBar = null;
let textElem = null;
let writingModeSelect = null;
let toastMessage = null;
let loadingOverlay = null;
let appTitle = null;
let verTitle = null;
let helpContainer = null;
let helpTableContainer = null;
let helpCloseBtn = null;
let helpTitle = null;
let changelogContainer = null;
let appConfigContainer = null;
let changelogContent = null;
let changelogCloseBtn = null;
let changelogTitle = null;

// 🔲localStorage復元🔲
let localSettings = {};

// 🔲グローバル変数定義🔲
let isSecondary = false;
let isPlaying = false;
let isStopped = false;
let isLineJumped = false;     // 再生中の行ジャンプ用フラグ
let currentLineIndex = 0;     // 再開位置を保持する行インデックス
let previousText = '';        // テキスト内容の変更検知用
let textBackup = '';
let isGenerating = false;
let isGenerateCanceled = false;
let isEngineReady = false;    // エンジン接続状態フラグ
let toastTimer = null;
let toastRemainingTime = 0;
let toastStartTime = 0;
let isPrefetching = false;    // ループ重複実行防止フラグ

document.addEventListener('DOMContentLoaded', async () => {
    // 🔲初期設定🔲
    try {
        // 多重起動（セカンダリインスタンス）判定
        isSecondary = await window.api.checkIsSecondaryInstance();
        // DOM取得
        await setupAllDomSettings();
        // 多重起動時の localStorage 書き込み防止処理
        setupLocalStorageProtection();
        // localStorage復元
        await setupAllLocalStorageSetting();
        // HTMLロード
        await setupHTMLLoad();
    } catch (err) {
        console.error('初期化エラー:', err);
    }

    // アドレスの復元
    setupAddress();
    // 音量設定の復元
    setupVolume();
    // 音量設定の変更イベント
    setupAudioPlayerSynchronization();
    // フォントサイズ選択の復元
    setupFontSize();
    // ファイルパス＆テキストの取得
    const launchData = await window.api.getLaunchArgs();
    if (launchData) {
        setupFilePathAndTextArgs();
    } else {
        setupFilePathAndText();
    }
    // テキスト向きの復元
    setupTextDirection();
    // ☀️／🌙 テーマ設定の復元
    setupTheme();

    // 🔲window イベントリスナー登録🔲
    // 画面のサイズ変更イベント
    registerWindowResize();

    // 🔲documentイベントリスナー登録🔲
    // ドキュメントのキーダウンイベント
    registerDocumentKeydown();
    // クローズ専用のキーダウンイベント
    registerDocumentKeydownClose();
    // Ｄ＆Ｄのドラッグオーバーイベント
    registerDocumentDragover();
    // Ｄ＆Ｄのドラッグリーヴイベント
    registerDocumentDragleave();
    // Ｄ＆Ｄのドロップイベント
    registerDocumentDrop();

    // 🔲個別イベントリスナー登録🔲
    // アプリタイトルのクリックイベント
    registerAppTitleClick();
    // バージョンのクリックイベント
    registerVerTitleClick();
    // ❌ヘルプのクローズのクリックイベント
    registerHelpCloseBtnClick();
    // ❌変更履歴のクローズのクリックイベント
    registerChangelogCloseBtnClick();
    // アドレスの入力イベント
    registerInputAddressChange();
    // 話者モデルの変更イベント
    registerSpeakerSelectChange();
    // フォントサイズの変更イベント
    registerFontSizeSelectChange();
    // テキスト向きの変更イベント
    registerWritingModeSelectChange();
    // ☀️／🌙テーマ設定のクリックイベント
    registerBtnThemeClick();
    // テキストのカーソル位置の変更イベント
    registerTextInputClick();
    // 📁ファイル選択のクリックイベント
    registerBtnFileSelectClick();
    // 🗑️クリアのクリックイベント
    registerBtnFileClearClick();
    // テキストの入力イベント
    registerTextInputInput();
    // 🔄接続／❌切断のクリックイベント
    registerBtnConnectClick();
    // 話者リストの変更イベント
    registerSpeakerSelectChange();
    // 🖊️読み編集のクリックイベント
    registerBtnRubyClick();
    // 🔠統一編集のクリックイベント
    registerBtnUnityClick();
    // 💾保存のクリックイベント
    registerBtnSaveClick();
    // ▶️再生／⏹️停止のクリックイベント
    registerBtnSpeakClick();
    // 🔊生成／❌中止のクリックイベント
    registerBtnGenerateClick();
    // トースターのクリックイベント
    registerToastMessageClick();
    // トースターのマウスエンターイベント
    registerToastMessageMouseenter();
    // トースターのマウスリーヴイベント
    registerToastMessageMouseleave();

    // 🔲コールバック処理🔲
    // エンジン起動状況のコールバック
    registerWindowApiOnEngineProgress();

    // 🔲初期設定🔲
    // エンジンの初期設定（※必ず初期処理、イベントリスナー登録の後に配置）
    await initEngine();
});

// 🔲初期設定関数🔲
// DOM取得
async function setupAllDomSettings() {
    mainContainer = document.querySelector('.main-container');
    btnTheme = document.getElementById('btn-theme');
    speakerSelect = document.getElementById('speaker');
    btnConnect = document.getElementById('btn-connect');
    inputAddress = document.getElementById('input-address');
    engineProgress = document.getElementById('engine-progress');
    btnFileSelect = document.getElementById('btn-file-select');
    filePathDisplay = document.getElementById('file-path-display');
    textInput = document.getElementById('text');
    fontSizeSelect = document.getElementById('font-size-select');
    btnFileClear = document.getElementById('btn-file-clear');
    btnRuby = document.getElementById('btn-ruby');
    btnUnity = document.getElementById('btn-unity');
    btnSave = document.getElementById('btn-save');
    btnSpeak = document.getElementById('btn-speak');
    btnGenerate = document.getElementById('btn-generate');
    audioPlayer = document.getElementById('audio-player');
    audioPlayerNext = document.getElementById('audio-player-next');
    statusDiv = document.getElementById('status');
    engineProgressBar = document.getElementById('engine-progress');
    textProgressContainer = document.getElementById('text-progress-container');
    textProgressBar = document.getElementById('text-progress');
    textBufferProgressBar = document.getElementById('text-buffer-progress');
    mp3ProgressBar = document.getElementById('mp3-progress');
    textElem = document.getElementById('text');
    writingModeSelect = document.getElementById('writing-mode-select');
    toastMessage = document.getElementById('toast-message');
    loadingOverlay = document.getElementById('loading-overlay');
    appTitle = document.querySelector('.app-title');
    verTitle = document.querySelector('.ver-title');
    helpContainer = document.querySelector('.help-container');
    helpTableContainer = document.getElementById('helpTableContainer');
    helpCloseBtn = document.getElementById('helpCloseBtn');
    helpTitle = helpContainer?.querySelector('h1');
    changelogContainer = document.querySelector('.changelog-container');
    appConfigContainer = document.getElementById('appConfigContainer');
    changelogContent = document.getElementById('changelogContent');
    changelogCloseBtn = document.getElementById('changelogCloseBtn');
    changelogTitle = changelogContainer?.querySelector('h1');
}

// 多重起動時の localStorage 書き込み防止処理
async function setupLocalStorageProtection() {
    if (isSecondary) {
        console.warn('⚠️ 多重起動を検知しました。localStorage への書き込みを無効化します。');

        // 原型のメソッドを保持
        const originalSetItem = localStorage.setItem.bind(localStorage);
        const originalClear = localStorage.clear.bind(localStorage);
        const originalRemoveItem = localStorage.removeItem.bind(localStorage);

        // setItem をガード
        localStorage.setItem = function (key, value) {
            console.log(`[多重起動ガード] setItem スキップ: ${key}`);
            // 何もせず書き込みをスキップ
        };

        // clear をガード
        localStorage.clear = function () {
            console.log('[多重起動ガード] clear スキップ');
        };

        // removeItem をガード
        localStorage.removeItem = function (key) {
            console.log(`[多重起動ガード] removeItem スキップ: ${key}`);
        };
    }
}

// localStorage復元
async function setupAllLocalStorageSetting() {
    if (!isSecondary) {
        // --- 初回起動（Primary）---
        localSettings[STORAGE_KEYS.FILE_PATH] = localStorage.getItem(STORAGE_KEYS.FILE_PATH);
        localSettings[STORAGE_KEYS.SERVER_ADDRESS] = localStorage.getItem(STORAGE_KEYS.SERVER_ADDRESS) || DEFAULT_HOST;
        localSettings[STORAGE_KEYS.VOLUME] = localStorage.getItem(STORAGE_KEYS.VOLUME) || '0.2';
        localSettings[STORAGE_KEYS.FONT_SIZE] = localStorage.getItem(STORAGE_KEYS.FONT_SIZE) || '16px';
        localSettings[STORAGE_KEYS.TEXT] = localStorage.getItem(STORAGE_KEYS.TEXT);
        localSettings[STORAGE_KEYS.LINE_INDEX] = localStorage.getItem(STORAGE_KEYS.LINE_INDEX);
        localSettings[STORAGE_KEYS.TEXT_BACKUP] = localStorage.getItem(STORAGE_KEYS.TEXT_BACKUP) || '';
        localSettings[STORAGE_KEYS.TEXT_DIRECTION] = localStorage.getItem(STORAGE_KEYS.TEXT_DIRECTION) || 'horizontal-tb';
        localSettings[STORAGE_KEYS.SPEAKER] = localStorage.getItem(STORAGE_KEYS.SPEAKER);

        await exportSettingsToFile(settingsFilePath);

    } else {
        // --- 多重起動（Secondary）---
        const loadedSettings = await importSettingsFromFile(settingsFilePath) || {};

        const getVal = (key, currentVal, defaultValue = null) => {
            if (loadedSettings[key] !== undefined && loadedSettings[key] !== null) {
                return loadedSettings[key];
            }
            return currentVal ?? defaultValue;
        };

        localSettings[STORAGE_KEYS.FILE_PATH] = getVal(STORAGE_KEYS.FILE_PATH, localSettings[STORAGE_KEYS.FILE_PATH], null);
        localSettings[STORAGE_KEYS.SERVER_ADDRESS] = getVal(STORAGE_KEYS.SERVER_ADDRESS, localSettings[STORAGE_KEYS.SERVER_ADDRESS], DEFAULT_HOST);
        localSettings[STORAGE_KEYS.VOLUME] = getVal(STORAGE_KEYS.VOLUME, localSettings[STORAGE_KEYS.VOLUME], '0.2');
        localSettings[STORAGE_KEYS.FONT_SIZE] = getVal(STORAGE_KEYS.FONT_SIZE, localSettings[STORAGE_KEYS.FONT_SIZE], '16px');
        localSettings[STORAGE_KEYS.TEXT] = getVal(STORAGE_KEYS.TEXT, localSettings[STORAGE_KEYS.TEXT], null);
        localSettings[STORAGE_KEYS.LINE_INDEX] = getVal(STORAGE_KEYS.LINE_INDEX, localSettings[STORAGE_KEYS.LINE_INDEX], null);
        localSettings[STORAGE_KEYS.TEXT_BACKUP] = getVal(STORAGE_KEYS.TEXT_BACKUP, localSettings[STORAGE_KEYS.TEXT_BACKUP], '');
        localSettings[STORAGE_KEYS.TEXT_DIRECTION] = getVal(STORAGE_KEYS.TEXT_DIRECTION, localSettings[STORAGE_KEYS.TEXT_DIRECTION], 'horizontal-tb');
        localSettings[STORAGE_KEYS.SPEAKER] = getVal(STORAGE_KEYS.SPEAKER, localSettings[STORAGE_KEYS.SPEAKER], null);
    }
}

// HTMLロード
async function setupHTMLLoad() {
    // 初期化処理 (HTML読み込み & 設定値反映)
    try {
        // [処理1] index_helpTable.html の読み込みと流し込み
        const helpRes = await fetch('index_helpTable.html');
        if (helpRes.ok) {
            const helpHtmlText = await helpRes.text();
            // 取得したHTMLをhelpTableContainerへ挿入
            if (helpTableContainer) {
                helpTableContainer.innerHTML = helpHtmlText;
            }
        }

        // [処理2] index_changelog.html の読み込みと流し込み
        const changelogRes = await fetch('index_changelog.html');
        if (changelogRes.ok) {
            const changelogHtmlText = await changelogRes.text();
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = changelogHtmlText;

            // appConfig を appConfigContainer に差し込む
            const appConfigEl = tempDiv.querySelector('#appConfig');
            if (appConfigEl && appConfigContainer) {
                appConfigContainer.appendChild(appConfigEl);
            }

            // changelog-list を changelogContent に差し込む
            const changelogListEl = tempDiv.querySelector('.changelog-list');
            if (changelogListEl && changelogContent) {
                changelogContent.appendChild(changelogListEl);
            }
        }

        // [処理3] appConfig の読み込みと画面への反映
        const appConfig = document.getElementById('appConfig');
        if (appConfig) {
            // dataset 経由で data-* 属性の値を取得
            const appName = appConfig.dataset.appName || '';
            const version = appConfig.dataset.version || '';

            // 設定１: タイトル部分の設定 (アイコン画像 + appName, verTitle)
            if (appTitle) {
                appTitle.innerHTML = `
                    <img src="xVoice.ico" alt="xVoice Icon" class="title-icon">
                    ${appName}
                `;
            }
            if (verTitle) {
                const secondaryIcon = isSecondary ? '🚫' : '';
                verTitle.textContent = `${version} ${secondaryIcon}`;
            }

            // 設定２: ヘルプ画面の <h1> 設定 (appName + ' ' + version)
            if (helpTitle) {
                helpTitle.textContent = `${appName} ${version} ヘルプ`;
            }

            // 設定３: 変更履歴画面の <h1> 設定 (appName + ' ' + version)
            if (changelogTitle) {
                changelogTitle.textContent = `${appName} ${version} 変更履歴`;
            }
        }
    } catch (error) {
        console.error('初期化データの読み込みに失敗しました:', error);
    }
}

// アドレスの復元
function setupAddress() {
    if (inputAddress) {
        inputAddress.value = localSettings[STORAGE_KEYS.SERVER_ADDRESS];
    }
}

// 音量設定の復元
function setupVolume() {
    if (audioPlayer) {
        audioPlayer.volume = localSettings[STORAGE_KEYS.VOLUME];
    }
    if (audioPlayerNext) {
        audioPlayerNext.volume = localSettings[STORAGE_KEYS.VOLUME];
    }
}

// フォントサイズ選択の復元
function setupFontSize() {
    applyFontSize(localSettings[STORAGE_KEYS.FONT_SIZE]);
}

// 引数ファイルパスの設定
function setupFilePathAndTextArgs() {
    // ★１ & ★３：起動時引数が存在する場合、localStorageからの復元をスキップして引数のデータで画面を更新
    // 引数ファイルパスの設定
    if (filePathDisplay) {
        filePathDisplay.textContent = launchData.filePath;
        updateFilePathMarquee();
    }

    // 引数ファイルのテキストの設定
    if (textInput) {
        const normalizedContent = launchData.content.replace(/\r\n/g, '\n');
        textInput.value = normalizedContent;
        previousText = normalizedContent;
        textBackup = normalizedContent;
        if (btnSave) btnSave.classList.remove('change-active');
    }

    // 再生位置の初期化
    currentLineIndex = 0;

    // localStorage も起動引数の値に上書き更新
    localStorageSetItemAndFile(STORAGE_KEYS.FILE_PATH, launchData.filePath);
    localStorageSetItemAndFile(STORAGE_KEYS.TEXT, launchData.content);
    localStorageSetItemAndFile(STORAGE_KEYS.LINE_INDEX, '0');
}

// ファイルパス＆テキストの復元
function setupFilePathAndText() {
    // 起動時引数がない場合は従来通り localStorage から復元

    // ファイルパスの復元
    if (localSettings[STORAGE_KEYS.FILE_PATH] && filePathDisplay) {
        filePathDisplay.textContent = localSettings[STORAGE_KEYS.FILE_PATH];
        updateFilePathMarquee();
    }

    // テキストの復元
    if (localSettings[STORAGE_KEYS.TEXT] !== null && textInput) {
        const normalizedlocalSettings = localSettings[STORAGE_KEYS.TEXT].replace(/\r\n/g, '\n');
        textInput.value = normalizedlocalSettings;
        previousText = normalizedlocalSettings;
    }

    // 再生位置の復元
    if (localSettings[STORAGE_KEYS.LINE_INDEX] !== null) {
        currentLineIndex = parseInt(localSettings[STORAGE_KEYS.LINE_INDEX], 10) || 0;
    }

    // テキストバックアップの復元
    textBackup = localSettings[STORAGE_KEYS.TEXT_BACKUP];
    if (textBackup !== textInput.value) {
        if (btnSave) btnSave.classList.add('change-active');
    }
}

// テキスト向きの復元
function setupTextDirection() {
    applyTextDirection(localSettings[STORAGE_KEYS.TEXT_DIRECTION]);
}

// テーマ設定の復元
function setupTheme() {
    setTheme(localStorage.getItem('theme') || 'dark');
}

// Engine 初期化 (アプリ起動時)
async function initEngine() {
    if (statusDiv) statusDiv.textContent = 'Engine 接続確認中...';
    isEngineReady = false;
    if (btnSpeak) btnSpeak.disabled = true;
    if (btnGenerate) btnGenerate.disabled = true;

    const address = getServerAddress();
    const res = await window.api.initEngine(address);

    if (res.success) {
        // 起動済の場合
        isEngineReady = true;
        isSelfConnected = res.isSelfConnected;
        updateConnectionUI(true);
        await loadSpeakers();
        showToast('Engine に接続済みです');
    } else {
        // 未起動の場合：自動接続（起動）を開始
        isEngineReady = false;
        updateConnectionUI(false);
        if (statusDiv) statusDiv.textContent = 'Engine 未接続（自動起動・接続を試行中...）';

        // 自動接続ハンドラーを実行
        await handleConnectToggle();
    }

    if (typeof moveCursorToLineStart === 'function') {
        moveCursorToLineStart(currentLineIndex, true);
    }
}

// 🔲window イベントリスナー登録🔲
// 画面のサイズ変更イベント
function registerWindowResize() {
    window.addEventListener('resize', () => {
        updateFilePathMarquee();
        if (textInput) {
            moveCursorToLineStart(currentLineIndex);
            setTimeout(() => {
                moveCursorToLineStart(currentLineIndex);
            }, 500);
        }
    });
}

// 🔲documentイベントリスナー登録🔲
// ドキュメントのキーダウンイベント
function registerDocumentKeydown() {
    document.addEventListener('keydown', (e) => {
        // 押された修飾キーとメインキーを組み合わせてキー文字列を作成
        const modifiers = [];
        
        // Ctrlキー または MacのCommandキー
        if (e.ctrlKey || e.metaKey) modifiers.push('ctrl');
        if (e.shiftKey) modifiers.push('shift');
        if (e.altKey) modifiers.push('alt');
    
        const mainKey = e.key.toLowerCase();
    
        // 修飾キー自体が押されただけの時は処理しない
        if (['control', 'shift', 'alt', 'meta'].includes(mainKey)) {
            return;
        }
    
        modifiers.push(mainKey);
    
        // 'ctrl+s' のような文字列を生成
        const shortcutKey = modifiers.join('+');
    
        // マッピングの取得
        const shortcutConfig = shortcutMap[shortcutKey];
    
        // マッピングが存在するか確認
        if (shortcutConfig) {
            // textInput（あるいは入力エリア全般）のフォーカス判定
            const activeEl = document.activeElement;
            const isEditing = activeEl && (
                activeEl.id === 'textInput' || 
                activeEl.tagName === 'INPUT' || 
                activeEl.tagName === 'TEXTAREA' || 
                activeEl.isContentEditable
            );
    
            // 「フォーカス中かつ editing: false」の場合はショートカットを無効化（処理しない）
            if (isEditing && !shortcutConfig.editing) {
                return;
            }
    
            // コントロール名（ボタンID）の取得と実行
            const btn = document.getElementById(shortcutConfig.control);
            if (btn) {
                e.preventDefault(); // ブラウザ標準動作のキャンセル
                btn.click();        // ボタンクリックを実行
            }
        }
    });
}

// クローズ専用のキーダウンイベント
function registerDocumentKeydownClose() {
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (mainContainer) mainContainer.style.display = 'flex';
            if (helpContainer) helpContainer.style.display = 'none';
            if (changelogContainer) changelogContainer.style.display = 'none';
        }
    });
}

// Ｄ＆Ｄのドラッグオーバーイベント
function registerDocumentDragover() {
    document.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (isPlaying) return;
        document.body.classList.add('drag-over');
    });
}

// Ｄ＆Ｄのドラッグリーヴイベント
function registerDocumentDragleave() {
    document.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.clientX === 0 && e.clientY === 0) {
            document.body.classList.remove('drag-over');
        }
    });
}

// Ｄ＆Ｄのドロップイベント
function registerDocumentDrop() {
    document.addEventListener('drop', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        document.body.classList.remove('drag-over');

        if (isPlaying) return;

        const files = e.dataTransfer?.files;
        if (!files || files.length === 0) return;

        const droppedFile = files[0];
        const filePath = droppedFile.path || (window.api.getFilePath ? window.api.getFilePath(droppedFile) : '');

        if (filePath) {
            try {
                const fileData = await window.api.readFileByPath(filePath);
                if (fileData) {
                    loadFileContent(fileData.path, fileData.content);
                }
            } catch (err) {
                console.error('D&D ファイル読み込みエラー:', err);
                showToast('ファイルの読み込みに失敗しました', 'error');
            }
        }
    });
}

// 🔲個別イベントリスナー登録🔲
// アプリタイトルのクリックイベント
function registerAppTitleClick() {
    appTitle?.addEventListener('click', () => {
        if (mainContainer) mainContainer.style.display = 'none';
        if (changelogContainer) changelogContainer.style.display = 'none';
        if (helpContainer) helpContainer.style.display = 'flex';
    });
}

// バージョンのクリックイベント
function registerVerTitleClick() {
    verTitle?.addEventListener('click', () => {
        if (mainContainer) mainContainer.style.display = 'none';
        if (helpContainer) helpContainer.style.display = 'none';
        if (changelogContainer) changelogContainer.style.display = 'flex';
    });
}

// ❌ヘルプのクローズのクリックイベント
function registerHelpCloseBtnClick() {
    helpCloseBtn?.addEventListener('click', () => {
        if (mainContainer) mainContainer.style.display = 'flex';
        if (helpContainer) helpContainer.style.display = 'none';
    });
}

// ❌変更履歴のクローズのクリックイベント
function registerChangelogCloseBtnClick() {
    changelogCloseBtn?.addEventListener('click', () => {
        if (mainContainer) mainContainer.style.display = 'flex';
        if (changelogContainer) changelogContainer.style.display = 'none';
    });
}

// アドレスの入力イベント
function registerInputAddressChange() {
    inputAddress?.addEventListener('change', (e) => {
        localStorageSetItemAndFile(STORAGE_KEYS.SERVER_ADDRESS, e.target.value.trim());
    });
}

// 話者モデルの変更イベント
function registerSpeakerSelectChange() {
    speakerSelect?.addEventListener('change', (e) => {
        localStorageSetItemAndFile(STORAGE_KEYS.SPEAKER, e.target.value);
    });
}

// フォントサイズの変更イベント
function registerFontSizeSelectChange() {
    fontSizeSelect?.addEventListener('change', (e) => {
        applyFontSize(e.target.value);
    });
}

// テキスト向きの変更イベント
function registerWritingModeSelectChange() {
    writingModeSelect?.addEventListener('change', (e) => {
        applyTextDirection(e.target.value);
    });
}

// ☀️／🌙テーマ設定のクリックイベント
function registerBtnThemeClick() {
    btnTheme?.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        setTheme(currentTheme === 'dark' ? 'light' : 'dark');
    });
}

// テキストのカーソル位置の変更イベント
function registerTextInputClick() {
    textInput?.addEventListener('click', (e) => { 
        handleCursorChange();
    });
    textInput?.addEventListener('keyup', (e) => {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'].includes(e.key)) {
            handleCursorChange();
        }
    });
}

// 📁ファイル選択のクリックイベント
function registerBtnFileSelectClick() {
    btnFileSelect?.addEventListener('click', async () => {
        const fileData = await window.api.selectFile();
        if (!fileData) return;
    
        // ★ ファイル変更時のリセット処理
        if (isPlaying) {
            stopPlayback(); // 再生中の場合は停止
        }
        clearAudioCache();   // キャッシュクリア
        resetProgressBars(); // 進捗バーを0%にリセット
    
        loadFileContent(fileData.path, fileData.content);
    });
}

// 🗑️クリアのクリックイベント
function registerBtnFileClearClick() {
    btnFileClear?.addEventListener('click', () => {
        if (filePathDisplay) filePathDisplay.textContent = '選択されていません';
        updateFilePathMarquee();
        if (textInput) textInput.value = '';
        if (btnGenerate) btnGenerate.disabled = true;
    
        currentLineIndex = 0;
        previousText = '';
        textBackup = '';
        btnSave.classList.remove('change-active');
    
        // ★ クリア時のリセット処理
        if (isPlaying) {
            stopPlayback(); // 再生中の場合は停止
        }
        clearAudioCache();   // キャッシュクリア
        resetProgressBars(); // 進捗バーを0%にリセット

        localStorage.removeItem(STORAGE_KEYS.FILE_PATH);
        localStorage.removeItem(STORAGE_KEYS.TEXT);
        localStorageSetItemAndFile(STORAGE_KEYS.LINE_INDEX, 0);
        localStorage.removeItem(STORAGE_KEYS.TEXT_BACKUP);
    });
}

// テキストの入力イベント
function registerTextInputInput() {
    textInput?.addEventListener('input', () => {
        const currentText = textInput.value.replace(/\r\n/g, '\n');
        if (btnGenerate && !isGenerating) {
            btnGenerate.disabled = !isEngineReady || !currentText.trim();
        }

        // テキストの変更表示
        if (currentText !== textBackup) {
            btnSave.classList.add('change-active');
        } else {
            btnSave.classList.remove('change-active');
        }

        clearAudioCache();
        localStorageSetItemAndFile(STORAGE_KEYS.TEXT, currentText);
    });
}

// 🔄接続／❌切断のクリックイベント
function registerBtnConnectClick() {
    btnConnect?.addEventListener('click', async () => {
        await handleConnectToggle();
    });
}

// 話者リストの変更イベント
function registerSpeakerSelectChange() {
    speakerSelect.addEventListener('change', () => {
        clearAudioCache();
        // 必要に応じてプリフェッチのリセットや停止処理
    });
}

// 🖊️読み編集のクリックイベント
function registerBtnRubyClick() {
    btnRuby.addEventListener('click', (e) => {
        // ボタンクリックによるフォーカス移動を防止
        e.preventDefault();
    
        const text = textInput.value;
        const start = textInput.selectionStart;
        const end = textInput.selectionEnd;
    
        // 1. 全角・半角に対応したルビ構造を探す（本体テキスト・読み共に0文字以上を許容）
        const rubyRegex = /[｛{]([^｜|｛{}]*)[｜|]([^｝}]*)[｝}]/g;
        let match;
        let targetMatch = null;
    
        // カーソル位置が含まれるルビブロックを特定
        while ((match = rubyRegex.exec(text)) !== null) {
            const matchStart = match.index;
            const matchEnd = matchStart + match[0].length;
    
            if (start >= matchStart && start <= matchEnd) {
                targetMatch = {
                    full: match[0],
                    bodyText: match[1], // 本体テキスト（空文字の場合もあり）
                    rubyText: match[2], // 読み（空文字の場合もあり）
                    start: matchStart,
                    end: matchEnd
                };
                break;
            }
        }
    
        // 読み解除処理（カーソルがルビ記法内に存在する場合）
        if (targetMatch) {
            const rubyBlock = targetMatch.full;
            const bodyText = targetMatch.bodyText;
    
            const scrollTop = textInput.scrollTop;
            const scrollLeft = textInput.scrollLeft;
    
            // 全体の中で対象のルビブロックが何件存在するかカウント
            const replaceCount = text.split(rubyBlock).length - 1;
    
            // 1つのルビ解除によって短くなる文字数
            const diffPerBlock = rubyBlock.length - bodyText.length;
    
            // 操作対象のルビブロックより「前」にある同一ルビブロックの個数をカウント
            const textBeforeTarget = text.substring(0, targetMatch.start);
            const matchesBefore = textBeforeTarget.split(rubyBlock).length - 1;
    
            // 置換後、対象テキスト（bodyText）の先頭となるカーソル位置を算出
            const newCursorPos = targetMatch.start - (matchesBefore * diffPerBlock);
    
            // テキスト全体から同一のルビ構造（rubyBlock）をすべて本体テキストに置換
            textInput.value = text.replaceAll(rubyBlock, bodyText);
            textInput.dispatchEvent(new Event('input', { bubbles: true }));
            textInput.focus();
    
            // 対象文字の先頭にカーソルを設定
            textInput.setSelectionRange(newCursorPos, newCursorPos);
    
            // スクロール位置を復元
            textInput.scrollTop = scrollTop;
            textInput.scrollLeft = scrollLeft;
    
            // トースト通知を表示
            showToast(`${replaceCount}件の読みを解除しました`, 'info');
            return;
        }
    
        // 2. 読み内にいない場合は、選択領域に読み構文（全角）を付与
        const selectedText = text.substring(start, end);
        const rubyFormatted = `｛${selectedText}｜｝`;
    
        textInput.focus();
        document.execCommand('insertText', false, rubyFormatted);
    
        // 「｜」と「｝」の間の位置を計算してカーソルを移動
        const targetCursorPos = start + 1 + selectedText.length + 1;
        textInput.setSelectionRange(targetCursorPos, targetCursorPos);
    });
}

// 🔠統一編集のクリックイベント
function registerBtnUnityClick() {
    btnUnity?.addEventListener('click', (e) => {
        const text = textInput.value;
        const cursorPos = textInput.selectionStart;
    
        // 全角・半角に対応したルビ構造（ ｛ / { 対象文字 ｜ / | 読み ｝ / } ）を正規表現で検索
        const rubyRegex = /[｛{]([^｜|｛{}]+)[｜|]([^｝}]*)[｝}]/g;
        let match;
        let targetMatch = null;
    
        // カーソル位置が含まれるルビ記述を特定
        while ((match = rubyRegex.exec(text)) !== null) {
            const start = match.index;
            const end = start + match[0].length;
    
            if (cursorPos >= start && cursorPos <= end) {
                targetMatch = {
                    full: match[0],       // ｛対象文字｜読み｝
                    kanji: match[1],      // 対象文字
                    ruby: match[2],       // 読み
                    start: start,
                    end: end
                };
                break;
            }
        }
    
        // 1. カーソル位置がルビ編集内でない場合
        if (!targetMatch) {
            showToast('読み編集されていません', 'warning');
            return;
        }
    
        const targetKanji = targetMatch.kanji;
        const rubyString = targetMatch.full;
    
        // 対象文字を正規表現用にエスケープ処理
        const escapedKanji = targetKanji.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
        // ① 既に存在する異なるルビ記述（例: ｛漢字｜古い読み｝ や {漢字|古い読み}）にマッチする正規表現
        const existingRubyRegex = new RegExp(`[｛{]${escapedKanji}[｜|][^｝}]*[｝}]`, 'g');
    
        // ② ルビ構文の外にある単体の対象文字にマッチする正規表現
        const plainTextRegex = new RegExp(`(?<![｛{][^｝}]*)${escapedKanji}(?![^｛{]*[｝}])`, 'g');
    
        let replaceCount = 0;
    
        // 処理1: 既存の同一対象文字を持つルビブロックを置換（自分自身以外）
        let intermediateText = text.replace(existingRubyRegex, (m, offset) => {
            if (offset >= targetMatch.start && offset < targetMatch.end) {
                return m; // カーソル位置のルビ自身はそのまま保持
            }
            if (m !== rubyString) {
                replaceCount++;
                return rubyString; // 読みが異なる既存ルビを更新
            }
            return m; // 既に同じルビ表現になっているものは維持
        });
    
        // 処理2: 未ルビ化の単体文字をルビブロックへ置換
        const newText = intermediateText.replace(plainTextRegex, (m, offset) => {
            // カーソル位置のルビブロック内部にある文字はスキップ
            if (offset >= targetMatch.start && offset < targetMatch.end) {
                return m;
            }
            replaceCount++;
            return rubyString;
        });
    
        // 2. 他に対象文字（置換対象）が見つからなかった場合
        if (replaceCount === 0) {
            showToast('統一対象の文字は存在しません', 'warning');
            return;
        }
    
        // テキストの更新とイベント発火
        textInput.value = newText;
        textInput.dispatchEvent(new Event('input', { bubbles: true }));
    
        // 3. 置き換え完了
        showToast(`${replaceCount}件の読み統一が完了しました`, 'info');
    });
}

// 💾保存のクリックイベント
function registerBtnSaveClick() {
    btnSave?.addEventListener('click', async () => {
        if (!textInput.value.trim()) {
            showToast('保存するテキストがありません。', 'warning');
            return;
        }

        const rawPath = filePathDisplay?.textContent?.trim() || '';
        const currentPath = (rawPath === '選択されていません' || rawPath === '設定されていません') ? '' : rawPath;
        const result = await window.api.saveTextFile(textInput.value, currentPath);
        if (result.success) {
            console.log('保存完了:', result.filePath);
            textBackup = textInput.value;
            btnSave.classList.remove('change-active');
            localStorageSetItemAndFile(STORAGE_KEYS.TEXT_BACKUP, textBackup);
        }
    });
}

// ▶️再生／⏹️停止のクリックイベント
function registerBtnSpeakClick() {
    btnSpeak?.addEventListener('click', () => {
        if (isPlaying) {
            stopPlayback();
        } else {
            playLineByLine();
        }
    });
}

// 🔊生成／❌中止のクリックイベント
function registerBtnGenerateClick() {
    btnGenerate?.addEventListener('click', () => {
        if (isGenerating) {
            isGenerateCanceled = true;
            btnGenerate.disabled = true;
        } else {
            generateFullTextMp3();
        }
    });
}

// トースターのクリックイベント
function registerToastMessageClick() {
    toastMessage?.addEventListener('click', hideToast);
}

// トースターのマウスエンターイベント
function registerToastMessageMouseenter() {
    toastMessage?.addEventListener('mouseenter', () => {
        if (toastTimer) {
            clearTimeout(toastTimer);
            toastTimer = null;
            // 経過時間を引いて残りの表示時間を計算
            const elapsedTime = Date.now() - toastStartTime;
            toastRemainingTime = Math.max(0, toastRemainingTime - elapsedTime);
        }
    });
}

// トースターのマウスリーヴイベント
function registerToastMessageMouseleave() {
    toastMessage?.addEventListener('mouseleave', () => {
        if (!toastMessage.classList.contains('hidden') && toastRemainingTime > 0) {
            toastStartTime = Date.now();
            toastTimer = setTimeout(() => {
                hideToast();
            }, toastRemainingTime);
        }
    });
}

// 🔲コールバック処理🔲
// エンジン起動状況のコールバック
function registerWindowApiOnEngineProgress() {
    window.api.onEngineProgress(({ current, total, isRunning }) => {
        if (engineProgressBar) {
            showProgressBar('engine');

            const percent = Math.round((current / total) * 100);
            engineProgressBar.value = percent;

            if (isRunning) {
                isEngineReady = true;
                showToast('Engine の起動が完了しました');
                if (btnGenerate && !isGenerating) {
                    btnGenerate.disabled = !textInput.value.trim();
                }
                setTimeout(() => { engineProgressBar.hidden = true; }, 1000);
            } else {
                isEngineReady = false;
                if (btnGenerate) btnGenerate.disabled = true;
                if (statusDiv) statusDiv.textContent = `Engine 起動確認中... (${current}/${total} - ${percent}%)`;
            }
        }
    });
}

// 🔲共通ヘルパー関数🔲
// 「🔄接続 / ❌切断」のトグル実行関数
async function handleConnectToggle() {
    if (isEngineReady) {
        if (statusDiv) statusDiv.textContent = 'Engine から切断中...';
        await window.api.disconnectEngine();
        isEngineReady = false;
        isSelfConnected = false;
        updateConnectionUI(false);
        if (speakerSelect) {
            speakerSelect.innerHTML = '<option value="">未接続</option>';
            speakerSelect.disabled = true;
        }
        if (btnSpeak) btnSpeak.disabled = true;
        if (btnGenerate) btnGenerate.disabled = true;
        showToast('Engine から切断されました');
    } else {
        if (statusDiv) statusDiv.textContent = 'Engine に接続中...';
        
        // 安全チェックを入れることで ReferenceError を防止
        if (typeof engineProgress !== 'undefined' && engineProgress) {
            engineProgress.value = 0;
            engineProgress.hidden = false;
        }

        if (btnConnect) btnConnect.disabled = true;
        if (inputAddress) inputAddress.disabled = true;

        const address = getServerAddress();
        // ★ リクエスト送信前にローディング表示
        showLoading(true);
        const res = await window.api.connectEngine(address);

        if (typeof engineProgress !== 'undefined' && engineProgress) {
            engineProgress.hidden = true;
        }

        if (res.success) {
            isEngineReady = true;
            isSelfConnected = res.isSelfConnected;
            updateConnectionUI(true);
            await loadSpeakers();
            showToast('Engine に接続しました');
        } else {
            isEngineReady = false;
            updateConnectionUI(false);
            showToast(res.error || '接続に失敗しました', 'error');
        }
        // ★ レスポンス受領後（成功・失敗問わず）にローディング非表示
        showLoading(false);
    }
}

// 接続状態に応じたUI切り替えヘルパー
function updateConnectionUI(connected) {
    if (!btnConnect || !inputAddress) return;

    if (connected) {
        btnConnect.textContent = '❌切断';
        btnConnect.title = 'AivisSpeech Engine切断 (Ctrl+n)'; // 接続時：切断用のツールチップ
        btnConnect.disabled = false;
        inputAddress.disabled = true; // 接続時はアドレス編集不可
        
        // 【追加】接続時は再生・一括生成ボタンを有効化
        if (btnSpeak) btnSpeak.disabled = false;
        if (btnGenerate) btnGenerate.disabled = false;
        if (speakerSelect) speakerSelect.disabled = false;
        // if (fontSizeSelect) fontSizeSelect.disabled = false;
        // if (writingModeSelect) writingModeSelect.disabled = false;
    } else {
        btnConnect.textContent = '🔄接続';
        btnConnect.title = 'AivisSpeech Engine接続 (Ctrl+n)'; // 未接続時：接続用のツールチップ
        btnConnect.disabled = false;
        inputAddress.disabled = false; // 未接続時はアドレス編集可能
        
        // 【追加】未接続時は各ボタンを無効化
        if (btnSpeak) btnSpeak.disabled = true;
        if (btnGenerate) btnGenerate.disabled = true;
        if (speakerSelect) speakerSelect.disabled = true;
        // if (fontSizeSelect) fontSizeSelect.disabled = true;
        // if (writingModeSelect) writingModeSelect.disabled = true;
    }
}

// サーバーアドレス取得ヘルパー
function getServerAddress() {
    return (inputAddress?.value.trim() || DEFAULT_HOST).replace(/\/$/, '');
}

// 🔲設定・適用ロジック関数群🔲

function applyTextDirection(direction) {
    if (!textInput) return;

    textInput.style.writingMode = direction;
    if (writingModeSelect) writingModeSelect.value = direction;
    localStorageSetItemAndFile(STORAGE_KEYS.TEXT_DIRECTION, direction);

    if (textElem) {
        textElem.classList.toggle('is-vertical', direction === 'vertical-rl');
    }
}

function applyFontSize(size) {
    if (!textInput) return;

    const oldLineHeight = parseFloat(window.getComputedStyle(textInput).lineHeight) || 20;
    const oldScrollTop = textInput.scrollTop;

    const start = textInput.selectionStart;
    const end = textInput.selectionEnd;

    textInput.style.fontSize = size;
    if (filePathDisplay) filePathDisplay.style.fontSize = size;
    if (fontSizeSelect) fontSizeSelect.value = size;
    localStorageSetItemAndFile(STORAGE_KEYS.FONT_SIZE, size);

    updateFilePathMarquee();

    const newLineHeight = parseFloat(window.getComputedStyle(textInput).lineHeight) || 20;
    if (oldLineHeight > 0) {
        const ratio = newLineHeight / oldLineHeight;
        textInput.scrollTop = oldScrollTop * ratio;
    }

    if (isPlaying && start !== null && end !== null) {
        requestAnimationFrame(() => {
            textInput.focus();
            textInput.setSelectionRange(start, end);
        });
    }
}

function showProgressBar(type) {
    if (engineProgressBar) engineProgressBar.hidden = (type !== 'engine');
    if (textProgressBar) textProgressBar.hidden = (type !== 'text');
    if (mp3ProgressBar) mp3ProgressBar.hidden = (type !== 'mp3');
}

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorageSetItemAndFile('theme', theme);
    if (btnTheme) btnTheme.textContent = theme === 'dark' ? '☀️' : '🌙';
}

function getCursorLineIndex() {
    if (!textInput) return 0;
    const fullText = textInput.value.replace(/\r\n/g, '\n');
    const cursorPos = textInput.selectionStart;
    const textUpToCursor = fullText.substring(0, cursorPos);
    return (textUpToCursor.match(/\n/g) || []).length;
}

// カーソル（再生位置）変更時の処理
function handleCursorChange() {
    // 修正前: if (!isPlaying) return;  ← これを削除

    const targetLineIndex = getCursorLineIndex();
    if (targetLineIndex !== currentLineIndex) {
        currentLineIndex = targetLineIndex;
        localStorageSetItemAndFile(STORAGE_KEYS.LINE_INDEX, currentLineIndex);

        // キャッシュとバッファ表示をクリア＆移動後の位置に同期
        clearAudioCache();

        if (isPlaying) {
            isLineJumped = true;
            stopAllAudioPlayers();
        }
    }
}

function loadFileContent(path, content) {
    const loadedText = (content || '').replace(/\r\n/g, '\n');

    if (filePathDisplay) filePathDisplay.textContent = path;
    localStorageSetItemAndFile(STORAGE_KEYS.FILE_PATH, path);

    updateFilePathMarquee();

    if (textInput) textInput.value = loadedText;
    previousText = loadedText;
    textBackup = loadedText;
    btnSave.classList.remove('change-active');
    currentLineIndex = 0;
    isFirstPlay = true;

    localStorageSetItemAndFile(STORAGE_KEYS.TEXT, loadedText);
    localStorageSetItemAndFile(STORAGE_KEYS.LINE_INDEX, 0);
    localStorageSetItemAndFile(STORAGE_KEYS.TEXT_BACKUP, loadedText);

    if (btnGenerate) btnGenerate.disabled = !isEngineReady || !textInput.value.trim();

    clearAudioCache();
    resetProgressBars();
    moveCursorToLineStart(0);
}

function updateButtonStates(playing) {
    isPlaying = playing;

    if (btnSpeak) {
        btnSpeak.textContent = playing ? '⏹️停止' : '▶️再生';
        btnSpeak.title = playing ? '停止 (Ctrl+p)' : '再生 (Ctrl+p)';
        textInput.style.cursor = playing ? 'pointer' : 'text';
    }

    if (btnGenerate && !isGenerating) {
        btnGenerate.disabled = playing || !isEngineReady || !textInput.value.trim();
    }
    if (speakerSelect) speakerSelect.disabled = playing || isGenerating;
    if (btnConnect) btnConnect.disabled = playing || isGenerating;
    if (btnFileClear) btnFileClear.disabled = playing || isGenerating;
    if (btnFileSelect) btnFileSelect.disabled = playing || isGenerating;
    if (fontSizeSelect) fontSizeSelect.disabled = playing || isGenerating;
    if (writingModeSelect) writingModeSelect.disabled = playing || isGenerating;
    if (textInput) textInput.readOnly = playing || isGenerating;
}

function resetGenerateButton() {
    isGenerating = false;
    isGenerateCanceled = false;
    if (btnGenerate) {
        btnGenerate.textContent = '🔊生成';
        btnGenerate.title = '音声生成 (Ctrl+g)';
        btnGenerate.disabled = !isEngineReady || !textInput.value.trim();
    }
    if (speakerSelect) speakerSelect.disabled = false;
    if (btnConnect) btnConnect.disabled = false;
    if (btnSpeak) btnSpeak.disabled = !isEngineReady;
    if (btnFileSelect) btnFileSelect.disabled = false;
    if (btnFileClear) btnFileClear.disabled = false;
    if (fontSizeSelect) fontSizeSelect.disabled = false;
    if (writingModeSelect) writingModeSelect.disabled = false;
    if (textInput) textInput.readOnly = false;
}

// 話者一覧取得 (動的アドレス対応)
async function loadSpeakers() {
    try {
        // ★ リクエスト送信前にローディング表示
        showLoading(true);
        const baseUrl = getServerAddress();
        const res = await fetch(`${baseUrl}/speakers`);
        if (!res.ok) throw new Error();
        const speakers = await res.json();

        if (speakerSelect) {
            speakerSelect.innerHTML = '';
            speakers.forEach(sp => {
                sp.styles.forEach(style => {
                    const opt = document.createElement('option');
                    opt.value = style.id;
                    opt.textContent = `${sp.name} (${style.name})`;
                    speakerSelect.appendChild(opt);
                });
            });

            if (localSettings[STORAGE_KEYS.SPEAKER]) {
                const exists = Array.from(speakerSelect.options).some(opt => opt.value === String(localSettings[STORAGE_KEYS.SPEAKER]));
                if (exists) {
                    speakerSelect.value = localSettings[STORAGE_KEYS.SPEAKER];
                }
            }
        }

        showToast('話者モデル取得完了');
        // ★ レスポンス受領後（成功・失敗問わず）にローディング非表示
        showLoading(false);
        return true;
    } catch (err) {
        showToast('Engine に接続できません', 'error');
        // ★ レスポンス受領後（成功・失敗問わず）にローディング非表示
        showLoading(false);
        return false;
    }
}

// 音声生成ロジック (動的アドレス対応)
async function fetchAudioBuffer(text, speakerId) {
    const baseUrl = getServerAddress();
    const processedText = text.replace(/[｛{][^｜|]+[｜|]([^｝}]+)[｝}]/g, '$1');

    const queryRes = await fetch(`${baseUrl}/audio_query?text=${encodeURIComponent(processedText)}&speaker=${speakerId}`, {
        method: 'POST'
    });
    const audioQuery = await queryRes.json();

    const synthRes = await fetch(`${baseUrl}/synthesis?speaker=${speakerId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(audioQuery)
    });

    return await synthRes.arrayBuffer();
}

function stopPlayback() {
    if (!isPlaying) return;

    isStopped = true;
    // clearAudioCache(); // 停止時にもキャッシュを完全にクリア
    stopAllAudioPlayers();

    if (statusDiv) statusDiv.textContent = `停止しました (${currentLineIndex + 1} 行目で停止中)`;
    updateButtonStates(false);

    moveCursorToLineStart(currentLineIndex, true);
}

// 1行再生処理 (行単位読み上げ)
async function playLineByLine() {
    const fullText = textInput.value.replace(/\r\n/g, '\n');
    const lines = fullText.split('\n');

    if (!fullText.trim()) return showToast('テキストを入力してください', 'warning');

    // 前回再生時とテキストが異なっていればクリア（万一イベントで拾えなかった場合の保険）
    if (previousText !== fullText) {
        clearAudioCache();
        previousText = fullText;
    }

    currentLineIndex = getCursorLineIndex();
    localStorageSetItemAndFile(STORAGE_KEYS.LINE_INDEX, currentLineIndex);

    isFirstPlay = false;

    if (currentLineIndex >= lines.length) {
        currentLineIndex = lines.length;
        localStorageSetItemAndFile(STORAGE_KEYS.LINE_INDEX, lines.length);
    }

    updateButtonStates(true);
    isStopped = false;
    isLineJumped = false;

    stopAllAudioPlayers();
    
    const currentSpeakerId = speakerSelect.value;

    showProgressBar('text');
    const initialPercent = Math.round((currentLineIndex / lines.length) * 100);
    if (textProgressBar) textProgressBar.value = initialPercent;
    if (textBufferProgressBar) textBufferProgressBar.value = initialPercent;

    // 先読みの実行（キャッシュにあるものはスキップするよう triggerPrefetch 側で制御を推薦）
    triggerPrefetch(lines, currentSpeakerId);

    const players = [audioPlayer, audioPlayerNext];
    let activePlayerIndex = 0;

    updatePlayerVisibility(activePlayerIndex);

    while (currentLineIndex < lines.length) {
        if (isStopped) break;

        const i = currentLineIndex;
        localStorageSetItemAndFile(STORAGE_KEYS.LINE_INDEX, i);

        const progressPercent = Math.round(((i + 1) / lines.length) * 100);
        if (textProgressBar) {
            textProgressBar.value = progressPercent;
        }

        const lineText = lines[i];
        const lineTrimmed = lineText.trim();

        if (lineTrimmed.length > 0) {
            if (statusDiv) statusDiv.textContent = `再生中 (${i + 1}/${lines.length} 行目 - ${progressPercent}%)`;

            moveCursorToLineStart(i);

            try {
                let audioData;
                
                // キャッシュの存在確認（見つかれば再利用）
                if (audioCache.has(i)) {
                    audioData = audioCache.get(i);
                } else {
                    // ★ リクエスト送信前にローディング表示
                    showLoading(true);
                    try {
                        audioData = await fetchAudioBuffer(lineTrimmed, currentSpeakerId);
                        // ※ fetchAudioBuffer 内で audioCache.set(i, audioData) されている前提
                    } finally {
                        // ★ レスポンス受領後（成功・失敗問わず）にローディング非表示
                        showLoading(false);
                    }
                }

                // ★ 修正点: 以前あった audioCache.delete(i); は削除します
                // （削除しないことで、停止後の再再生時にもこのキャッシュを活用できます）

                triggerPrefetch(lines, currentSpeakerId);

                if (isStopped || isLineJumped) {
                    if (isLineJumped) {
                        isLineJumped = false;
                        clearAudioCache();
                        stopAllAudioPlayers();
                        triggerPrefetch(lines, currentSpeakerId);
                        continue;
                    }
                    break;
                }

                const currentPlayer = players[activePlayerIndex];
                updatePlayerVisibility(activePlayerIndex);

                const blob = new Blob([audioData], { type: 'audio/wav' });
                const blobUrl = URL.createObjectURL(blob);

                currentPlayer.src = blobUrl;

                const nextLineIndex = i + 1;
                const nextPlayer = players[1 - activePlayerIndex];

                if (nextLineIndex < lines.length && audioCache.has(nextLineIndex)) {
                    const nextAudioData = audioCache.get(nextLineIndex);
                    const nextBlob = new Blob([nextAudioData], { type: 'audio/wav' });
                    nextPlayer.src = URL.createObjectURL(nextBlob);
                    nextPlayer.load();
                }

                await new Promise((resolve) => {
                    const checkStopped = setInterval(() => {
                        if (isStopped || isLineJumped) {
                            clearInterval(checkStopped);
                            resolve();
                        }
                    }, 100);

                    currentPlayer.onended = () => {
                        clearInterval(checkStopped);
                        URL.revokeObjectURL(blobUrl);
                        resolve();
                    };
                    currentPlayer.onerror = () => {
                        clearInterval(checkStopped);
                        URL.revokeObjectURL(blobUrl);
                        resolve();
                    };

                    currentPlayer.play().catch(() => resolve());
                });

                if (isLineJumped) {
                    isLineJumped = false;
                    clearAudioCache();
                    stopAllAudioPlayers();
                    triggerPrefetch(lines, currentSpeakerId);
                    continue;
                }

                activePlayerIndex = 1 - activePlayerIndex;

            } catch (err) {
                console.error(`行 ${i + 1} の処理でエラー:`, err);
            }
        } else {
            triggerPrefetch(lines, currentSpeakerId);
        }

        currentLineIndex++;
    }

    // 後処理
    stopAllAudioPlayers();

    // ★ 修正点: ループ末尾にあった無条件の clearAudioCache(); を削除
    // （最後まで再生完了した時のみクリアしたい場合は以下の中に記述）
    if (!isStopped && !isLineJumped) {
        clearAudioCache(); // 最後まで再生しきった場合のみクリア
        currentLineIndex = 0;
        localStorageSetItemAndFile(STORAGE_KEYS.LINE_INDEX, 0);
        showToast('再生完了');
        if (textProgressBar) textProgressBar.value = 100;
        if (textBufferProgressBar) textBufferProgressBar.value = 100;

        moveCursorToLineStart(0, true);
    }

    updateButtonStates(false);
}

async function generateFullTextMp3() {
    const lines = textInput.value.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const speakerId = speakerSelect.value;

    if (lines.length === 0) return showToast('テキストを入力してください。', 'warning');

    isGenerating = true;
    isGenerateCanceled = false;

    btnGenerate.textContent = '❌中止';
    btnGenerate.title = '生成中止 (Ctrl+g)';
    btnGenerate.disabled = false;
    btnSpeak.disabled = true;
    if (speakerSelect) speakerSelect.disabled = true;
    if (btnConnect) btnConnect.disabled = true;
    if (btnFileSelect) btnFileSelect.disabled = true;
    if (btnFileClear) btnFileClear.disabled = true;
    if (fontSizeSelect) fontSizeSelect.disabled = true;
    if (writingModeSelect) writingModeSelect.disabled = true;
    if (textInput) textInput.readOnly = true;

    showProgressBar('mp3');
    if (mp3ProgressBar) mp3ProgressBar.value = 0;

    try {
        const audioBuffers = [];

        for (let i = 0; i < lines.length; i++) {
            if (isGenerateCanceled) {
                showToast('生成処理を中止しました');
                return;
            }

            const progressPercent = Math.round(((i + 1) / lines.length) * 100);

            if (statusDiv) statusDiv.textContent = `音声生成中 (${i + 1}/${lines.length} 行目 - ${progressPercent}%)`;
            if (mp3ProgressBar) mp3ProgressBar.value = progressPercent;

            const buffer = await fetchAudioBuffer(lines[i], speakerId);

            if (isGenerateCanceled) {
                showToast('生成処理を中止しました');
                return;
            }

            audioBuffers.push(buffer);
        }

        if (statusDiv) statusDiv.textContent = 'MP3へ変換・保存中...';

        let defaultFilename = 'xVoice生成.mp3';
        if (localSettings[STORAGE_KEYS.FILE_PATH]) {
            const parts = localSettings[STORAGE_KEYS.FILE_PATH].split(/[/\\]/);
            const originalName = parts[parts.length - 1];
            const baseName = originalName.substring(0, originalName.lastIndexOf('.')) || originalName;
            defaultFilename = `${baseName}.mp3`;
        }

        if (isGenerateCanceled) {
            showToast('生成処理を中止しました');
            return;
        }

        const success = await window.api.generateAudio(audioBuffers, defaultFilename);
        if (success) {
            showToast('生成が完了しました');
        } else {
            showToast('生成がキャンセルまたは失敗しました', 'error');
        }
    } catch (err) {
        showToast('生成エラーが発生しました', 'error');
        console.error(err);
    } finally {
        resetGenerateButton();

        setTimeout(() => {
            if (mp3ProgressBar) mp3ProgressBar.hidden = true;
        }, 1500);
    }
}

// 🔲カーソル指定・レイアウト計算ヘルパー関数🔲

function moveCursorToLineStart(lineIndex, highlight = isPlaying) {
    if (!textInput) return;
    const fullText = textInput.value.replace(/\r\n/g, '\n');
    const lines = fullText.split('\n');
    if (lines.length === 0) return;

    const targetIndex = Math.max(0, Math.min(lineIndex, lines.length - 1));
    let charOffset = 0;
    for (let i = 0; i < targetIndex; i++) {
        charOffset += lines[i].length + 1;
    }

    const currentLineLength = lines[targetIndex].length;
    textInput.focus({ preventScroll: true });
    if (highlight) {
        textInput.setSelectionRange(charOffset, charOffset + currentLineLength);
    } else {
        textInput.setSelectionRange(charOffset, charOffset);
    }
    scrollTextareaToCharOffset(textInput, charOffset);
}

function scrollTextareaToCharOffset(textarea, charIndex) {
    const style = window.getComputedStyle(textarea);
    const isVertical = style.writingMode.startsWith('vertical');
    const mirror = document.createElement('div');
    
    const stylesToCopy = [
        'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing',
        'lineHeight', 'textTransform', 'wordBreak', 'overflowWrap', 'whiteSpace',
        'padding', 'boxSizing', 'direction'
    ];
    stylesToCopy.forEach(prop => { mirror.style[prop] = style[prop]; });

    if (isVertical) {
        mirror.style.writingMode = 'vertical-rl';
        mirror.style.webkitWritingMode = 'vertical-rl';
        mirror.style.height = `${textarea.clientHeight}px`;
        mirror.style.width = 'auto';
    } else {
        mirror.style.writingMode = 'horizontal-tb';
        mirror.style.width = `${textarea.clientWidth}px`;
        mirror.style.height = 'auto';
    }

    mirror.style.position = 'absolute';
    mirror.style.top = '-9999px';
    mirror.style.left = '-9999px';
    mirror.style.visibility = 'hidden';
    mirror.style.overflow = 'hidden';

    const textBefore = textarea.value.substring(0, charIndex);
    const textAfter = textarea.value.substring(charIndex);
    const span = document.createElement('span');
    span.textContent = textAfter.charAt(0) || ' ';

    mirror.textContent = textBefore;
    mirror.appendChild(span);
    document.body.appendChild(mirror);

    if (isVertical) {
        const spanLeft = span.offsetLeft;
        const spanWidth = span.offsetWidth || parseFloat(style.fontSize);
        const mirrorWidth = mirror.scrollWidth;
        document.body.removeChild(mirror);

        const charCenterFromRight = mirrorWidth - (spanLeft + (spanWidth / 2));
        const clientWidth = textarea.clientWidth;
        const scrollWidth = textarea.scrollWidth;
        const targetOffsetFromRight = charCenterFromRight - (clientWidth / 2);

        let targetScrollLeft = -targetOffsetFromRight;
        if (targetScrollLeft > 0) targetScrollLeft = 0;
        const maxNegativeScroll = -(scrollWidth - clientWidth);
        if (targetScrollLeft < maxNegativeScroll) targetScrollLeft = maxNegativeScroll;

        textarea.scrollLeft = targetScrollLeft;
    } else {
        const spanTop = span.offsetTop;
        const spanHeight = span.offsetHeight || parseFloat(style.fontSize);
        document.body.removeChild(mirror);

        const clientHeight = textarea.clientHeight;
        const targetTop = spanTop - (clientHeight / 2) + (spanHeight / 2);
        textarea.scrollTop = Math.max(0, targetTop);
    }
}

function updateFilePathMarquee() {
    if (!filePathDisplay) return;

    const firstItem = filePathDisplay.querySelector('.marquee-item');
    const currentText = firstItem ? firstItem.textContent.trim() : filePathDisplay.textContent.trim();

    if (!currentText || currentText === '選択されていません') {
        filePathDisplay.innerHTML = `<span class="file-path-text">${currentText}</span>`;
        return;
    }

    filePathDisplay.innerHTML = `
        <span class="file-path-text">
            <span class="marquee-item">${currentText}</span>
            <span class="marquee-item">${currentText}</span>
        </span>
    `;

    const textSpan = filePathDisplay.querySelector('.file-path-text');
    const itemElem = filePathDisplay.querySelector('.marquee-item');
    if (!textSpan || !itemElem) return;

    requestAnimationFrame(() => {
        const containerWidth = filePathDisplay.clientWidth;
        const singleItemWidth = itemElem.getBoundingClientRect().width;

        if (singleItemWidth > containerWidth) {
            const speed = 100;
            const duration = singleItemWidth / speed;

            textSpan.style.setProperty('--marquee-duration', `${duration}s`);
            textSpan.classList.add('scrolling');
        } else {
            filePathDisplay.innerHTML = `<span class="file-path-text">${currentText}</span>`;
        }
    });
}

// トーストを非表示にする共通関数
function hideToast() {
    if (!toastMessage) return;
    if (toastTimer) {
        clearTimeout(toastTimer);
        toastTimer = null;
    }
    toastMessage.classList.add('hidden');
}

// 呼び出し例:
// showToast('処理が完了しました', 'info');
// showToast('接続を確認してください', 'warning');
// showToast('エラーが発生しました', 'error');
function showToast(message, type = 'info', displayTime = 6000) {
    if (!toastMessage) return;

    // 既存タイマーのクリア
    if (toastTimer) {
        clearTimeout(toastTimer);
        toastTimer = null;
    }

    const icons = {
        info: 'ℹ️',
        warning: '⚠️',
        error: '🚫'
    };
    const icon = icons[type] || icons.info;

    toastMessage.classList.remove('toast-info', 'toast-warning', 'toast-error');
    toastMessage.classList.add(`toast-${type}`);
    toastMessage.textContent = `${icon} ${message}`;
    toastMessage.classList.remove('hidden');

    if (statusDiv) statusDiv.textContent = `${icon} ${message}`;

    // ★ 修正ポイント: 新しい表示に合わせて残時間と開始時間をリセット
    toastRemainingTime = displayTime;
    toastStartTime = Date.now();

    toastTimer = setTimeout(() => {
        hideToast();
    }, toastRemainingTime);
}

// キャッシュおよびバッファ表示をクリアする
function clearAudioCache() {
    audioCache.clear();
    if (textBufferProgressBar) {
        const fullText = textInput.value.replace(/\r\n/g, '\n');
        const lines = fullText.split('\n');
        
        // 移動先の行インデックスに基づいてバッファバーの位置を同期
        const currentPercent = lines.length > 0 
            ? Math.round((currentLineIndex / lines.length) * 100) 
            : 0;

        textBufferProgressBar.value = currentPercent;
    }
}

// キャッシュの保有状況に応じてバッファ用プログレスバーを表示更新する
// @param {number} totalLines 全行数
function updateBufferProgress(totalLines) {
    if (!textBufferProgressBar || totalLines === 0) return;

    if (audioCache.size === 0) {
        textBufferProgressBar.value = textProgressBar ? textProgressBar.value : 0;
        return;
    }

    const maxCachedIndex = Math.max(...audioCache.keys());
    const bufferPercent = Math.min(Math.round(((maxCachedIndex + 1) / totalLines) * 100), 100);
    textBufferProgressBar.value = bufferPercent;
}

// バックグラウンドで常に PREFETCH_LINES 分のキャッシュが埋まるよう維持する非同期ループ
// @param {Array<string>} lines 全行のテキスト配列
// @param {string} speakerId 話者ID
async function triggerPrefetch(lines, speakerId) {
    if (isPrefetching || isStopped) return;
    isPrefetching = true;

    try {
        for (let offset = 1; offset <= PREFETCH_LINES; offset++) {
            const targetIndex = currentLineIndex + offset;

            if (targetIndex >= lines.length || isStopped || isLineJumped) break;

            const textToFetch = lines[targetIndex].trim();
            
            if (textToFetch.length > 0 && !audioCache.has(targetIndex)) {
                try {
                    const data = await fetchAudioBuffer(textToFetch, speakerId);
                    if (!isStopped && !isLineJumped) {
                        audioCache.set(targetIndex, data);
                        updateBufferProgress(lines.length);
                    }
                } catch (err) {
                    console.error(`先読みエラー (行 ${targetIndex + 1}):`, err);
                }
            }
        }
    } finally {
        isPrefetching = false;
    }
}

// プログレスバー表示の切り替え関数 (コンテナ制御に対応)
// @param {string} type 'engine' | 'text' | 'mp3'
function showProgressBar(type) {
    if (engineProgressBar) engineProgressBar.hidden = (type !== 'engine');
    if (textProgressContainer) textProgressContainer.hidden = (type !== 'text');
    if (mp3ProgressBar) mp3ProgressBar.hidden = (type !== 'mp3');
}

// 両方のオーディオプレイヤーを停止・初期化する
function stopAllAudioPlayers() {
    if (audioPlayer) {
        audioPlayer.pause();
        audioPlayer.currentTime = 0;
    }
    if (audioPlayerNext) {
        audioPlayerNext.pause();
        audioPlayerNext.currentTime = 0;
    }
    // 表示を標準プレイヤー(0)に戻す
    updatePlayerVisibility(0);
}

// アクティブなプレイヤーのみ画面に表示し、もう一方を非表示にする
// @param {number} activeIndex 0: audioPlayer, 1: audioPlayerNext
function updatePlayerVisibility(activeIndex) {
    if (!audioPlayer || !audioPlayerNext) return;

    if (activeIndex === 0) {
        audioPlayerNext.classList.add('hidden-player');
        audioPlayer.classList.remove('hidden-player');
    } else {
        audioPlayer.classList.add('hidden-player');
        audioPlayerNext.classList.remove('hidden-player');
    }
}

// 2つのプレイヤー間で音量とミュート状態を同期する設定
function setupAudioPlayerSynchronization() {
    if (!audioPlayer || !audioPlayerNext) return;

    // audioPlayer の音量・ミュート変更を audioPlayerNext に同期
    audioPlayer.addEventListener('volumechange', () => {
        if (audioPlayerNext.volume !== audioPlayer.volume) {
            audioPlayerNext.volume = audioPlayer.volume;
        }
        if (audioPlayerNext.muted !== audioPlayer.muted) {
            audioPlayerNext.muted = audioPlayer.muted;
        }
        localStorageSetItemAndFile(STORAGE_KEYS.VOLUME, audioPlayer.volume);
    });

    // audioPlayerNext の音量・ミュート変更を audioPlayer に同期
    audioPlayerNext.addEventListener('volumechange', () => {
        if (audioPlayer.volume !== audioPlayerNext.volume) {
            audioPlayer.volume = audioPlayerNext.volume;
        }
        if (audioPlayer.muted !== audioPlayerNext.muted) {
            audioPlayer.muted = audioPlayerNext.muted;
        }
        localStorageSetItemAndFile(STORAGE_KEYS.VOLUME, audioPlayerNext.volume);
    });
}

// 進捗バーを 0% (リセット状態) に戻す共通関数
function resetProgressBars() {
    if (textProgressBar) textProgressBar.value = 0;
    if (textBufferProgressBar) textBufferProgressBar.value = 0;
}

// オーバーレイ表示・非表示切り替えヘルパー
function showLoading(show) {
    if (!loadingOverlay) return;
    if (show) {
        loadingOverlay.classList.remove('hidden');
    } else {
        loadingOverlay.classList.add('hidden');
    }
}

// ユーザーフォルダ内の設定ファイルパスを取得
function getUserSettingsPath() {
    // os.homedir() を使用してユーザーフォルダ直下のパスを生成
    return window.api.path.join(window.api.os.homedir(), 'xVoiceSettings.xvj');
}

// 個別設定の変更時呼び出し用関数
async function localStorageSetItemAndFile(key, value) {
    // 1. メモリ保持
    localSettings[key] = value;

    // 2. 多重起動時はファイル・localStorageに書き込まない（要件遵守）
    if (isSecondary) {
        return;
    }

    // 3. 初回起動時のみ localStorage およびファイルへ保存
    if (value === null || value === undefined) {
        localStorage.removeItem(key);
    } else {
        const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
        localStorage.setItem(key, stringValue);
    }

    await exportSettingsToFile(settingsFilePath);
}

// 設定インポート（ファイルロック対策のウェイト追加）
async function importSettingsFromFile(targetFilePath) {
    if (!targetFilePath) return null;
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const content = await window.api.fs.readFile(targetFilePath, 'utf8');
            const settings = JSON.parse(content);

            if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
                throw new Error('設定ファイルの形式が正しくありません');
            }
            return settings;
        } catch (error) {
            console.error(`設定インポート失敗 (${attempt}/${maxRetries}回目):`, error);
            if (attempt < maxRetries) {
                // 再試行前に少し待機 (ウェイト)
                await new Promise(resolve => setTimeout(resolve, 150));
            }
        }
    }
    return null;
}

// 設定のエクスポート
async function exportSettingsToFile(targetFilePath) {
    try {
        if (!targetFilePath || typeof targetFilePath !== 'string') return;

        // localStorage の内容をオブジェクトにまとめる
        const settings = {};
        for (let i = 0; i < localStorage.length; i += 1) {
            const key = localStorage.key(i);
            if (key) {
                const rawValue = localStorage.getItem(key);
                if (rawValue !== null && rawValue !== undefined) {
                    try {
                        settings[key] = JSON.parse(rawValue);
                    } catch {
                        settings[key] = rawValue;
                    }
                }
            }
        }

        const tempFilePath = `${targetFilePath}.tmp`;
        const data = JSON.stringify(settings, null, 2);

        // Preload経由の呼び出し前に値の存在を確認
        if (window.api && window.api.fs) {
            await window.api.fs.writeFile(tempFilePath, data, 'utf8');
            await window.api.fs.rename(tempFilePath, targetFilePath);
        }
    } catch (error) {
        console.error('設定エクスポート失敗:', error);
    }
}
