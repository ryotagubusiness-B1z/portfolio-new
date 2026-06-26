# Ryota — Portfolio

カーソル追従・マグネティック効果・スクロール演出を備えた、ダーク基調の高級感あるポートフォリオ（試作版）。
[chriskalafatis.com](https://chriskalafatis.com/) のようなインタラクションを参考に、シャンパンゴールド × 近黒の配色とエディトリアルなセリフ書体で構成しています。

## 特徴

- **カスタムカーソル** — ドット＋遅延追従するリング。リンク／作品にホバーで拡大・`VIEW` ラベル表示
- **マグネティックボタン** — Contact の円形 CTA がカーソルに吸い付く
- **オーロラグロー** — カーソルを追う背景の発光
- **ローダー** — `0 → 100%` カウントアップ後にスライドアップ
- **テキストのマスクリビール** — ヒーロー見出しが行ごとにせり上がる
- **作品リスト** — ホバーでカーソル位置にサムネイル追従
- **スクロールリビール / マーキー / JST時計**
- レスポンシブ対応・`prefers-reduced-motion` / タッチ端末フォールバック

## 構成

```
index.html
assets/
  css/style.css
  js/main.js
```

ビルド不要。`index.html` をブラウザで開くだけで動作します。

## カスタマイズ

- 配色・書体は `assets/css/style.css` の `:root` 変数で調整
- 作品・プロフィール・SNSリンクは `index.html` 内のプレースホルダを差し替え
- 書体は Google Fonts（Fraunces / Manrope）

## 技術

Vanilla HTML / CSS / JavaScript（依存ライブラリなし）。GitHub Pages でそのまま公開できます。

---

© 2026 Ryota
