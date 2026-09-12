// -- renderer.js ------------------------------------------------------
// copyright = 'Copyright © 2026- @x-builder, Japan';
// email     = 'x-builder@gmail.com';
// appName   = 'xVoice -テキスト音声読み上げ- Ver1.21.0';
// ---------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
    // 🔲イミディエイト定義🔲
    const DEFAULT_HOST = 'http://127.0.0.1:10101';
    // --- localStorage保存・復元用キー定数 ---
    const STORAGE_KEYS = {
        FILE_PATH: 'xVoice_filePath',
        TEXT: 'xVoice_text',
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

    // 🔲DOM定義🔲
    let btnTheme = null;
    let speakerSelect = null;
    let btnConnect = null;      // 「🔄 接続 / ❌ 切断」トグルボタン
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

    // 🔲グローバル変数定義🔲
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
    let isPrefetching = false;    // ループ重複実行防止フラグ

    // 🔲初期設定🔲
    setupAllDomSettings();

    // アドレスの復元
    const savedAddress = localStorage.getItem(STORAGE_KEYS.SERVER_ADDRESS) || DEFAULT_HOST;
    if (inputAddress) {
        inputAddress.value = savedAddress;
    }

    // 音量設定の復元
    const savedVolume = localStorage.getItem(STORAGE_KEYS.VOLUME) || '0.2';
    if (audioPlayer) {
        audioPlayer.volume = savedVolume;
    }
    if (audioPlayerNext) {
        audioPlayerNext.volume = savedVolume;
    }

    // フォントサイズ選択の復元
    const savedFontSize = localStorage.getItem(STORAGE_KEYS.FONT_SIZE) || '16px';
    applyFontSize(savedFontSize);

    // ファイルパスの復元
    const savedFilePath = localStorage.getItem(STORAGE_KEYS.FILE_PATH);
    if (savedFilePath && filePathDisplay) {
        filePathDisplay.textContent = savedFilePath;
        updateFilePathMarquee();
    }

    // テキストの復元
    const savedText = localStorage.getItem(STORAGE_KEYS.TEXT);
    if (savedText !== null && textInput) {
        const normalizedSavedText = savedText.replace(/\r\n/g, '\n');
        textInput.value = normalizedSavedText;
        previousText = normalizedSavedText;
        textBackup = normalizedSavedText;
        btnSave.classList.remove('change-active');
    }

    // 再生位置の復元
    const savedLineIndex = localStorage.getItem(STORAGE_KEYS.LINE_INDEX);
    if (savedLineIndex !== null) {
        currentLineIndex = parseInt(savedLineIndex, 10) || 0;
    }

    // テキスト向きの復元
    const savedTextDirection = localStorage.getItem(STORAGE_KEYS.TEXT_DIRECTION) || 'horizontal-tb';
    applyTextDirection(savedTextDirection);

    // テーマ設定の復元
    setTheme(localStorage.getItem('theme') || 'dark');

    // 🔲window イベントリスナー登録🔲
    window.addEventListener('resize', () => {
        updateFilePathMarquee();
        if (textInput) {
            moveCursorToLineStart(currentLineIndex);
            setTimeout(() => {
                moveCursorToLineStart(currentLineIndex);
            }, 500);
        }
    });

    // 🔲個別イベントリスナー登録🔲
    // アドレス入力の保存
    inputAddress?.addEventListener('change', (e) => {
        localStorage.setItem(STORAGE_KEYS.SERVER_ADDRESS, e.target.value.trim());
    });

    // 話者モデルの選択変更イベント
    speakerSelect?.addEventListener('change', (e) => {
        localStorage.setItem(STORAGE_KEYS.SPEAKER, e.target.value);
    });

    // フォントサイズ変更イベント
    fontSizeSelect?.addEventListener('change', (e) => {
        applyFontSize(e.target.value);
    });

    // テキスト向きの変更イベント
    writingModeSelect?.addEventListener('change', (e) => {
        applyTextDirection(e.target.value);
    });

    // テーマ設定のクリックイベント
    btnTheme?.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        setTheme(currentTheme === 'dark' ? 'light' : 'dark');
    });

    // カーソル位置変更イベント
    textInput?.addEventListener('click', (e) => { 
        handleCursorChange();
    });
    textInput?.addEventListener('keyup', (e) => {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'].includes(e.key)) {
            handleCursorChange();
        }
    });
    
    // ファイル選択のクリックイベント
    btnFileSelect?.addEventListener('click', async () => {
        const fileData = await window.api.selectFile();
        if (!fileData) return;
        loadFileContent(fileData.path, fileData.content);
    });

    // 音量設定の変更イベントリスナー
    setupAudioPlayerSynchronization();

    // Ｄ＆Ｄ イベントリスナー
    document.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (isPlaying) return;
        document.body.classList.add('drag-over');
    });

    document.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.clientX === 0 && e.clientY === 0) {
            document.body.classList.remove('drag-over');
        }
    });

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

    // クリアボタンのクリックイベント
    btnFileClear?.addEventListener('click', () => {
        if (filePathDisplay) filePathDisplay.textContent = '選択されていません';
        updateFilePathMarquee();
        if (textInput) textInput.value = '';
        if (btnGenerate) btnGenerate.disabled = true;

        currentLineIndex = 0;
        previousText = '';
        textBackup = '';
        btnSave.classList.remove('change-active');

        localStorage.removeItem(STORAGE_KEYS.FILE_PATH);
        localStorage.removeItem(STORAGE_KEYS.TEXT);
        localStorage.setItem(STORAGE_KEYS.LINE_INDEX, 0);
    });

    // テキストの入力イベント
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

        localStorage.setItem(STORAGE_KEYS.TEXT, currentText);
    });

    // 「🔄 接続 / ❌ 切断」トグルボタンのクリックイベント
    btnConnect?.addEventListener('click', async () => {
        await handleConnectToggle();
    });

    // 読み編集クリックイベント
    btnRuby.addEventListener('click', (e) => {
        // ボタンクリックによるフォーカス移動を防止
        e.preventDefault();
    
        const text = textInput.value;
        const start = textInput.selectionStart;
        const end = textInput.selectionEnd;
    
        // 1. 全角・半角に対応したルビ構造（ { / ｛ 本体の文字列 | / ｜ 読みの文字列 } / ｝ ）を正規表現で探す
        const rubyRegex = /[｛{]([^｜|｛{}]+)[｜|]([^｝}]+)[｝}]/g;
        let match;
        let targetMatch = null;
    
        // カーソル位置が含まれるルビブロックを特定
        while ((match = rubyRegex.exec(text)) !== null) {
            const matchStart = match.index;
            const matchEnd = matchStart + match[0].length;
    
            if (start >= matchStart && start <= matchEnd) {
                targetMatch = {
                    full: match[0],
                    bodyText: match[1], // 本体テキスト
                    rubyText: match[2], // 読み
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
    
            // 元のカーソル位置（start）より「前」にある対象ルビブロックの個数をカウント
            const textBeforeCursor = text.substring(0, start);
            const matchesBefore = textBeforeCursor.split(rubyBlock).length - 1;
    
            // 前方で置換された文字数の合計分、カーソル位置を減算補正
            let newCursorPos = start - (matchesBefore * diffPerBlock);
    
            // カーソルが操作中ルビブロックの内部にあった場合、置換後の範囲内に収まるようクランプ
            const firstMatchBeforePos = targetMatch.start - ((matchesBefore - 1) * diffPerBlock);
            const minPos = firstMatchBeforePos;
            const maxPos = firstMatchBeforePos + bodyText.length;
            newCursorPos = Math.max(minPos, Math.min(newCursorPos, maxPos));
    
            // テキスト全体から同一のルビ構造（rubyBlock）をすべて本体テキストに置換
            textInput.value = text.replaceAll(rubyBlock, bodyText);
            textInput.dispatchEvent(new Event('input', { bubbles: true }));
            textInput.focus();
    
            // 補正した位置にカーソルを設定
            textInput.setSelectionRange(newCursorPos, newCursorPos);
    
            // スクロール位置を復元
            textInput.scrollTop = scrollTop;
            textInput.scrollLeft = scrollLeft;
    
            // トースト通知を表示
            showToast(`${replaceCount}件の読み解除が完了しました`, 'info');
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
    
    // 読み統一のクリックイベントリスナー
    btnUnity?.addEventListener('click', (e) => {
        const text = textInput.value;
        const cursorPos = textInput.selectionStart;
    
        // 全角・半角に対応したルビ構造（ ｛ / { 対象文字 ｜ / | 読み ｝ / } ）を正規表現で検索
        const rubyRegex = /[｛{]([^｜|｛{}]+)[｜|]([^｝}]+)[｝}]/g;
        let match;
        let targetMatch = null;
    
        // カーソル位置が含まれるルビ記述を特定
        while ((match = rubyRegex.exec(text)) !== null) {
            const start = match.index;
            const end = start + match[0].length;
    
            if (cursorPos >= start && cursorPos <= end) {
                targetMatch = {
                    full: match[0],       // ｛対象文字｜読み｝ や {対象文字|読み}
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
    
        // 対象文字を検索するための正規表現（エスケープ処理を実施）
        const escapedKanji = targetKanji.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
        // すでにルビ化されている部分を除外する正規表現（カッコの全角・半角両方に対応）
        // 記述パターン： ｛...｜対象文字...｝ や {...|対象文字...} の内部を除外
        const searchRegex = new RegExp(`(?<![｛{][^｝}]*)${escapedKanji}(?![^｛{]*[｝}])`, 'g');
    
        let replaceCount = 0;
    
        // テキスト全体の置換処理
        const newText = text.replace(searchRegex, (m, offset) => {
            // カーソル位置にあった元の対象文字はカウントから除外
            if (offset >= targetMatch.start && offset < targetMatch.end) {
                return m;
            }
            replaceCount++;
            return rubyString;
        });
    
        // 2. 他に対象文字が見つからなかった場合
        if (replaceCount === 0) {
            showToast('他に検索されていません', 'warning');
            return;
        }
    
        // テキストの更新とトースター表示
        textInput.value = newText;
        textInput.dispatchEvent(new Event('input', { bubbles: true }));
    
        // 3. 置き換え完了
        showToast(`他${replaceCount}件の読み編集が完了しました`, 'info');
    });

    // 保存ボタンクリックイベント
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
        }
    });

    // 再生 / 停止のクリックイベント
    btnSpeak?.addEventListener('click', () => {
        if (isPlaying) {
            stopPlayback();
        } else {
            playLineByLine();
        }
    });

    // 「🔊 生成」 / 「❌ 中止」 クリックイベント
    btnGenerate?.addEventListener('click', () => {
        if (isGenerating) {
            isGenerateCanceled = true;
            btnGenerate.disabled = true;
        } else {
            generateFullTextMp3();
        }
    });

    // キーボードイベントの登録
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

    // 🔲コールバック処理🔲
    // エンジン起動進捗受信 (パターンC自起動時)
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

    // Engine 初期化実行
    await initEngine();

    // 🔲初期設定関数🔲
    function setupAllDomSettings() {
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

    // 「🔄 接続 / ❌ 切断」のトグル実行関数
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
            btnConnect.textContent = '❌ 切断';
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
            btnConnect.textContent = '🔄 接続';
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
        localStorage.setItem(STORAGE_KEYS.TEXT_DIRECTION, direction);

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
        localStorage.setItem(STORAGE_KEYS.FONT_SIZE, size);

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
        localStorage.setItem('theme', theme);
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
        if (!isPlaying) return;

        const targetLineIndex = getCursorLineIndex();
        if (targetLineIndex !== currentLineIndex) {
            currentLineIndex = targetLineIndex;
            localStorage.setItem(STORAGE_KEYS.LINE_INDEX, currentLineIndex);

            isLineJumped = true;
            clearAudioCache();
            stopAllAudioPlayers();
        }
    }

    function loadFileContent(path, content) {
        const loadedText = (content || '').replace(/\r\n/g, '\n');

        if (filePathDisplay) filePathDisplay.textContent = path;
        localStorage.setItem(STORAGE_KEYS.FILE_PATH, path);

        updateFilePathMarquee();

        if (textInput) textInput.value = loadedText;
        previousText = loadedText;
        textBackup = loadedText;
        btnSave.classList.remove('change-active');
        currentLineIndex = 0;
        isFirstPlay = true;

        localStorage.setItem(STORAGE_KEYS.TEXT, loadedText);
        localStorage.setItem(STORAGE_KEYS.LINE_INDEX, 0);

        if (btnGenerate) btnGenerate.disabled = !isEngineReady || !textInput.value.trim();

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
            btnGenerate.textContent = '🔊 生成';
            btnGenerate.title = '音声生成 (Ctrl+g)';
            btnGenerate.disabled = !isEngineReady || !textInput.value.trim();
        }
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

                const savedSpeaker = localStorage.getItem(STORAGE_KEYS.SPEAKER);
                if (savedSpeaker) {
                    const exists = Array.from(speakerSelect.options).some(opt => opt.value === String(savedSpeaker));
                    if (exists) {
                        speakerSelect.value = savedSpeaker;
                    }
                }
            }

            showToast('話者モデル取得完了');
            return true;
        } catch (err) {
            showToast('Engine に接続できません', 'error');
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
        clearAudioCache(); // 停止時にもキャッシュを完全にクリア
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

        currentLineIndex = getCursorLineIndex();
        localStorage.setItem(STORAGE_KEYS.LINE_INDEX, currentLineIndex);

        previousText = fullText;
        isFirstPlay = false;

        if (currentLineIndex >= lines.length) {
            currentLineIndex = 0;
            localStorage.setItem(STORAGE_KEYS.LINE_INDEX, 0);
        }

        updateButtonStates(true);
        isStopped = false;
        isLineJumped = false;

        clearAudioCache();
        stopAllAudioPlayers();
        
        const currentSpeakerId = speakerSelect.value;

        showProgressBar('text');
        const initialPercent = Math.round((currentLineIndex / lines.length) * 100);
        if (textProgressBar) textProgressBar.value = initialPercent;
        if (textBufferProgressBar) textBufferProgressBar.value = initialPercent;

        // 初回の先読みを実行
        triggerPrefetch(lines, currentSpeakerId);

        // ダブルバッファリング用プレイヤーの配列 (既存の audioPlayer をそのまま使用)
        const players = [audioPlayer, audioPlayerNext];
        let activePlayerIndex = 0;
    
        // 初期状態の表示をリセット
        updatePlayerVisibility(activePlayerIndex);
    
        while (currentLineIndex < lines.length) {
            if (isStopped) break;
    
            const i = currentLineIndex;
            localStorage.setItem(STORAGE_KEYS.LINE_INDEX, i);
    
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
                    
                    if (audioCache.has(i)) {
                        audioData = audioCache.get(i);
                    } else {
                        audioData = await fetchAudioBuffer(lineTrimmed, currentSpeakerId);
                    }
    
                    audioCache.delete(i);
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
    
                    // 現在再生を担当するプレイヤー
                    const currentPlayer = players[activePlayerIndex];

                    // 1. まず先に画面の表示・非表示を切り替える
                    updatePlayerVisibility(activePlayerIndex);

                    const blob = new Blob([audioData], { type: 'audio/wav' });
                    const blobUrl = URL.createObjectURL(blob);

                    currentPlayer.src = blobUrl;

                    // 次の行が存在する場合、もう一方の非表示プレイヤーへプリロード
                    const nextLineIndex = i + 1;
                    const nextPlayer = players[1 - activePlayerIndex];

                    if (nextLineIndex < lines.length && audioCache.has(nextLineIndex)) {
                        const nextAudioData = audioCache.get(nextLineIndex);
                        const nextBlob = new Blob([nextAudioData], { type: 'audio/wav' });
                        nextPlayer.src = URL.createObjectURL(nextBlob);
                        nextPlayer.load(); // 事前ロード実行
                    }

                    // 2. 表示更新後に再生を開始
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
    
                    // 次の行のためにアクティブプレイヤーを切り替え (0 <-> 1)
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
        clearAudioCache();
        stopAllAudioPlayers();
    
        if (!isStopped && !isLineJumped) {
            currentLineIndex = 0;
            localStorage.setItem(STORAGE_KEYS.LINE_INDEX, 0);
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

        btnGenerate.textContent = '❌ 中止';
        btnGenerate.title = '生成中止 (Ctrl+g)';
        btnGenerate.disabled = false;
        btnSpeak.disabled = true;
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
            const generatedPath = localStorage.getItem(STORAGE_KEYS.FILE_PATH);
            if (generatedPath && generatedPath !== '選択されていません') {
                const parts = generatedPath.split(/[/\\]/);
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

    // 呼び出し例:
    // showToast('処理が完了しました', 'info');
    // showToast('接続を確認してください', 'warning');
    // showToast('エラーが発生しました', 'error');
    function showToast(message, type = 'info', disolayTime = 6000) {
        if (!toastMessage) return;

        if (toastTimer) {
            clearTimeout(toastTimer);
        }

        // タイプ別アイコンの定義
        const icons = {
            info: 'ℹ️',
            warning: '⚠️',
            error: '🚫'
        };

        // 該当するアイコン（未指定・不正な場合は info）を取得
        const icon = icons[type] || icons.info;

        // 既存のタイプ別クラスを一旦削除
        toastMessage.classList.remove('toast-info', 'toast-warning', 'toast-error');
        
        // 指定されたタイプ用のクラスを追加
        toastMessage.classList.add(`toast-${type}`);

        // アイコン付きでテキストを設定
        toastMessage.textContent = `${icon} ${message}`;
        toastMessage.classList.remove('hidden');
    if (statusDiv) statusDiv.textContent = `${icon} ${message}`;

        toastTimer = setTimeout(() => {
            toastMessage.classList.add('hidden');
        }, disolayTime);
    }

    // キャッシュおよびバッファ表示をクリアする
    function clearAudioCache() {
        audioCache.clear();
        if (textBufferProgressBar) {
            textBufferProgressBar.value = textProgressBar ? textProgressBar.value : 0;
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
        });
    
        // audioPlayerNext の音量・ミュート変更を audioPlayer に同期
        audioPlayerNext.addEventListener('volumechange', () => {
            if (audioPlayer.volume !== audioPlayerNext.volume) {
                audioPlayer.volume = audioPlayerNext.volume;
            }
            if (audioPlayer.muted !== audioPlayerNext.muted) {
                audioPlayer.muted = audioPlayerNext.muted;
            }
        });
    }
});
