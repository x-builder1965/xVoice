// -- renderer.js ------------------------------------------------------
// copyright = 'Copyright © 2026- @x-builder, Japan';
// email     = 'x-builder@gmail.com';
// appName   = 'xVoice -テキスト音声読み上げ- Ver1.02.0';
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
    const btnStop = document.getElementById('btn-stop');
    const btnSave = document.getElementById('btn-save');
    const audioPlayer = document.getElementById('audio-player');
    const statusDiv = document.getElementById('status');
    const engineProgressBar = document.getElementById('engine-progress');
    const textProgressBar = document.getElementById('text-progress');
    const mp3ProgressBar = document.getElementById('mp3-progress');

    const AIVIS_HOST = 'http://127.0.0.1:10101';

    let isPlaying = false;
    let isStopped = false;
    let isLineJumped = false;  // 再生中の行ジャンプ用フラグ
    let currentLineIndex = 0;  // 再開位置を保持する行インデックス
    let previousText = '';      // テキスト内容の変更検知用
    let isFirstPlay = true;     // 起動後/読み込み後の初回再生判定フラグ

    // --- localStorage保存・復元用キー定数 ---
    const STORAGE_KEYS = {
        FILE_PATH: 'xVoice_filePath',
        TEXT: 'xVoice_text',
        LINE_INDEX: 'xVoice_lineIndex',
        VOLUME: 'xVoice_volume',
        FONT_SIZE: 'xVoice_fontSize',
        SPEAKER: 'xVoice_speaker'
    };

    // --- 指定行の先頭にカーソルを移動しスクロール表示する共通関数 ---
    function moveCursorToLineStart(lineIndex) {
        if (!textInput) return;

        const fullText = textInput.value.replace(/\r\n/g, '\n');
        const lines = fullText.split('\n');

        if (lines.length === 0) return;

        // 範囲外のインデックスを補正
        const targetIndex = Math.max(0, Math.min(lineIndex, lines.length - 1));

        // 指定行の先頭位置（文字オフセット）を計算
        let charOffset = 0;
        for (let i = 0; i < targetIndex; i++) {
            charOffset += lines[i].length + 1; // 改行文字 (+1) を考慮
        }

        // カーソル移動とフォーカス
        textInput.focus();
        textInput.setSelectionRange(charOffset, charOffset);

        // スクロール位置の計算と移動
        const computedStyle = window.getComputedStyle(textInput);
        const parsedLineHeight = parseFloat(computedStyle.lineHeight);
        const lineHeight = isNaN(parsedLineHeight) ? 20 : parsedLineHeight;

        const targetScrollTop = (targetIndex * lineHeight) - (textInput.clientHeight / 2) + lineHeight;
        textInput.scrollTop = Math.max(0, targetScrollTop);
    }

    // --- 設定の復元ロジック ---
    if (audioPlayer) {
        const savedVolume = localStorage.getItem(STORAGE_KEYS.VOLUME);
        audioPlayer.volume = savedVolume !== null ? parseFloat(savedVolume) : 0.2;

        audioPlayer.addEventListener('volumechange', () => {
            localStorage.setItem(STORAGE_KEYS.VOLUME, audioPlayer.volume);
        });
    }

    const savedFilePath = localStorage.getItem(STORAGE_KEYS.FILE_PATH);
    if (savedFilePath) {
        filePathDisplay.textContent = savedFilePath;
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

    const savedFontSize = localStorage.getItem(STORAGE_KEYS.FONT_SIZE) || '16px';
    applyFontSize(savedFontSize);

    fontSizeSelect?.addEventListener('change', (e) => {
        applyFontSize(e.target.value);
    });

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
        // ドラッグがウィンドウ外に出た場合のみ表示を解除
        if (e.clientX === 0 && e.clientY === 0) {
            document.body.classList.remove('drag-over');
        }
    });

    document.addEventListener('drop', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        document.body.classList.remove('drag-over');

        if (isPlaying) return; // 再生中は処理しない

        const files = e.dataTransfer?.files;
        if (!files || files.length === 0) return;

        const droppedFile = files[0];
        // パス取得（Electron環境の対応）
        const filePath = droppedFile.path || (window.api.getFilePath ? window.api.getFilePath(droppedFile) : '');

        if (filePath) {
            try {
                // メインプロセス側でファイル内容を読み込むIPC経由の呼び出し
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
        btnSpeak.disabled = playing;
        btnStop.disabled = !playing;
        if (btnSave) btnSave.disabled = playing;
        if (btnFileClear) btnFileClear.disabled = playing;
    
        if (btnFileSelect) btnFileSelect.disabled = playing;
        if (fontSizeSelect) fontSizeSelect.disabled = playing;
        if (textInput) textInput.readOnly = playing;
    }

    // テキスト編集時
    textInput?.addEventListener('input', () => {
        const currentText = textInput.value.replace(/\r\n/g, '\n');
        if (btnSave) btnSave.disabled = !currentText.trim();
        
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
        btnSpeak.disabled = true;
        btnSave.disabled = true;
        if (btnRestart) btnRestart.disabled = true;

        const ready = await window.api.initEngine();
        if (ready) {
            await loadSpeakers();
            btnSpeak.disabled = false;
            btnSave.disabled = !textInput.value.trim();
        } else {
            statusDiv.textContent = 'Engineの起動に失敗しました';
        }
        if (btnRestart) btnRestart.disabled = false;

        moveCursorToLineStart(currentLineIndex);
    }

    btnRestart?.addEventListener('click', async () => {
        statusDiv.textContent = 'AivisSpeech Engine 再起動中...';
        btnSpeak.disabled = true;
        btnSave.disabled = true;
        btnRestart.disabled = true;

        const ready = await window.api.restartEngine();
        if (ready) {
            await loadSpeakers();
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
                statusDiv.textContent = 'AivisSpeech Engine の起動が完了しました';
                setTimeout(() => { engineProgressBar.hidden = true; }, 1000);
            } else {
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

    // 停止ボタン処理
    btnStop?.addEventListener('click', () => {
        if (!isPlaying) return;

        isStopped = true;
        if (audioPlayer) {
            audioPlayer.pause();
            audioPlayer.currentTime = 0;
        }

        statusDiv.textContent = `停止しました (${currentLineIndex + 1} 行目で停止中)`;
        updateButtonStates(false);

        moveCursorToLineStart(currentLineIndex);
    });

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
    
                textInput.focus();
                textInput.setSelectionRange(charOffset, charOffset + lineLength);
    
                const targetScrollTop = (i * lineHeight) - (textInput.clientHeight / 2) + lineHeight;
                textInput.scrollTop = Math.max(0, targetScrollTop);
    
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
            textInput.setSelectionRange(fullText.length, fullText.length);
            statusDiv.textContent = '再生完了';
            if (textProgressBar) textProgressBar.value = 100;
        }
    
        updateButtonStates(false);
    }

    // --- 2. 「全文MP3保存（進捗バー更新付き）」処理 ---
    async function saveFullTextMp3() {
        const lines = textInput.value.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        const speakerId = speakerSelect.value;

        if (lines.length === 0) return alert('テキストを入力してください');

        btnSave.disabled = true;
        btnSpeak.disabled = true;

        showProgressBar('mp3');
        if (mp3ProgressBar) mp3ProgressBar.value = 0;

        try {
            const audioBuffers = [];

            for (let i = 0; i < lines.length; i++) {
                const progressPercent = Math.round(((i + 1) / lines.length) * 100);
                
                statusDiv.textContent = `音声生成中 (${i + 1}/${lines.length} 行目 - ${progressPercent}%)`;
                if (mp3ProgressBar) mp3ProgressBar.value = progressPercent;

                const buffer = await fetchAudioBuffer(lines[i], speakerId);
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

            const success = await window.api.saveAudio(audioBuffers, defaultFilename);
            statusDiv.textContent = success ? '全文MP3保存が完了しました' : '保存がキャンセルまたは失敗しました';

        } catch (err) {
            statusDiv.textContent = '保存エラーが発生しました';
            console.error(err);
        } finally {
            btnSave.disabled = false;
            btnSpeak.disabled = false;

            setTimeout(() => {
                if (mp3ProgressBar) mp3ProgressBar.hidden = true;
            }, 1500);
        }
    }

    // イベントリスナーの追加
    btnSpeak?.addEventListener('click', () => {
        if (!isPlaying) playLineByLine();
    });
    btnSave?.addEventListener('click', saveFullTextMp3);

    // アプリ初期化実行
    initApp();
});
