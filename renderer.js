// -- renderer.js ------------------------------------------------------
// copyright = 'Copyright © 2026- @x-builder, Japan';
// email     = 'x-builder@gmail.com';
// appName   = 'xVoice -テキスト音声読み上げ- Ver1.00.0';
// ---------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
    const btnTheme = document.getElementById('btn-theme');
    const speakerSelect = document.getElementById('speaker');
    const btnRestart = document.getElementById('btn-restart');
    const fileInput = document.getElementById('file-input');
    const filePathDisplay = document.getElementById('file-path-display');
    const textInput = document.getElementById('text');
    const btnFileClear = document.getElementById('btn-file-clear');
    const btnSpeak = document.getElementById('btn-speak');
    const btnStop = document.getElementById('btn-stop');
    const btnSave = document.getElementById('btn-save');
    const audioPlayer = document.getElementById('audio-player');
    const statusDiv = document.getElementById('status');
    
    // プログレスバー要素の取得
    const engineProgressBar = document.getElementById('engine-progress');
    const textProgressBar = document.getElementById('text-progress');
    const mp3ProgressBar = document.getElementById('mp3-progress');

    const AIVIS_HOST = 'http://127.0.0.1:10101';

    let isPlaying = false;
    let isStopped = false;
    let currentLineIndex = 0; // 再開位置を保持する行インデックス
    let previousText = '';     // テキスト内容の変更検知用

    if (audioPlayer) audioPlayer.volume = 0.2;

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

    // --- ファイル選択 ---
    fileInput?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) {
            filePathDisplay.textContent = '選択されていません';
            return;
        }
        filePathDisplay.textContent = file.path || file.name;

        const reader = new FileReader();
        reader.onload = (evt) => {
            textInput.value = evt.target.result;
            if (btnSave) btnSave.disabled = !textInput.value.trim();
        };
        reader.readAsText(file);
    });

    // クリアボタンのクリックイベント
    btnFileClear?.addEventListener('click', () => {
        if (fileInput) fileInput.value = '';
        if (filePathDisplay) filePathDisplay.textContent = '選択されていません';
        if (textInput) textInput.value = '';
        if (btnSave) btnSave.disabled = true;
    });

    // --- ボタンの状態管理 ---
    function updateButtonStates(playing) {
        isPlaying = playing;
        btnSpeak.disabled = playing;
        btnStop.disabled = !playing;
        if (btnSave) btnSave.disabled = playing;
    }

    // テキスト編集時は再生位置を先頭（0行目）にリセット
    textInput?.addEventListener('input', () => {
        if (btnSave) btnSave.disabled = !textInput.value.trim();
        if (textInput.value !== previousText) {
            currentLineIndex = 0;
        }
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
        audioPlayer.pause();
        audioPlayer.currentTime = 0;

        statusDiv.textContent = `停止しました (${currentLineIndex + 1} 行目で停止中)`;
        updateButtonStates(false);
    });

    // --- 1. 「1行毎に合成・再生（ハイライト＋自動スクロール付き）」処理 ---
    async function playLineByLine() {
        const fullText = textInput.value;
        const lines = fullText.split('\n');
        const speakerId = speakerSelect.value;

        if (!fullText.trim()) return alert('テキストを入力してください');

        if (fullText !== previousText) {
            currentLineIndex = 0;
            previousText = fullText;
        }

        if (currentLineIndex >= lines.length) {
            currentLineIndex = 0;
        }

        updateButtonStates(true);
        isStopped = false;

        // 再生進捗バーの表示
        showProgressBar('text');
        if (textProgressBar) {
            textProgressBar.value = Math.round((currentLineIndex / lines.length) * 100);
        }

        const computedStyle = window.getComputedStyle(textInput);
        const parsedLineHeight = parseFloat(computedStyle.lineHeight);
        const lineHeight = isNaN(parsedLineHeight) ? 20 : parsedLineHeight;

        for (let i = currentLineIndex; i < lines.length; i++) {
            if (isStopped) break;

            currentLineIndex = i;

            // 進捗バーの割合(%)を更新（再生中行の進捗率）
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
                    const audioData = await fetchAudioBuffer(lineTrimmed, speakerId);
                    if (isStopped) break;

                    const blob = new Blob([audioData], { type: 'audio/wav' });
                    audioPlayer.src = URL.createObjectURL(blob);

                    await new Promise((resolve) => {
                        const checkStopped = setInterval(() => {
                            if (isStopped) {
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

                } catch (err) {
                    console.error(`行 ${i + 1} の処理でエラー:`, err);
                }
            }
        }

        if (!isStopped) {
            currentLineIndex = 0;
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

        // MP3保存用進捗バー（黄色）の初期表示
        showProgressBar('mp3');
        if (mp3ProgressBar) mp3ProgressBar.value = 0;

        try {
            const audioBuffers = [];

            for (let i = 0; i < lines.length; i++) {
                const progressPercent = Math.round(((i + 1) / lines.length) * 100);
                
                // ステータスと黄色の進捗バーを更新
                statusDiv.textContent = `音声生成中 (${i + 1}/${lines.length} 行目 - ${progressPercent}%)`;
                if (mp3ProgressBar) mp3ProgressBar.value = progressPercent;

                const buffer = await fetchAudioBuffer(lines[i], speakerId);
                audioBuffers.push(buffer);
            }

            statusDiv.textContent = 'MP3へ変換・保存中...';

            // --- デフォルトファイル名の判定 ---
            let defaultFilename = 'xVoice生成.mp3';
            const selectedFile = fileInput?.files?.[0];

            if (selectedFile) {
                // ファイル名から拡張子を取り除き、.mp3 を付与
                const originalName = selectedFile.name;
                const baseName = originalName.substring(0, originalName.lastIndexOf('.')) || originalName;
                defaultFilename = `${baseName}.mp3`;
            }

            // メインプロセスへ音声データとデフォルトファイル名を渡す
            const success = await window.api.saveAudio(audioBuffers, defaultFilename);
            statusDiv.textContent = success ? '全文MP3保存が完了しました' : '保存がキャンセルまたは失敗しました';

        } catch (err) {
            statusDiv.textContent = '保存エラーが発生しました';
            console.error(err);
        } finally {
            btnSave.disabled = false;
            btnSpeak.disabled = false;

            // 完了またはエラー後に進捗バーをクリア（少し遅延させて完了を見せる）
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
