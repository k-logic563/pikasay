# pikasay

ナキウサギが、入力したメッセージをターミナル上で一言しゃべる小さなCLIです。
通常・成功・注意・失敗の4モードを、表情と鳴き声、控えめな色で伝えます。

```text
   /\_/\
  ( •ᴗ• )  ぴ。
  / >🍃

  こんにちは
```

## 必要な環境

- Node.js 22以上
- npm

## 開発環境のセットアップ

```bash
npm install
npm run build
npm test
```

ビルド後は`node dist/cli.js`で実行できます。npmパッケージとしてインストールした場合のコマンド名は`pikasay`です。以下ではインストール後のコマンド名で説明します。

## 使い方

引数からメッセージを渡せます。複数の引数は空白で結合されます。

```bash
pikasay "こんにちは"
pikasay "複数の" "引数です"
```

標準入力も利用できます。入力内の改行と空行は維持され、各行が端末幅を超える場合だけ追加で折り返されます。メッセージ引数がある場合は、標準入力より引数を優先して標準入力を待ちません。

```bash
printf '1行目です\n2行目です\n3行目です\n' | pikasay --mood success
```

### モード

`--mood <normal|success|warning|error>`で表示を切り替えます。未指定時は`normal`です。モード名は小文字で指定してください。

`normal` — 穏やかな通常表示:

```text
   /\_/\
  ( •ᴗ• )  ぴ。
  / >🍃

  作業を始めるよ
```

`success` — うれしそうな成功表示:

```text
   /\_/\
  ( ^ᴗ^ )  ぴ！
  / >🍃

  テスト、通ったよ
```

`warning` — 少し不安そうな注意表示:

```text
   /\_/\
  ( •︵• )  ぴぃ…
  / >🍃

  未コミットの変更があります
```

`error` — 困った表情の失敗表示:

```text
   /\_/\
  ( >︵< )  ぴぎゃー！
  / >🍃

  ビルドに失敗しました
```

実行例:

```bash
pikasay --mood normal "作業を始めるよ"
pikasay --mood success "テスト、通ったよ"
pikasay "未コミットの変更があります" --mood warning
echo "ビルドに失敗しました" | pikasay --mood error
```

`error`は表示上のモードです。正しく表示できた場合の終了コードは`0`です。不正なモード名は利用可能なモードを標準エラーへ示し、非ゼロで終了します。

### 色を無効にする

色はナキウサギのAAと鳴き声だけに付き、色がなくても表情と鳴き声でモードを識別できます。次のいずれかの場合、ANSIカラーを出力しません。

- `--no-color`を指定した場合
- `NO_COLOR`環境変数が存在する場合（値は問いません）
- 標準出力がTTYではない場合（パイプやリダイレクトなど）

```bash
pikasay --no-color --mood success "テスト成功"
NO_COLOR=1 pikasay --mood warning "確認が必要です"
```

## オプション

```text
--mood <normal|success|warning|error>  表情・雰囲気を指定（既定値: normal）
--no-color                            ANSIカラーを無効化
-h, --help                            ヘルプを表示
-v, --version                         バージョンを表示
```

```bash
pikasay --help
pikasay --version
```

ローカル開発時は、上記の`pikasay`を`node dist/cli.js`へ読み替えてください。
