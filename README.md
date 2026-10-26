# わたしの ミカタ

訪問看護ステーションはるうたの利用者さん（知的障害のある子ども〜大人）向けの生活支援アプリ。
つたえる・手順・タイマー・お金・安全（ヘルプカード）。こども／おとなの切り替え。音は最初すべてオフ。

- 公開: https://haru-uta.github.io/watashi-no-mikata/
- 仕様: [docs/spec.md](docs/spec.md)
- 試験: `node tools/e2e.mjs`（3サイズ×2モードで全画面を操作。はみ出し・重なり・言葉の途中の改行・絵の失敗・自動で音が鳴らないかを点検）
- 絵: `python tools/gen_art.py` → `tools/cut_sheet.py` / `tools/cut_scenes.py`
