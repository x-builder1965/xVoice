// -- renderer.js ------------------------------------------------------
// copyright = 'Copyright © 2026- @x-builder, Japan';
// email     = 'x-builder@gmail.com';
// appName   = 'xVoice -テキスト音声読み上げ- Ver1.09.0';
// ---------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
    const btnTheme = document.getElementById('btn-theme');
    const speakerSelect = document.getElementById('speaker');
    const btnRestart = document.getElementById('btn-restart');
    const btnFileSelect = document.getElementById('btn-file-select');
    const filePathDisplay = document.getElementById('file-path-display');
    const textInput = document.getElementById('text');
    const fontSizeSelect = document.getElementById('font-size-select');
    const btnFileClear = document.getElementById('btn-file-clear');
    const btnSpeak = document.getElementById('btn-speak');
    const btnSave = document.getElementById('btn-save');
    const audioPlayer = document.getElementById('audio-player');
    const statusDiv = document.getElementById('status');
    const engineProgressBar = document.getElementById('engine-progress');
    const textProgressBar = document.getElementById('text-progress');
    const mp3ProgressBar = document.getElementById('mp3-progress');
    const textElem = document.getElementById('text');
    const writingModeSelect = document.getElementById('writing-mode-select');

    const AIVIS_HOST = 'http://127.0.0.1:10101';

    let isPlaying = false;
    let isStopped = false;
    let isLineJumped = false;  // 再生中の行ジャンプ用フラグ
    let currentLineIndex = 0;  // 再開位置を保持する行インデックス
    let previousText = '';      // テキスト内容の変更検知用
    let isFirstPlay = true;     // 起動後/読み込み後の初回再生判定フラグ
    let isSaving = false;
    let isSaveCanceled = false;
    let isEngineReady = false; // エラー時の状態判定用

    // --- localStorage保存・復元用キー定数 ---
    const STORAGE_KEYS = {
        FILE_PATH: 'xVoice_filePath',
        TEXT: 'xVoice_text',
        LINE_INDEX: 'xVoice_lineIndex',
        VOLUME: 'xVoice_volume',
        FONT_SIZE: 'xVoice_fontSize',
        SPEAKER: 'xVoice_speaker',
        TEXT_DIRECTION: 'xVoice_textDirection'
    };

    window.addEventListener('resize', () => {
        updateFilePathMarquee();
        if (textInput) {
            // 即時反映と、リサイズ完了後の確定反映の2段階で実行
            moveCursorToLineStart(currentLineIndex);
            setTimeout(() => {
                moveCursorToLineStart(currentLineIndex);
            }, 500);
        }
    });

    // --- 指定行の先頭にカーソルを移動しスクロール表示する共通関数 ---
    function moveCursorToLineStart(lineIndex, highlight = isPlaying) {
        if (!textInput) return;
    
        const fullText = textInput.value.replace(/\r\n/g, '\n');
        const lines = fullText.split('\n');
    
        if (lines.length === 0) return;
    
        // 範囲外のインデックスを補正
        const targetIndex = Math.max(0, Math.min(lineIndex, lines.length - 1));
    
        // 指定行の先頭位置（文字オフセット）を計算
        let charOffset = 0;
        for (let i = 0; i < targetIndex; i++) {
            charOffset += lines[i].length + 1; // 改行文字 (+1)
        }
    
        const currentLineLength = lines[targetIndex].length;
    
        // 1. フォーカスと選択範囲（ハイライト）の適用
        textInput.focus({ preventScroll: true });
        if (highlight) {
            // 行全体をハイライト選択
            textInput.setSelectionRange(charOffset, charOffset + currentLineLength);
        } else {
            // 単一カーソル位置のみ設定
            textInput.setSelectionRange(charOffset, charOffset);
        }
    
        // 2. 鏡像（ミラー）要素を使って該当行の正確なピクセル位置を取得し中央へスクロール
        scrollTextareaToCharOffset(textInput, charOffset);
    }

    // --- textarea の特定文字位置を正確に画面中央へスクロールさせるヘルパー関数 ---
    function scrollTextareaToCharOffset(textarea, charIndex) {
        const style = window.getComputedStyle(textarea);
        const isVertical = style.writingMode.startsWith('vertical');

        // 1. ミラー要素を作成してスタイルを完全複製
        const mirror = document.createElement('div');
        
        const stylesToCopy = [
            'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing',
            'lineHeight', 'textTransform', 'wordBreak', 'overflowWrap', 'whiteSpace',
            'padding', 'boxSizing', 'direction'
        ];
        stylesToCopy.forEach(prop => {
            mirror.style[prop] = style[prop];
        });

        // 縦書きスタイルを明示的にセット
        if (isVertical) {
            mirror.style.writingMode = 'vertical-rl';
            mirror.style.webkitWritingMode = 'vertical-rl';
            // 縦書きの行折り返し幅を一致させるため、clientHeightをそのまま固定
            mirror.style.height = `${textarea.clientHeight}px`;
            mirror.style.width = 'auto';
        } else {
            mirror.style.writingMode = 'horizontal-tb';
            mirror.style.width = `${textarea.clientWidth}px`;
            mirror.style.height = 'auto';
        }

        // 画面外に隠す設定
        mirror.style.position = 'absolute';
        mirror.style.top = '-9999px';
        mirror.style.left = '-9999px';
        mirror.style.visibility = 'hidden';
        mirror.style.overflow = 'hidden';

        // 2. ターゲット文字に span を挿入
        const textBefore = textarea.value.substring(0, charIndex);
        const textAfter = textarea.value.substring(charIndex);

        const span = document.createElement('span');
        span.textContent = textAfter.charAt(0) || ' ';

        mirror.textContent = textBefore;
        mirror.appendChild(span);

        document.body.appendChild(mirror);

        if (isVertical) {
            // --- 縦書き (vertical-rl) の中央スクロール計算 ---
            
            // ミラー要素内での span の左端位置と幅
            const spanLeft = span.offsetLeft;
            const spanWidth = span.offsetWidth || parseFloat(style.fontSize);
            const mirrorWidth = mirror.scrollWidth;

            document.body.removeChild(mirror);

            // ミラーの「右端」から対象文字の「中心」までのピクセル距離
            const charCenterFromRight = mirrorWidth - (spanLeft + (spanWidth / 2));

            // textarea の表示幅
            const clientWidth = textarea.clientWidth;
            const scrollWidth = textarea.scrollWidth;

            // 右端(0) から左へ向かうスクロール目標量 (px)
            // 画面中央に来るための「右端からの距離」
            const targetOffsetFromRight = charCenterFromRight - (clientWidth / 2);

            // Chromiumの vertical-rl は 右端=0、左へいくほどマイナス値 (-100, -200...)
            // targetOffsetFromRight がプラスであればマイナス化、マイナス（画面幅より右）なら 0 に止める
            let targetScrollLeft = -targetOffsetFromRight;

            // 【範囲ガード】
            // 1. 右外に飛ばないよう 0 以下に制限（0 = 右端ピッタリ）
            if (targetScrollLeft > 0) {
                targetScrollLeft = 0;
            }

            // 2. 左端の限界を超えないようクランプ
            const maxNegativeScroll = -(scrollWidth - clientWidth);
            if (targetScrollLeft < maxNegativeScroll) {
                targetScrollLeft = maxNegativeScroll;
            }

            // スクロール適用
            textarea.scrollLeft = targetScrollLeft;

        } else {
            // --- 横書き (horizontal-tb) の計算 ---
            const spanTop = span.offsetTop;
            const spanHeight = span.offsetHeight || parseFloat(style.fontSize);

            document.body.removeChild(mirror);

            const clientHeight = textarea.clientHeight;
            const targetTop = spanTop - (clientHeight / 2) + (spanHeight / 2);

            textarea.scrollTop = Math.max(0, targetTop);
        }
    }

    // --- 設定の復元ロジック ---
    if (audioPlayer) {
        const savedVolume = localStorage.getItem(STORAGE_KEYS.VOLUME);
        audioPlayer.volume = savedVolume !== null ? parseFloat(savedVolume) : 0.2;

        audioPlayer.addEventListener('volumechange', () => {
            localStorage.setItem(STORAGE_KEYS.VOLUME, audioPlayer.volume);
        });
    }
    
    const savedFontSize = localStorage.getItem(STORAGE_KEYS.FONT_SIZE) || '16px';
    applyFontSize(savedFontSize);

    const savedFilePath = localStorage.getItem(STORAGE_KEYS.FILE_PATH);
    if (savedFilePath) {
        filePathDisplay.textContent = savedFilePath;
        updateFilePathMarquee();
    }

    const savedText = localStorage.getItem(STORAGE_KEYS.TEXT);
    if (savedText !== null) {
        const normalizedSavedText = savedText.replace(/\r\n/g, '\n');
        textInput.value = normalizedSavedText;
        previousText = normalizedSavedText;
    }

    const savedLineIndex = localStorage.getItem(STORAGE_KEYS.LINE_INDEX);
    if (savedLineIndex !== null) {
        currentLineIndex = parseInt(savedLineIndex, 10) || 0;
    }

    // --- 話者モデルの選択変更リスナー ---
    speakerSelect?.addEventListener('change', (e) => {
        localStorage.setItem(STORAGE_KEYS.SPEAKER, e.target.value);
    });

    // --- テキストの表示向き設定・適用処理 ---
    function applyTextDirection(direction) {
        if (!textInput) return;

        textInput.style.writingMode = direction;
        if (writingModeSelect) writingModeSelect.value = direction;
        localStorage.setItem(STORAGE_KEYS.TEXT_DIRECTION, direction);
    }

    const savedTextDirection = localStorage.getItem(STORAGE_KEYS.TEXT_DIRECTION) || 'horizontal-tb';
    applyTextDirection(savedTextDirection);

    writingModeSelect?.addEventListener('change', (e) => {
        applyTextDirection(e.target.value);
    });

    // --- フォントサイズの適用・変更処理 ---
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

        // ★フォントサイズ変更に伴いファイルパスの横幅が変わるため、スクロール表示を再計算
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

    // フォントサイズ変更イベント処理
    if (fontSizeSelect) {
        fontSizeSelect.addEventListener('change', (e) => {
            applyFontSize(e.target.value);
        });
    }

    // 縦書き・横書き切替イベント処理
    if (writingModeSelect && textElem) {
        writingModeSelect.addEventListener('change', (e) => {
            if (e.target.value === 'vertical-rl') {
                textElem.classList.add('is-vertical');
            } else {
                textElem.classList.remove('is-vertical');
            }
        });
    }

    // --- 進捗バー表示切り替えヘルパー ---
    function showProgressBar(type) {
        if (engineProgressBar) engineProgressBar.hidden = (type !== 'engine');
        if (textProgressBar) textProgressBar.hidden = (type !== 'text');
        if (mp3ProgressBar) mp3ProgressBar.hidden = (type !== 'mp3');
    }

    // --- テーマ設定 ---
    function setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        if (btnTheme) btnTheme.textContent = theme === 'dark' ? '☀️' : '🌙';
    }
    setTheme(localStorage.getItem('theme') || 'dark');

    btnTheme?.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        setTheme(currentTheme === 'dark' ? 'light' : 'dark');
    });

    // --- 現在のカーソル位置から行インデックスを取得する関数 ---
    function getCursorLineIndex() {
        if (!textInput) return 0;
        const fullText = textInput.value.replace(/\r\n/g, '\n');
        const cursorPos = textInput.selectionStart;
        const textUpToCursor = fullText.substring(0, cursorPos);
        return (textUpToCursor.match(/\n/g) || []).length;
    }

    // --- 再生中のカーソル移動（クリック／キー操作）の監視 ---
    function handleCursorChange() {
        if (!isPlaying) return;

        const targetLineIndex = getCursorLineIndex();
        if (targetLineIndex !== currentLineIndex) {
            currentLineIndex = targetLineIndex;
            localStorage.setItem(STORAGE_KEYS.LINE_INDEX, currentLineIndex);
            
            isLineJumped = true;
            if (audioPlayer) {
                audioPlayer.pause();
                audioPlayer.currentTime = 0;
            }
        }
    }

    textInput?.addEventListener('click', handleCursorChange);
    textInput?.addEventListener('keyup', (e) => {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'].includes(e.key)) {
            handleCursorChange();
        }
    });

    // --- ファイル読み込み後の共通処理関数 ---
    function loadFileContent(path, content) {
        const loadedText = (content || '').replace(/\r\n/g, '\n');

        if (filePathDisplay) filePathDisplay.textContent = path;
        localStorage.setItem(STORAGE_KEYS.FILE_PATH, path);
    
        updateFilePathMarquee();

        if (textInput) textInput.value = loadedText;
        previousText = loadedText;
        currentLineIndex = 0;
        isFirstPlay = true;

        localStorage.setItem(STORAGE_KEYS.TEXT, loadedText);
        localStorage.setItem(STORAGE_KEYS.LINE_INDEX, 0);

        if (btnSave) btnSave.disabled = !textInput.value.trim();

        moveCursorToLineStart(0);
    }

    // --- ファイル選択ボタン処理 ---
    btnFileSelect?.addEventListener('click', async () => {
        const fileData = await window.api.selectFile();
        if (!fileData) return; // キャンセル時

        loadFileContent(fileData.path, fileData.content);
    });

    // --- ドラッグ＆ドロップ（D&D）処理 ---
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
                statusDiv.textContent = 'ファイルの読み込みに失敗しました';
            }
        }
    });

    // クリアボタンのクリックイベント
    btnFileClear?.addEventListener('click', () => {
        filePathDisplay.textContent = '選択されていません';
        updateFilePathMarquee();
        if (textInput) textInput.value = '';
        if (btnSave) btnSave.disabled = true;

        currentLineIndex = 0;
        previousText = '';
        isFirstPlay = true;

        localStorage.removeItem(STORAGE_KEYS.FILE_PATH);
        localStorage.removeItem(STORAGE_KEYS.TEXT);
        localStorage.setItem(STORAGE_KEYS.LINE_INDEX, 0);
    });

    // --- ボタンおよび入力要素の状態管理 ---
    function updateButtonStates(playing) {
        isPlaying = playing;
        
        if (btnSpeak) {
            btnSpeak.textContent = playing ? '⏹️停止' : '▶️再生';
            textInput.style.cursor = playing ? 'pointer' : 'text';
        }

        // 保存実行中でなければ再生状態に応じて非活性を制御
        if (btnSave && !isSaving) {
            btnSave.disabled = playing || !isEngineReady || !textInput.value.trim();
        }
        if (btnFileClear) btnFileClear.disabled = playing || isSaving;
    
        if (btnFileSelect) btnFileSelect.disabled = playing || isSaving;
        if (fontSizeSelect) fontSizeSelect.disabled = playing || isSaving;
        if (writingModeSelect) writingModeSelect.disabled = playing || isSaving;
        if (textInput) textInput.readOnly = playing || isSaving;
    }

    // ★追加: 保存ボタンの表示・状態を初期化するヘルパー関数
    function resetSaveButton() {
        isSaving = false;
        isSaveCanceled = false;
        if (btnSave) {
            btnSave.textContent = '💾 保存';
            btnSave.disabled = !isEngineReady || !textInput.value.trim();
        }
        btnSpeak.disabled = false;
        if (btnFileSelect) btnFileSelect.disabled = false;
        if (btnFileClear) btnFileClear.disabled = false;
        if (fontSizeSelect) fontSizeSelect.disabled = false;
        if (writingModeSelect) writingModeSelect.disabled = false;
        if (textInput) textInput.readOnly = false;
    }

    // テキスト編集時
    textInput?.addEventListener('input', () => {
        const currentText = textInput.value.replace(/\r\n/g, '\n');
        if (btnSave && !isSaving) {
            btnSave.disabled = !isEngineReady || !currentText.trim();
        }
        
        if (currentText !== previousText) {
            currentLineIndex = 0;
            previousText = currentText;
            isFirstPlay = true;
            localStorage.setItem(STORAGE_KEYS.LINE_INDEX, 0);
        }

        localStorage.setItem(STORAGE_KEYS.TEXT, currentText);
    });

    // --- 話者一覧取得 ---
    async function loadSpeakers() {
        try {
            const res = await fetch(`${AIVIS_HOST}/speakers`);
            if (!res.ok) throw new Error();
            const speakers = await res.json();

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

            statusDiv.textContent = '準備完了';
            return true;
        } catch (err) {
            statusDiv.textContent = 'エラー: AivisSpeech Engineが起動していません';
            return false;
        }
    }

    // --- Engine 初期化 & 再起動制御 ---
    async function initApp() {
        statusDiv.textContent = 'AivisSpeech Engine 起動中...';
        isEngineReady = false;
        btnSpeak.disabled = true;
        btnSave.disabled = true; // ★起動完了まで非活性化
        if (btnRestart) btnRestart.disabled = true;

        const ready = await window.api.initEngine();
        if (ready) {
            await loadSpeakers();
            isEngineReady = true;
            btnSpeak.disabled = false;
            btnSave.disabled = !textInput.value.trim(); // ★起動完了後にテキスト判定で有効化
        } else {
            statusDiv.textContent = 'Engineの起動に失敗しました';
        }
        if (btnRestart) btnRestart.disabled = false;

        moveCursorToLineStart(currentLineIndex, true);
    }

    btnRestart?.addEventListener('click', async () => {
        statusDiv.textContent = 'AivisSpeech Engine 再起動中...';
        isEngineReady = false;
        btnSpeak.disabled = true;
        btnSave.disabled = true; // ★再起動中も非活性化
        btnRestart.disabled = true;

        const ready = await window.api.restartEngine();
        if (ready) {
            await loadSpeakers();
            isEngineReady = true;
            btnSpeak.disabled = false;
            btnSave.disabled = !textInput.value.trim();
        } else {
            statusDiv.textContent = 'Engineの再起動に失敗しました';
        }
        btnRestart.disabled = false;
    });

    // --- エンジン起動進捗受信 ---
    window.api.onEngineProgress(({ current, total, isRunning }) => {
        if (engineProgressBar) {
            showProgressBar('engine');

            const percent = Math.round((current / total) * 100);
            engineProgressBar.value = percent;

            if (isRunning) {
                isEngineReady = true;
                statusDiv.textContent = 'AivisSpeech Engine の起動が完了しました';
                // ★エンジン起動完了に伴いボタンが「💾 保存」であることを確認して活性化
                if (btnSave && !isSaving) {
                    btnSave.disabled = !textInput.value.trim();
                }
                setTimeout(() => { engineProgressBar.hidden = true; }, 1000);
            } else {
                isEngineReady = false;
                if (btnSave) btnSave.disabled = true; // 起動中は非活性
                statusDiv.textContent = `AivisSpeech Engine 起動確認中... (${current}/${total} - ${percent}%)`;
            }
        }
    });

    // --- 音声生成ロジック ---
    async function fetchAudioBuffer(text, speakerId) {
        const queryRes = await fetch(`${AIVIS_HOST}/audio_query?text=${encodeURIComponent(text)}&speaker=${speakerId}`, {
            method: 'POST'
        });
        const audioQuery = await queryRes.json();

        const synthRes = await fetch(`${AIVIS_HOST}/synthesis?speaker=${speakerId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(audioQuery)
        });

        return await synthRes.arrayBuffer();
    }

    // 停止処理関数
    function stopPlayback() {
        if (!isPlaying) return;

        isStopped = true;
        if (audioPlayer) {
            audioPlayer.pause();
            audioPlayer.currentTime = 0;
        }

        statusDiv.textContent = `停止しました (${currentLineIndex + 1} 行目で停止中)`;
        updateButtonStates(false);

        // ★第2引数に true を明示的に指定して、停止後もハイライトを維持
        moveCursorToLineStart(currentLineIndex, true);
    }

    // --- 1. 「1行毎に合成・再生（ハイライト＋自動スクロール付き）」処理 ---
    async function playLineByLine() {
        const fullText = textInput.value.replace(/\r\n/g, '\n');
        const lines = fullText.split('\n');
    
        if (!fullText.trim()) return alert('テキストを入力してください');
    
        const normalizedPreviousText = previousText.replace(/\r\n/g, '\n');
    
        if (normalizedPreviousText !== '' && fullText !== normalizedPreviousText) {
            currentLineIndex = 0;
            isFirstPlay = true;
            localStorage.setItem(STORAGE_KEYS.LINE_INDEX, 0);
        } else if (!isFirstPlay) {
            currentLineIndex = getCursorLineIndex();
            localStorage.setItem(STORAGE_KEYS.LINE_INDEX, currentLineIndex);
        }
    
        previousText = fullText;
        isFirstPlay = false;
    
        if (currentLineIndex >= lines.length) {
            currentLineIndex = 0;
            localStorage.setItem(STORAGE_KEYS.LINE_INDEX, 0);
        }
    
        updateButtonStates(true);
        isStopped = false;
        isLineJumped = false;
    
        showProgressBar('text');
        if (textProgressBar) {
            textProgressBar.value = Math.round((currentLineIndex / lines.length) * 100);
        }
    
        const computedStyle = window.getComputedStyle(textInput);
        const parsedLineHeight = parseFloat(computedStyle.lineHeight);
        const lineHeight = isNaN(parsedLineHeight) ? 20 : parsedLineHeight;
    
        while (currentLineIndex < lines.length) {
            if (isStopped) break;
    
            const i = currentLineIndex;
            localStorage.setItem(STORAGE_KEYS.LINE_INDEX, i);
    
            const currentSpeakerId = speakerSelect.value;
    
            const progressPercent = Math.round(((i + 1) / lines.length) * 100);
            if (textProgressBar) {
                textProgressBar.value = progressPercent;
            }
    
            const lineText = lines[i];
            const lineTrimmed = lineText.trim();
            const lineLength = lineText.length;
    
            let charOffset = 0;
            for (let k = 0; k < i; k++) {
                charOffset += lines[k].length + 1;
            }
    
            if (lineTrimmed.length > 0) {
                statusDiv.textContent = `再生中 (${i + 1}/${lines.length} 行目 - ${progressPercent}%)`;
    
                // 共通関数を呼び出し（フォーカス、ハイライト範囲指定、中央スクロールを一括実行）
                moveCursorToLineStart(i);

                try {
                    const audioData = await fetchAudioBuffer(lineTrimmed, currentSpeakerId);
                    if (isStopped || isLineJumped) {
                        if (isLineJumped) {
                            isLineJumped = false;
                            continue;
                        }
                        break;
                    }
    
                    const blob = new Blob([audioData], { type: 'audio/wav' });
                    audioPlayer.src = URL.createObjectURL(blob);
    
                    await new Promise((resolve) => {
                        const checkStopped = setInterval(() => {
                            if (isStopped || isLineJumped) {
                                clearInterval(checkStopped);
                                resolve();
                            }
                        }, 100);
    
                        audioPlayer.onended = () => {
                            clearInterval(checkStopped);
                            resolve();
                        };
                        audioPlayer.onerror = () => {
                            clearInterval(checkStopped);
                            resolve();
                        };
    
                        audioPlayer.play().catch(() => resolve());
                    });
    
                    if (isLineJumped) {
                        isLineJumped = false;
                        continue;
                    }
    
                } catch (err) {
                    console.error(`行 ${i + 1} の処理でエラー:`, err);
                }
            }
    
            currentLineIndex++;
        }
    
        if (!isStopped && !isLineJumped) {
            currentLineIndex = 0;
            localStorage.setItem(STORAGE_KEYS.LINE_INDEX, 0);
            statusDiv.textContent = '再生完了';
            if (textProgressBar) textProgressBar.value = 100;
            
            // ★再生完了時にも先頭行（0行目）をハイライト表示
            moveCursorToLineStart(0, true);
        }
    
        updateButtonStates(false);
    }

    // --- 2. 「全文MP3保存（進捗バー更新付き）」処理 ---
    async function saveFullTextMp3() {
        const lines = textInput.value.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        const speakerId = speakerSelect.value;

        if (lines.length === 0) return alert('テキストを入力してください');

        // ★保存中状態へ移行
        isSaving = true;
        isSaveCanceled = false;

        // ★ボタンを「❌ 中止」に変更
        btnSave.textContent = '❌ 中止';
        btnSave.disabled = false;
        btnSpeak.disabled = true;
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
                // ★ループごとにキャンセルフラグを確認
                if (isSaveCanceled) {
                    statusDiv.textContent = '保存処理を中止しました';
                    return;
                }

                const progressPercent = Math.round(((i + 1) / lines.length) * 100);
                
                statusDiv.textContent = `音声生成中 (${i + 1}/${lines.length} 行目 - ${progressPercent}%)`;
                if (mp3ProgressBar) mp3ProgressBar.value = progressPercent;

                const buffer = await fetchAudioBuffer(lines[i], speakerId);

                // API通信待機後のキャンセル確認
                if (isSaveCanceled) {
                    statusDiv.textContent = '保存処理を中止しました';
                    return;
                }

                audioBuffers.push(buffer);
            }

            statusDiv.textContent = 'MP3へ変換・保存中...';

            let defaultFilename = 'xVoice生成.mp3';
            const savedPath = localStorage.getItem(STORAGE_KEYS.FILE_PATH);
            if (savedPath && savedPath !== '選択されていません') {
                const parts = savedPath.split(/[/\\]/);
                const originalName = parts[parts.length - 1];
                const baseName = originalName.substring(0, originalName.lastIndexOf('.')) || originalName;
                defaultFilename = `${baseName}.mp3`;
            }

            // MP3変換・書き込み前に最終キャンセル判定
            if (isSaveCanceled) {
                statusDiv.textContent = '保存処理を中止しました';
                return;
            }

            const success = await window.api.saveAudio(audioBuffers, defaultFilename);
            statusDiv.textContent = success ? '全文MP3保存が完了しました' : '保存がキャンセルまたは失敗しました';

        } catch (err) {
            statusDiv.textContent = '保存エラーが発生しました';
            console.error(err);
        } finally {
            // ★保存完了または中止時、常にボタン表示・状態を初期状態に戻す
            resetSaveButton();

            setTimeout(() => {
                if (mp3ProgressBar) mp3ProgressBar.hidden = true;
            }, 1500);
        }
    }

    // 再生 / 停止 トグルイベントリスナー
    btnSpeak?.addEventListener('click', () => {
        if (isPlaying) {
            stopPlayback();
        } else {
            playLineByLine();
        }
    });

    // ★「💾 保存」 / 「❌ 中止」 クリック時の分岐処理
    btnSave?.addEventListener('click', () => {
        if (isSaving) {
            // 保存中にクリックされた場合はキャンセルフラグを立てる
            isSaveCanceled = true;
            btnSave.disabled = true; // 二重クリック防止
        } else {
            // 通常時は保存処理を実行
            saveFullTextMp3();
        }
    });

    // アプリ初期化実行
    initApp();

    // --- file-path-display のはみ出しチェックとスクロール適用関数 ---
    function updateFilePathMarquee() {
        if (!filePathDisplay) return;

        // 現在表示されているテキストを取得
        const firstItem = filePathDisplay.querySelector('.marquee-item');
        const currentText = firstItem ? firstItem.textContent.trim() : filePathDisplay.textContent.trim();

        if (!currentText || currentText === '選択されていません') {
            filePathDisplay.innerHTML = `<span class="file-path-text">${currentText}</span>`;
            return;
        }

        // アニメーション用に同じテキストを2つ並べた構造を生成
        filePathDisplay.innerHTML = `
            <span class="file-path-text">
                <span class="marquee-item">${currentText}</span>
                <span class="marquee-item">${currentText}</span>
            </span>
        `;

        const textSpan = filePathDisplay.querySelector('.file-path-text');
        const itemElem = filePathDisplay.querySelector('.marquee-item');
        if (!textSpan || !itemElem) return;

        // レイアウト確定後に幅を取得してアニメーションを適用
        requestAnimationFrame(() => {
            const containerWidth = filePathDisplay.clientWidth;
            // 余白（padding-right）を含めた1要素分の全幅
            const singleItemWidth = itemElem.getBoundingClientRect().width;

            // 1要素分の幅がコンテナ領域を超えている場合のみスクロールを有効化
            if (singleItemWidth > containerWidth) {
                const speed = 100; // スクロール速度 (px/秒)
                const duration = singleItemWidth / speed;

                textSpan.style.setProperty('--marquee-duration', `${duration}s`);
                textSpan.classList.add('scrolling');
            } else {
                // 収まる場合は通常のテキスト表示に戻す
                filePathDisplay.innerHTML = `<span class="file-path-text">${currentText}</span>`;
            }
        });
    }
});
