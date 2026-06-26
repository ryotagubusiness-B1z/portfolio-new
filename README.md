# Ryota — Portfolio

[chriskalafatis.com](https://chriskalafatis.com/) の質感を忠実に再現した、ブラック×ホワイトの Swiss / キネティック・ポートフォリオ。
依存ライブラリなしの素の HTML / CSS / JavaScript。

## 再現した要素

- **黒地・白文字 / ワイドグロテスク大文字** — 有料の *PP Telegraf* に近い無料フォント *Switzer*（Helvetica系）を使用
- **十字（クロスヘア）カーソル** — 白い4本バー＋`mix-blend-mode: difference`。リンクで外側に広がり、作品ではボックス状に拡大
- **ローダー** — 白地に名前のせり上がり＋右下の `%` カウンター → 上方向にワイプして黒のヒーローへ
- **キネティック・タイポ** — ヒーロー見出しが2層（実体＋ストロークのゴースト）でずれて漂う二重露光演出
- **マスクリンク** — ナビ/メールがホバーで上にスライドし複製が入れ替わる
- **Swiss ナンバリング** — `01 // 04` などのセクション番号
- **Capabilities** — `← Drag →` でドラッグ可能、自動マーキーのピル
- レスポンシブ / `prefers-reduced-motion` / タッチ端末フォールバック対応

## 構成

```
index.html
assets/
  css/style.css
  js/main.js
```

ビルド不要。ローカルで見る場合はフォルダ内で簡易サーバーを起動してください（`file://` だとフォント取得が制限される場合があるため）:

```bash
python -m http.server
# → http://localhost:8000/
```

## カスタマイズ

- 文言・作品・SNSリンクは `index.html` のプレースホルダを差し替え
- 配色・余白は `assets/css/style.css` の `:root` 変数
- フォントを本物の *PP Telegraf* に差し替えれば、より完全な再現になります

---

© 2026 Ryota
