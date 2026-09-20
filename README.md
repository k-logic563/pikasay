# pikasay

ナキウサギが、入力したメッセージをターミナル上で一言しゃべる小さなCLIです。

```text
   /\_/\
  ( •ᴗ• )
  / >🍃

  こんにちは
```

## 必要な環境

- Node.js 22以上
- npm

## 開発環境のセットアップ

```bash
npm install
```

## ビルドとテスト

```bash
npm run build
npm test
```

## ローカルでの実行

ビルド後のCLIをNode.jsで直接実行できます。

```bash
node dist/cli.js "こんにちは"
node dist/cli.js "複数の" "引数です"
```

標準入力も利用できます。メッセージ引数がある場合は、標準入力より引数を優先します。

```bash
printf '1行目\n2行目\n' | node dist/cli.js
```

ヘルプとバージョンは次のように確認できます。

```bash
node dist/cli.js --help
node dist/cli.js --version
```

npmパッケージとしてインストールした場合のコマンド名は`pikasay`です。
