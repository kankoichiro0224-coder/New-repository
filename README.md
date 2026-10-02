# 相場天気図(日経VI × Fear & Greed)

日経平均VIとCNN Fear & Greed Indexを並べて表示し、2つを合成した「恐怖度」を天気(☀️〜⛈️)で示す静的Webダッシュボードです。

## 構成

```
fetcher/fetch_data.py   データ取得(標準ライブラリのみ)→ web/data/latest.json
web/                    表示部分(HTML/CSS/JS、ビルド不要・外部ライブラリなし)
tests/                  パーサのテスト
.github/workflows/      GitHub Pages への自動デプロイ
```

取得と表示は `web/data/latest.json` だけで繋がっています。

## 動かし方

```bash
python3 fetcher/fetch_data.py            # 実データを取得(要インターネット)
python3 fetcher/fetch_data.py --sample   # オフライン用の合成サンプルデータ
python3 -m http.server 8000 --directory web
# → http://localhost:8000
python3 -m unittest discover -s tests    # テスト
```

リポジトリには `--sample` で作ったデータを同梱しており、画面上に警告バナーが出ます。実データを取得すると消えます。

## データソース

- 日経VI: 日本経済新聞社の公開CSV(`indexes.nikkei.co.jp/nkave/historical/nikkei_stock_average_vi_daily_jp.csv`)
- Fear & Greed: CNNが公開しているグラフ用JSON(非公式エンドポイントのため、仕様変更で動かなくなる可能性があります)

## 恐怖度と天気

恐怖度 = (日経VIの期間内パーセンタイル + (100 − Fear & Greed)) ÷ 2

| 恐怖度 | 天気 |
|---|---|
| 〜20 | ☀️ 快晴(楽観) |
| 〜40 | 🌤️ 晴れ |
| 〜60 | ☁️ 曇り |
| 〜80 | 🌧️ 雨(警戒) |
| 80〜 | ⛈️ 嵐(パニック) |

しきい値は `web/app.js` の `WEATHER` で変更できます。

## GitHub Pages で公開

1. リポジトリの Settings → Pages → Source を **GitHub Actions** にする
2. `main` に push するか Actions から "Deploy dashboard" を実行する

平日の東京引け後に自動更新されます。実データの取得に失敗した場合はサンプルにフォールバックし、画面に警告が出ます。

投資助言ではありません。
