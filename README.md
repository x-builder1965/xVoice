# xVoice

`xVoice` は、[AivisSpeech Engine](https://github.com/Aivis-Project/AivisSpeech) を利用してテキストの読み上げ、音声生成、MP3 出力を行う Windows 向け Electron アプリです。  
現在のコードベースでは、単一のテキスト編集中でもファイル単位・複数ファイル単位の再生、話者モデル管理、プレイリスト管理、音量と速度制御、テーマ切り替えまで一通り扱える構成になっています。

---

## 概要

- AivisSpeech Engine への接続・再接続
- 話者（speaker）選択と AIVM/AIVMX モデルの追加・削除
- テキストファイル・フォルダ・プレイリストの読み込み
- 行単位/ファイル単位の再生と自動スクロール
- ルビ（読み）編集、統一、検索
- 再生速度・音量調整
- 一括 MP3 生成
- ダーク/ライトテーマ切り替え
- ドラッグ＆ドロップによるテキスト読込

---

## 主な機能

- エンジン接続状態の確認と、それが失敗した場合の自動起動
  - ローカルアドレス（`127.0.0.1` / `localhost`）では app 側から AivisSpeech Engine を起動する処理があります。
  - 既定の接続先は `http://127.0.0.1:10101`
- 話者モデル管理
  - `.aivm` / `.aivmx` を選択してモデルを追加
  - リストからモデル削除
- テキスト編集機能
  - フォントサイズ切替
  - 横書き / 縦書き切替
  - ルビ付与・ルビ解除
  - ルビの統一
  - ルビ箇所の検索
- 読み上げ制御
  - 再生/停止
  - 1行ごとの前後移動（10行単位）
  - 前後ファイル移動
  - 再生速度変更
  - 音量変更・ミュート
  - キャッシュ数調整
- 出力機能
  - 選択中テキストまたはプレイリストの音声を MP3 として生成
  - 生成進捗と再生進捗を可視化
- ストレージ
  - `localStorage` にテーマ、テキスト、プレイリスト、音量などを保持し再起動時に復元

---

## 必要環境

- OS: Windows 10 / 11 (x64)
- Node.js: 18 以降を推奨
- AivisSpeech Engine: インストール済みでローカルで起動可能な状態
- 既定パス: `C:\Program Files\AivisSpeech\AivisSpeech-Engine\run.exe`

アプリ側の実装では、ローカル接続先に対して `run.exe` を起動しようとする処理があります。実行時の URL は `http://127.0.0.1:10101` を前提にしています。

---

## セットアップ

### 1. 依存関係のインストール

```bash
git clone https://github.com/x-builder1965/xVoice.git
cd xVoice
npm install
```

### 2. AivisSpeech Engine を起動

このリポジトリには、ローカルの AivisSpeech Engine を起動するためのバッチファイルが含まれています。

```bat
AivisSpeech Engine起動.bat
```

中身は `C:\Program Files\AivisSpeech\AivisSpeech-Engine\run.exe` を起動し、`--host 0.0.0.0 --port 10101 --load_all_models` で起動する構成です。

別途、手動で AivisSpeech Engine を起動している場合は、そのままアプリから接続できます。

### 3. アプリを起動

```bash
npm start
```

開発時は `prestart` で `codemirror.js` を `codemirror.bundle.js` にバンドルしてから Electron を起動します。

---

## ビルド・配布

```bash
# 開発用バンドル
npm run build:editor

# Electron アプリの起動（npm start の前に自動実行されます）
npm start

# Windows 向けビルド
npm run build          # electron-builder による Windows パッケージ生成
npm run dist           # x64 最大圧縮ビルド
npm run dist:32        # 32bit ビルド
npm run dist:portable  # ポータブル版生成
npm run sign           # 署名付きビルド（CSC_KEY_PASSWORD が必要）
```

`package.json` の `build` 設定では `dist-win` に出力し、Windows の `nsis` インストーラー形式を生成する構成です。

---

## 補足

- 1つのアプリインスタンスのみを許可する実装になっており、重複起動は抑止されています。
- `.txt` と `.amppl` をドロップまたは選択して読み込めます。
- アプリの設定やプレイリストはローカル保存されるため、再起動後も状態を復元しやすい構成です。

---

## ライセンス・使用ライブラリ・商標表記

### ライセンス
- 本リポジトリのアプリ本体は、`package.json` 上で `MIT` と明示されているため、MIT License のもとで配布されています。
- ただし、外部ライブラリや AivisSpeech Engine などの第三者コンポーネントは、各上流プロジェクトのライセンス条件が適用されます。
- 依存ライブラリの正確な利用条件は、各パッケージの `LICENSE` / `LICENSE.txt` を確認してください。

### 使用ライブラリ（主要な依存関係）
本アプリケーションの開発・実行・ビルドには、以下の主要ライブラリを使用しています。

- **[Electron](https://www.electronjs.org/)** — MIT License
- **[electron-builder](https://www.electron.build/)** — MIT License
- **[esbuild](https://esbuild.github.io/)** — MIT License
- **[CodeMirror](https://codemirror.net/)** — MIT License
- **[fluent-ffmpeg](https://www.npmjs.com/package/fluent-ffmpeg)** — MIT License
- **[ffmpeg-static](https://www.npmjs.com/package/ffmpeg-static)** — MIT License（※実際の FFmpeg バイナリのライセンス条件は上流の FFmpeg 側を参照）

### 商標・権利表記
- 「xVoice」は本プロジェクトの名称であり、関係各社の商標ではありません。
- 「Electron」「Windows」「FFmpeg」「AivisSpeech」「CodeMirror」などの名称は、それぞれの権利者の商標または登録商標です。
- 本リポジトリは、これらの製品・サービス・エンジンとの連携用途として利用していますが、明示的な記載がない限り、各社の公式な提携・承認・後援を意味するものではありません。
- AivisSpeech Engine は第三者提供の外部エンジンであり、その利用条件は上流プロジェクト側のライセンスと利用規約を確認してください。

### 免責事項
- 本リポジトリの利用により発生した損害や法的責任について、作者は責任を負いません。
- ライセンスや商標については、各依存ライブラリ・外部サービスの最新情報を確認することを推奨します。
