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

### 1. リポジトリのクローンと依存関係のインストール

```bash
git clone [https://github.com/x-builder1965/xVoice.git](https://github.com/x-builder1965/xVoice.git)
cd xVoice
npm install
