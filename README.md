# xVoice (AivisSpeech Text-to-Speech App)

`xVoice` は、[AivisSpeech Engine](https://github.com/Aivis-Project/AivisSpeech) と連携してテキストの読み上げおよび音声保存（MP3化）を行う Electron デスクトップアプリケーションです。

---

## 🌟 主な機能

- **テキストの逐次読み上げ**: 1行ごとに音声生成・再生（再生中行のハイライト＆自動スクロール機能付き）
- **全文MP3保存機能**: 入力テキスト全体を一括で音声化し、単一の MP3 ファイルとして結合・保存
- **リアルタイム進捗表示**: エンジン起動確認、再生中行、MP3生成率（生成行／全行数）を色分けプログレスバーで視覚表示
- **テーマ切り替え**: ダークモード / ライトモード対応
- **ファイル読み込み**: テキストファイル（`.txt` 等）のドラッグ＆ドロップおよび参照読み込み

---

## 🛠 動作環境・前提条件

- **OS**: Windows 10 / 11 (x64)
- **AivisSpeech Engine**: ローカル環境（`http://127.0.0.1:10101`）で起動している必要があります。
- **Node.js**: v18 以降推奨 (開発・ビルド時)

---

## 🚀 開発・実行手順

```bash
# リポジトリのクローンと依存関係のインストール
git clone https://github.com/x-builder1965/xVoice.git
cd xVoice
npm install

# 開発モードで起動
npm start

# アプリのビルド・パッケージング
npm run build          # Windows インストーラー生成（dist-win/ に出力）
npm run dist           # x64 向け最大圧縮ビルド
npm run dist:32        # 32bit 版ビルド
npm run dist:portable  # ポータブル版 (.exe) の生成
npm run sign           # 署名付きビルド（環境変数 CSC_KEY_PASSWORD が必要）
```
