# ページの差分を見るやつ
- 2つのURLの差分を取って表示する
- タイミング問題で差分ができるやつのWaitをフロントから調節できる

## 使い方
動かなかったら直して

```bash
$ npm ci
$ npx playwright install chromium
$ npm run dev
```

## いいところ
- Node上でplaywrightを動かして取ってくるので、localhostでも見れるし、CORSのトラブルが起こりづらい
- react-routerのroutesに全部乗ってるので、フロントもバックエンドも分かれてなくて手軽に使える

## ロードマップ
- UA, Viewportをフォームから入れられるようにする
- URL周りの改修
  - 履歴機能
  - 任意のURLを保存しておける機能
- 画像の保存
  - 今もできるけどファイル名が自動でつかなくて不便
