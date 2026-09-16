// -- renderer.js ------------------------------------------------------
// copyright = 'Copyright © 2026- @x-builder, Japan';
// email     = 'x-builder@gmail.com';
// appName   = 'xVoice -テキスト音声読み上げ- Ver1.43.0';
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
    SERVER_ADDRESS: 'xVoice_serverAddress',
    CACHE_LIMIT: 'app_cache_limit',
    BASE_VOLUME: 'xVoice_baseVolume',
    IS_MUTED: 'xVoice_isMuted'
};
// ショートカットキーと各ボタンのIDのマッピング定義
const shortcutMap = {
    'ctrl+t': { control: 'btn-theme',       editing: true },
    'ctrl+f': { control: 'btn-file-select', editing: true },
    'ctrl+c': { control: 'btn-file-clear',  editing: false },
    'ctrl+n': { control: 'btn-connect',     editing: true },
    'ctrl+r': { control: 'btn-ruby',        editing: true },
    'ctrl+u': { control: 'btn-unity',       editing: true },
    'ctrl+g': { control: 'btn-search',      editing: true },
    'ctrl+s': { control: 'btn-save',        editing: true },
    'ctrl+p': { control: 'btn-speak',       editing: true },
    'ctrl+g': { control: 'btn-generate',    editing: true },
    'ctrl+m': { control: 'volume-mute-btn', editing: true },
};
const PREFETCH_LINES = 10;       // 常に何行先までキャッシュ（先読み）を維持するか
const audioCache = new Map();    // 音声データキャッシュ (key: lineIndex, value: audioData)
const settingsFilePath = getUserSettingsPath(); // 設定ファイルパス取得

// 🔲DOM定義🔲
let mainContainer = null;        // メインコンテンツ要素（全体のレイアウト領域）
let btnTheme = null;             // テーマ切り替えボタン（ダーク/ライトモード）
let speakerSelect = null;        // 話者（ボイス/キャラクター）選択ドロップダウン
let btnConnect = null;           // 音声合成エンジン接続ボタン
let inputAddress = null;         // エンジンサーバーアドレス入力欄
let engineProgress = null;       // エンジン起動・接続処理の進捗表示領域
let btnFileSelect = null;        // テキストファイル選択ボタン
let filePathDisplay = null;      // 開いているファイルのパス表示エリア
let textInput = null;            // 本文テキスト入力・編集エリア（textarea）
let fontSizeSelect = null;       // テキストフォントサイズ変更ドロップダウン
let btnFileClear = null;         // 読み込み済みファイル解除（クリア）ボタン
let btnRuby = null;              // ルビ（読み編集 ｛漢字｜よみ｝）挿入ボタン
let btnUnity = null;             // ルビの一括統一・整形ボタン
let btnSearch = null;            // ルビ（読み編集）箇所検索ボタン
let btnSave = null;              // 設定またはテキスト保存ボタン
let btnSpeak = null;             // 音声再生 / 停止ボタン
let btnGenerate = null;          // 音声ファイル（mp3）書き出しボタン
let audioPlayer = null;          // メイン音声再生用 Audio 要素
let audioPlayerNext = null;      // 次行の先行読み込み（ダブルバッファリング）用 Audio 要素
let statusDiv = null;            // アプリケーション状態メッセージ表示エリア
let volumeMuteBtn = null;        // 音量ミュート
let volumeDisplay = null;        // 音量表示
let volumeSlider = null;         // 音量バー
let engineProgressBar = null;    // エンジン初期化進捗バー
let textProgressContainer = null; // テキスト読上げ進捗バーの親コンテナ
let progressCountEl = null;      // 進捗カウント表示
let textProgressBar = null;      // 全体のテキスト読上げ進捗バー
let textBufferProgressBar = null; // 音声データ生成（バッファリング）進捗バー
let mp3ProgressBar = null;       // mp3ファイル出力進捗バー
let cacheCountDisplay = null;    // キャッシュ数
let cacheLimitSlider = null;     // キャッシュ数変更バー
let textElem = null;             // 表示用・強調表示用テキストエレメント
let writingModeSelect = null;    // 縦書き / 横書き切り替えドロップダウン
let toastMessage = null;         // トースト通知メッセージ表示要素
let loadingOverlay = null;       // 処理中ローディング表示用オーバーレイ
let appTitle = null;             // アプリタイトル表示要素
let verTitle = null;             // バージョン情報表示要素
let copyrightText = null;        // copyright情報表示要素
let emailText = null;            // email情報表示要素
let helpContainer = null;        // ヘルプモーダルダイアログコンテナ
let helpTableContainer = null;   // ヘルプ内のショートカット・説明テーブル領域
let helpCloseBtn = null;         // ヘルプ閉じるボタン
let helpTitle = null;            // ヘルプダイアログタイトル要素
let changelogContainer = null;   // 更新履歴（チェンジログ）モーダルコンテナ
let appConfigContainer = null;   // アプリ設定用モーダルコンテナ
let changelogContent = null;     // 更新履歴本文表示領域
let changelogCloseBtn = null;    // 更新履歴閉じるボタン
let changelogTitle = null;       // 更新履歴ダイアログタイトル要素

// 🔲localStorage復元🔲
let localSettings = {};          // アプリ設定値を保持するメモリ内オブジェクト

// 🔲グローバル変数定義🔲
let isSecondary = false;         // 多重起動（セカンダリインスタンス）判定フラグ
let isPlaying = false;           // 音声再生中フラグ
let isStopped = false;           // 再生停止要求フラグ
let isLineJumped = false;        // 再生中の行ジャンプ用フラグ
let currentLineIndex = 0;        // 再開位置を保持する行インデックス
let previousText = '';           // テキスト内容の変更検知用
let textBackup = '';             // テキスト自動バックアップデータ
let isGenerating = false;        // mp3ファイル生成処理中フラグ
let isGenerateCanceled = false;  // mp3ファイル生成キャンセル要求フラグ
let isEngineReady = false;       // エンジン接続状態フラグ
let toastTimer = null;           // トースト表示タイマーID
let toastRemainingTime = 0;      // トースト一時停止時の残り表示時間
let toastStartTime = 0;          // トースト表示開始タイムスタンプ
let isPrefetching = false;       // ループ重複実行防止フラグ

document.addEventListener('DOMContentLoaded', async () => {
    // 🔲初期設定🔲
    try {
        // 多重起動（セカンダリインスタンス）判定
        isSecondary = await window.api.checkIsSecondaryInstance();
        // DOM取得
        await setupAllDomSettings();
        // 多重起動時の localStorage 書き込み防止処理
        await setupLocalStorageProtection();
        // localStorage復元
        await setupAllLocalStorageSetting();
        // HTMLロード
        await setupHTMLLoad();
    } catch (err) {
        console.error('初期化エラー:', err);
    }

    // 進捗バー非表示
    showProgressBar('none');
    // アドレスの復元
    setupAddress();
    // 音量設定の復元
    setupVolume();
    // 音量設定の変更イベント
    setupAudioPlayerSynchronization();
    // キャッシュ数の復元
    setupCacheLimit();
    // フォントサイズ選択の復元
    setupFontSize();
    // ファイルパス＆テキストの取得
    const launchData = await window.api.getLaunchArgs();
    if (launchData) {
        setupFilePathAndTextArgs(launchData);
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
    // 音量変更・キャッシュ量変更専用のキーダウンイベント
    registerDocumentKeydownVolumeAndCache();
    // 音量変更・キャッシュ量変更専用のホイールイベントリスナー
    registerDocumentWheelVolumeAndCache();
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
    // 🔄接続／切断のクリックイベント
    registerBtnConnectClick();
    // 話者リストの変更イベント
    registerSpeakerSelectChange();
    // 🖊️読み編集のクリックイベント
    registerBtnRubyClick();
    // 🔠統一編集のクリックイベント
    registerBtnUnityClick();
    // 🔍編集検索のクリックイベント
    registerBtnSearchClick();
    // 💾保存のクリックイベント
    registerBtnSaveClick();
    // ▶️再生／⏹️停止のクリックイベント
    registerBtnSpeakClick();
    // 🎤生成／中止のクリックイベント
    registerBtnGenerateClick();
    // 🔊／🔇音量バーの変更イベント
    registerVolumeMuteBtnClick();
    // トースターのクリックイベント
    registerToastMessageClick();
    // トースターのマウスエンターイベント
    registerToastMessageMouseenter();
    // トースターのマウスリーヴイベント
    registerToastMessageMouseleave();
    // キャッシュ数変更バーのインプットイベント
    registerCacheLimitSliderInput();
    // キャッシュ数変更バーの変更イベント
    registerCacheLimitSliderChange();

    // 🔲コールバック処理🔲
    // エンジン起動状況のコールバック
    registerWindowApiOnEngineProgress();

    // 🔲初期設定🔲
    // エンジンの初期設定（※必ず初期処理、イベントリスナー登録の後に配置）
    await initEngine();
    // 進捗バー初期表示
    showProgressBar('text');
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
    btnSearch = document.getElementById('btn-search');
    btnSave = document.getElementById('btn-save');
    btnSpeak = document.getElementById('btn-speak');
    btnGenerate = document.getElementById('btn-generate');
    audioPlayer = document.getElementById('audio-player');
    audioPlayerNext = document.getElementById('audio-player-next');
    statusDiv = document.getElementById('status');
    volumeMuteBtn = document.getElementById('volume-mute-btn');
    volumeDisplay = document.getElementById('volume-display');
    volumeSlider = document.getElementById('volume-slider');
    engineProgressBar = document.getElementById('engine-progress');
    textProgressContainer = document.getElementById('text-progress-container');
    progressCountEl = document.getElementById('progress-count');
    textProgressBar = document.getElementById('text-progress');
    textBufferProgressBar = document.getElementById('text-buffer-progress');
    mp3ProgressBar = document.getElementById('mp3-progress');
    cacheCountDisplay = document.getElementById('cache-count-display');
    cacheLimitSlider = document.getElementById('cache-limit-slider');
    textElem = document.getElementById('text');
    writingModeSelect = document.getElementById('writing-mode-select');
    toastMessage = document.getElementById('toast-message');
    loadingOverlay = document.getElementById('loading-overlay');
    appTitle = document.querySelector('.app-title');
    verTitle = document.querySelector('.ver-title');
    copyrightText = document.querySelector('.copyright-text');
    emailText = document.querySelector('.email-text');
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
        localSettings[STORAGE_KEYS.CACHE_LIMIT] = localStorage.getItem(STORAGE_KEYS.CACHE_LIMIT || PREFETCH_LINES.toString());

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
        localSettings[STORAGE_KEYS.CACHE_LIMIT] = getVal(STORAGE_KEYS.CACHE_LIMIT, localSettings[STORAGE_KEYS.CACHE_LIMIT], PREFETCH_LINES.toString());
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

            // dataset 経由で data-* 属性の値を取得
            if (copyrightText) copyrightText.textContent = appConfig.dataset.copyright || '';
            if (emailText) emailText.textContent = appConfig.dataset.email || '';
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
    // 1. localStorage から状態を読み込み
    const savedBaseVolume = localStorage.getItem(STORAGE_KEYS.BASE_VOLUME);
    const savedIsMuted = localStorage.getItem(STORAGE_KEYS.IS_MUTED);

    // baseVolume が未保存なら デフォルト 0.2 (20%)
    let baseVol = savedBaseVolume !== null ? parseFloat(savedBaseVolume) : 0.2;
    let isMuted = savedIsMuted === 'true';

    // 初期化時に反映
    applyVolumeState(baseVol, isMuted);
}

// キャッシュ数の復元
function setupCacheLimit() {
    if (cacheLimitSlider) {
        const savedCacheLimit = localSettings[STORAGE_KEYS.CACHE_LIMIT];
        if (savedCacheLimit) {
            cacheLimitSlider.value = savedCacheLimit;
        } else {
            cacheLimitSlider.value = PREFETCH_LINES;
            localStorageSetItemAndFile(STORAGE_KEYS.CACHE_LIMIT, cacheLimitSlider.value);
        }
        // 初期表示（実キャッシュ数を自動反映）
        updateCacheCountUI(cacheLimitSlider.value);
    }
}

// フォントサイズ選択の復元
function setupFontSize() {
    applyFontSize(localSettings[STORAGE_KEYS.FONT_SIZE]);
}

// 引数ファイルパスの設定
function setupFilePathAndTextArgs(launchData) {
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

// 音量変更・キャッシュ量変更専用のキーダウンイベント
function registerDocumentKeydownVolumeAndCache() {
    document.addEventListener('keydown', (event) => {
        // 音量変更バー：Altキーが押されている場合
        if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')
            && isPlaying
        ) {
            if (!volumeSlider) return;

            event.preventDefault(); // ページのスクロール動作等を防止

            const step = Number(volumeSlider.step) || 1;
            const min = Number(volumeSlider.min);
            const max = Number(volumeSlider.max);
            let currentValue = Number(volumeSlider.value);

            if (event.key === 'ArrowUp') {
                currentValue = Math.min(max, currentValue + step);
            } else if (event.key === 'ArrowDown') {
                currentValue = Math.max(min, currentValue - step);
            }

            volumeSlider.value = currentValue;
            localStorageSetItemAndFile(STORAGE_KEYS.BASE_VOLUME, currentValue);
            // input イベントを発火させて表示（「20%」など）や音量処理を更新
            volumeSlider.dispatchEvent(new Event('input', { bubbles: true }));
        }

        // キャッシュ数変更バー：Ctrlキーが押されている場合
        if (event.ctrlKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')
            && isPlaying
        ) {
            if (!cacheLimitSlider) return;

            event.preventDefault(); // ページのスクロール動作等を防止

            const step = Number(cacheLimitSlider.step) || 1;
            const min = Number(cacheLimitSlider.min);
            const max = Number(cacheLimitSlider.max);
            let currentValue = Number(cacheLimitSlider.value);

            if (event.key === 'ArrowUp') {
                currentValue = Math.min(max, currentValue + step);
            } else if (event.key === 'ArrowDown') {
                currentValue = Math.max(min, currentValue - step);
            }

            cacheLimitSlider.value = currentValue;
            localStorageSetItemAndFile(STORAGE_KEYS.CACHE_LIMIT, currentValue);
            // input イベントを発火させて表示や処理を更新
            cacheLimitSlider.dispatchEvent(new Event('input', { bubbles: true }));
        } 
    });
}

// documentのホイールイベントリスナー
function registerDocumentWheelVolumeAndCache() {
    document.addEventListener('wheel', (event) => {
        // 音量変更バー：再生中 かつ Altキー押下時
        if (event.altKey && isPlaying) {
            event.preventDefault(); // ページのスクロールを防止
    
            const step = Number(volumeSlider.step) || 1;
            const min = Number(volumeSlider.min);
            const max = Number(volumeSlider.max);
            let currentValue = Number(volumeSlider.value);
    
            // deltaY < 0 は上ホイール（音量アップ）、deltaY > 0 は下ホイール（音量ダウン）
            if (event.deltaY < 0) {
                currentValue = Math.min(max, currentValue + step);
            } else if (event.deltaY > 0) {
                currentValue = Math.max(min, currentValue - step);
            }
    
            volumeSlider.value = currentValue;
            localStorageSetItemAndFile(STORAGE_KEYS.BASE_VOLUME, currentValue);
            volumeSlider.dispatchEvent(new Event('input', { bubbles: true }));
        }
        
        // キャッシュ数変更バー；再生中 かつ Ctrlキー押下時
        if (event.ctrlKey && isPlaying) {
            event.preventDefault(); // ページのスクロールを防止
    
            const step = Number(cacheLimitSlider.step) || 1;
            const min = Number(cacheLimitSlider.min);
            const max = Number(cacheLimitSlider.max);
            let currentValue = Number(cacheLimitSlider.value);
    
            // deltaY < 0 は上ホイール（キャッシュアップ）、deltaY > 0 は下ホイール（キャッシュダウン）
            if (event.deltaY < 0) {
                currentValue = Math.min(max, currentValue + step);
            } else if (event.deltaY > 0) {
                currentValue = Math.max(min, currentValue - step);
            }
    
            cacheLimitSlider.value = currentValue;
            localStorageSetItemAndFile(STORAGE_KEYS.CACHE_LIMIT, currentValue);
            cacheLimitSlider.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }, { passive: false });
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

        let files = e.dataTransfer?.files;
        if (!files || files.length === 0) return;

        const droppedFile = files[0];
        const filePath = droppedFile.path || (window.api.getFilePath ? window.api.getFilePath(droppedFile) : '');

        // --- 【追加】Chromium 側の DataTransfer 情報を削除してファイルを解放 ---
        if (e.dataTransfer && typeof e.dataTransfer.clearData === 'function') {
            e.dataTransfer.clearData();
        }
        // FileList 参照の破棄
        files = null;
        // -------------------------------------------------------------------

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
        showProgressBar('text');
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

// 🔄接続／切断のクリックイベント
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

// 🔍編集検索のクリックイベント
function registerBtnSearchClick() {
    btnSearch?.addEventListener('click', (e) => {
        if (!textInput) return;
    
        const text = textInput.value;
        if (!text) {
            showToast('読み編集が存在しません');
            return;
        }
    
        // 全角・半角のルビ記号を同一視するパターン
        const pattern = /[｛{][^｜|\r\n]*[｜|][^｝}\r\n]*[｝}]/g;
    
        const matches = [];
        let match;
    
        // テキスト全体からすべてのルビ表記候補を抽出
        while ((match = pattern.exec(text)) !== null) {
            matches.push({
                start: match.index,
                end: match.index + match[0].length
            });
        }
    
        // ルビ表記が存在しない場合
        if (matches.length === 0) {
            showToast('読み編集が存在しません');
            return;
        }
    
        // 現在のカーソル/選択範囲の終了位置を取得
        const currentPos = textInput.selectionEnd ?? 0;
    
        // 現在位置より後ろにある最初のマッチを検索
        let target = matches.find(m => m.start >= currentPos);
    
        // 末尾に達している場合は先頭へ戻る（周回）
        if (!target) {
            target = matches[0];
        }
    
        // --- スクロール・ハイライト処理 ---
    
        // 1. ヒット位置（target.start）が「何行目か」を計算
        const textUpToTarget = text.substring(0, target.start).replace(/\r\n/g, '\n');
        const targetLineIndex = textUpToTarget.split('\n').length - 1;
    
        // 2. moveCursorToLineStart を呼び出して行位置へスクロールさせる
        //    （第2引数を false にして関数内の全行選択ハイライトを一旦防ぐ）
        moveCursorToLineStart(targetLineIndex, false);
    
        // 3. 該当の「読み編集」部分のみを正確にハイライト選択
        textInput.focus({ preventScroll: true });
        textInput.setSelectionRange(target.start, target.end);
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

// 🎤生成／中止のクリックイベント
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

// 🔊／🔇音量バーの変更イベント
function registerVolumeMuteBtnClick() {
    // 【1】 [🔊 / 🔇] ボタンのトグルイベント
    volumeMuteBtn.addEventListener('click', () => {
        const currentIsMuted = localStorage.getItem(STORAGE_KEYS.IS_MUTED) === 'true';
        const nextIsMuted = !currentIsMuted;

        if (nextIsMuted) {
            // --- ミュート時 (isMuted = true) ---
            // ※ baseVolume は変更・上書きせずそのまま維持
            const baseVol = parseFloat(localStorage.getItem(STORAGE_KEYS.BASE_VOLUME) || '0.2');
            applyVolumeState(baseVol, true);
        } else {
            // --- ミュート解除時 (isMuted = false) ---
            let baseVol = parseFloat(localStorage.getItem(STORAGE_KEYS.BASE_VOLUME) || '0.2');
            
            // baseVolume が存在しない、または 0% の場合は 20% (0.2) を復元
            if (isNaN(baseVol) || baseVol <= 0) {
                baseVol = 0.2;
                localStorageSetItemAndFile(STORAGE_KEYS.BASE_VOLUME, baseVol);
            }
            
            applyVolumeState(baseVol, false);
        }
    });

    // 【2】 音量バー (スライダー) 操作イベント (input)
    volumeSlider.addEventListener('input', (e) => {
        const sliderValue = parseInt(e.target.value, 10); // 0 ～ 100
        const volumeValue = sliderValue / 100;           // 0.0 ～ 1.0

        if (sliderValue === 0) {
            // 値が 0% の場合は自動的に isMuted = true
            applyVolumeState(0, true);
        } else {
            // 値が 0% より大きい場合は baseVolume を保存して isMuted = false
            localStorageSetItemAndFile(STORAGE_KEYS.BASE_VOLUME, volumeValue);
            applyVolumeState(volumeValue, false);
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

// キャッシュ数変更バーのインプットイベント
function registerCacheLimitSliderInput() {
    // 操作中 (input イベント): スライダー値の変更時も現在の実キャッシュ数を保持して更新
    cacheLimitSlider.addEventListener('input', (e) => {
        updateCacheCountUI(e.target.value);
    });
}

// キャッシュ数変更バーの変更イベント
function registerCacheLimitSliderChange() {
// 確定時 (change イベント): localStorageへの保存とキャッシュ溢れ時の削除を実行
    cacheLimitSlider.addEventListener('change', (e) => {
        const newLimit = parseInt(e.target.value, 10);
        currentCacheLimit = newLimit;
        
        // localStorage に保存
        localStorageSetItemAndFile(STORAGE_KEYS.CACHE_LIMIT, newLimit);
        
        // キャッシュ整理の実行
        pruneAudioCache(newLimit);
    });
}

// 🔲コールバック処理🔲
// エンジン起動状況のコールバック
function registerWindowApiOnEngineProgress() {
    window.api.onEngineProgress(({ current, total, isRunning }) => {
        if (engineProgressBar) {
            showProgressBar('engine');

            if (isRunning) {
                isEngineReady = true;
                showToast('Engine の起動が完了しました');
                showProgressBar('text');
            } else {
                isEngineReady = false;
                updateProgressUI(engineProgressBar, current, total, '回');
                if (statusDiv) statusDiv.textContent = `Engine 起動確認中... (${current}/${total} - ${percent}%)`;
            }
        }
    });
}

// 🔲共通ヘルパー関数🔲
// 「🔄接続 / 切断」のトグル実行関数
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
    }
}

// 接続状態に応じたUI切り替えヘルパー
function updateConnectionUI(connected) {
    if (!btnConnect || !inputAddress) return;

    if (connected) {
        btnConnect.textContent = '🔄';
        btnConnect.classList.add('connect-active');
        btnConnect.title = 'AivisSpeech Engine切断 (Ctrl+n)';
        btnConnect.disabled = false;
        inputAddress.disabled = true; // 接続時はアドレス編集不可
        
        // 接続時は再生・一括生成ボタンを有効化
        if (btnSpeak) btnSpeak.disabled = false;
        if (btnGenerate) btnGenerate.disabled = false;
        if (speakerSelect) speakerSelect.disabled = false;
    } else {
        btnConnect.textContent = '🔄';
        btnConnect.classList.remove('connect-active');
        btnConnect.title = 'AivisSpeech Engine接続 (Ctrl+n)';
        btnConnect.disabled = false;
        inputAddress.disabled = false; // 未接続時はアドレス編集可能
        
        // 未接続時は各ボタンを無効化
        if (btnSpeak) btnSpeak.disabled = true;
        if (btnGenerate) btnGenerate.disabled = true;
        if (speakerSelect) speakerSelect.disabled = true;
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
    showProgressBar('text');
    moveCursorToLineStart(0);
}

function updateButtonStates(playing) {
    isPlaying = playing;

    if (btnSpeak) {
        if (playing) {
            btnSpeak.textContent = '⏹️';
            btnSpeak.title = '停止 (Ctrl+p)';
            btnSpeak.classList.add('play-active')
            textInput.style.cursor = 'pointer';
        } else {
            btnSpeak.textContent = '▶️';
            btnSpeak.title = '再生 (Ctrl+p)';
            btnSpeak.classList.remove('play-active');
            textInput.style.cursor = 'text';
        }
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
        btnGenerate.textContent = '🎤';
        btnGenerate.classList.remove('generate-active');
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

    while (currentLineIndex < lines.length) {
        if (isStopped) break;

        const i = currentLineIndex;
        localStorageSetItemAndFile(STORAGE_KEYS.LINE_INDEX, i);

        const currentDisplayLine = i + 1;
        const progressPercent = Math.round((currentDisplayLine / lines.length) * 100);
        updateProgressUI(textProgressBar, currentDisplayLine, lines.length, '行');

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
        if (textBufferProgressBar) textBufferProgressBar.value = 0;
        showProgressBar('text')
        moveCursorToLineStart(0, true);
    }

    updateButtonStates(false);
}

async function generateFullTextMp3() {
    if (!textInput) return;

    // 空行フィルター前の元テキストの行リスト（元の行番号計算用）
    const allLines = textInput.value.replace(/\r\n/g, '\n').split('\n');

    // 空行を除外した生成対象データ（テキストと元の行番号のペアを保持）
    const targets = [];
    allLines.forEach((lineText, originalLineIndex) => {
        const trimmed = lineText.trim();
        if (trimmed.length > 0) {
            targets.push({ text: trimmed, originalLineIndex });
        }
    });

    const speakerId = speakerSelect.value;

    if (targets.length === 0) return showToast('テキストを入力してください。', 'warning');

    isGenerating = true;
    isGenerateCanceled = false;

    btnGenerate.textContent = '🎤';
    btnGenerate.classList.add('generate-active');
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

        for (let i = 0; i < targets.length; i++) {
            if (isGenerateCanceled) {
                showToast('生成処理を中止しました');
                showProgressBar('text');
                return;
            }

            const { text, originalLineIndex } = targets[i];

            // 生成対象行をスクロール＆ハイライト表示 (第2引数を true に指定)
            moveCursorToLineStart(originalLineIndex, true);

            const progressPercent = Math.round(((i + 1) / targets.length) * 100);

            if (statusDiv) statusDiv.textContent = `音声生成中 (${i + 1}/${targets.length} 行目 - ${progressPercent}%)`;
            if (mp3ProgressBar) mp3ProgressBar.value = progressPercent;

            const buffer = await fetchAudioBuffer(text, speakerId);

            if (isGenerateCanceled) {
                showToast('生成処理を中止しました');
                showProgressBar('text');
                return;
            }

            audioBuffers.push(buffer);
        }

        if (statusDiv) statusDiv.textContent = '合成音声（mp3）を生成中...';

        let defaultFilename = 'xVoice生成.mp3';
        if (localSettings[STORAGE_KEYS.FILE_PATH]) {
            const parts = localSettings[STORAGE_KEYS.FILE_PATH].split(/[/\\]/);
            const originalName = parts[parts.length - 1];
            const baseName = originalName.substring(0, originalName.lastIndexOf('.')) || originalName;
            defaultFilename = `${baseName}.mp3`;
        }

        if (isGenerateCanceled) {
            showToast('生成処理を中止しました');
            showProgressBar('text');
            return;
        }

        const success = await window.api.generateAudio(audioBuffers, defaultFilename);
        if (success) {
            showToast('生成が完了しました');
        } else {
            showToast('生成がキャンセルまたは失敗しました', 'error');
        }
        showProgressBar('text');
    } catch (err) {
        showToast('生成エラーが発生しました', 'error');
        showProgressBar('text');
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
    updateCacheCountUI(cacheLimitSlider.value); // UIのカウントを 0 に更新
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
                // 先読み前に上限チェックとあふれ分の削除を実行
                pruneAudioCache(cacheLimitSlider.value - 1); // 1件追加予定のため余裕を作る
                try {
                    const data = await fetchAudioBuffer(textToFetch, speakerId);
                    if (!isStopped && !isLineJumped) {
                        audioCache.set(targetIndex, data);
                        updateCacheCountUI(cacheLimitSlider.value); // UIのカウントをインクリメント更新
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

    // 'engine'、'mp3'以外の場合は'text'を初期表示
    if (type !== 'engine' && type !== 'mp3') {
        const fullText = textInput.value.replace(/\r\n/g, '\n');
        const lines = fullText.length > 0 ? fullText.split('\n') : [];
        const lineIndex = fullText.length > 0 ? currentLineIndex + 1 : 0;
        if (lines.length > 0) {
            updateProgressUI(textProgressBar, lineIndex, lines.length, '行');
        } else {
            updateProgressUI(textProgressBar, 0, 100, '行');
        }
    }
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
}

// 2つのプレイヤー間で音量とミュート状態を同期する設定
function setupAudioPlayerSynchronization() {
    if (!audioPlayer || !audioPlayerNext) return;

    audioPlayer.addEventListener('volumechange', () => {
        if (audioPlayerNext.volume !== audioPlayer.volume) {
            audioPlayerNext.volume = audioPlayer.volume;
        }
    });

    audioPlayerNext.addEventListener('volumechange', () => {
        if (audioPlayer.volume !== audioPlayerNext.volume) {
            audioPlayer.volume = audioPlayerNext.volume;
        }
    });
}

// 進捗バーを 0% (リセット状態) に戻す共通関数
function resetProgressBars() {
    if (textProgressBar) {
        textProgressBar.value = 0;
        textProgressBar.max = 100;
    }
    if (textBufferProgressBar) {
        textBufferProgressBar.value = 0;
        textBufferProgressBar.max = 100;
    }
    updateProgressUI(textProgressBar, 0, 0, '行');
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
        if (window.api && window.api.saveSettingsFile) {
            await window.api.saveSettingsFile(tempFilePath, data, 'utf8');
        }
    } catch (error) {
        console.error('設定エクスポート失敗:', error);
    }
}

// 数値を指定の桁数に揃え、固定幅フォーマットテキストを生成する
// 例: formatProgress(3, 10, '行') -> " 3/10行" または "03/10行"
function formatProgressText(current, max, unit = '') {
    const paddedCurrent = String(current).padStart(4, ' ');
    const paddedMax = String(max).padStart(4, ' ');
    return `${paddedCurrent}/${paddedMax}${unit}`;
}

// プログレスバーの value / max と数値を一括更新する
function updateProgressUI(progressBar, current, max, unit = '') {
    if (progressBar) {
        progressBar.value = current;
        progressBar.max = Math.max(max, 1);
    }
    if (progressCountEl) {
        progressCountEl.textContent = formatProgressText(current, max, unit);
    }
}
    
// UI表示フォーマット関数 (` 10件` の形式)
function updateCacheCountUI(limitValue, currentCount = audioCache.size) {
    if (!cacheCountDisplay) return;

    // それぞれ 3桁のスペース埋めで桁揃え
    const paddedCurrent = String(currentCount).padStart(3, ' ');
    const paddedLimit = String(limitValue).padStart(3, ' ');

    cacheCountDisplay.textContent = `${paddedCurrent}/${paddedLimit}件`;
}

// 設定された上限数を超過したキャッシュを古い順に削除する
// @param {number} limit 許容する最大キャッシュ保持件数
function pruneAudioCache(limit) {
    if (audioCache.size <= limit) {
        // 削除が発生しない場合でもUI表示を最新に更新
        updateCacheCountUI(cacheLimitSlider.value);
        return;
    }

    // 削除対象外にする重要ライン（保護対象）
    const protectedIndices = new Set();
    
    // 現在再生中の行（再生処理中の場合）
    if (typeof currentLineIndex === 'number') {
        protectedIndices.add(currentLineIndex);
        
        // 直後の再生キュー行（次に再生予定の行）
        protectedIndices.add(currentLineIndex + 1);
    }

    // キャッシュされているキー（行インデックス）を昇順（古い順）にソート
    const sortedKeys = Array.from(audioCache.keys()).sort((a, b) => a - b);

    // 削除が必要な件数
    const excessCount = audioCache.size - limit;
    let deletedCount = 0;

    for (const key of sortedKeys) {
        if (deletedCount >= excessCount) break;

        // 現在再生中および直後キューの行はスキップして破棄を回避
        if (protectedIndices.has(key)) {
            continue;
        }

        // キャッシュ削除
        audioCache.delete(key);
        deletedCount++;
    }

    // ★ キャッシュ削除後に UI 表示を更新
    updateCacheCountUI(cacheLimitSlider.value);

    // バッファバー等のプログレス表示を更新（利用可能な場合）
    if (typeof updateBufferProgress === 'function' && typeof lines !== 'undefined') {
        updateBufferProgress(lines.length);
    }
}

// 音量状態のUIおよび各プレイヤーへの適用処理
function applyVolumeState(baseVol, isMuted) {
    const activeVolume = isMuted ? 0 : baseVol;

    // プレイヤーへの反映 (0.0 ～ 1.0)
    if (audioPlayer) audioPlayer.volume = activeVolume;
    if (audioPlayerNext) audioPlayerNext.volume = activeVolume;

    // UI表示の更新
    const percentStr = `${Math.round(activeVolume * 100)}%`.padStart(4, ' ');
    volumeDisplay.textContent = percentStr;
    volumeSlider.value = Math.round(activeVolume * 100);
    volumeMuteBtn.textContent = isMuted ? '🔇' : '🔊';
    volumeMuteBtn.title = isMuted ? 'ミュート解除 (Ctrl+m)' : 'ミュート設定 (Ctrl+m)';

    // 状態の保存
    localStorageSetItemAndFile(STORAGE_KEYS.IS_MUTED, isMuted);
}
