# pikasay 技術選定メモ

## 位置づけ

- 対象: Phase 0「リポジトリ確認と技術選定」
- 記録日: 2026-09-20
- この文書は構成方針のみを定める。CLI本体、設定ファイル、`package.json`の作成はPhase 1以降で行う。

## 調査時点のリポジトリ

- 存在するファイルは`AGENTS.md`、`REQUIREMENTS.md`、`docs/IMPLEMENTATION_PLAN.md`のみ。
- `package.json`、ロックファイル、ソースコード、テスト、ビルド・lint・format設定は存在しない。
- 現在のディレクトリはGitリポジトリではないため、Git状態と現在のブランチは取得できない。
- ローカル環境はNode.js v24.16.0、npm 12.0.2、Git 2.50.1。
- `tsc`、`tsx`、Vitest、Jest、ESLint、Prettier、Biomeのグローバルコマンドは存在しない。開発ツールはグローバル環境に依存せず、プロジェクトの`devDependencies`からnpm scripts経由で実行する。

## 採用する技術構成

### 言語とモジュール形式

- TypeScriptを採用し、`strict`を有効にする。
- npmパッケージはES Modules（`"type": "module"`）とする。
- `tsc`でNode.js向けJavaScriptへコンパイルし、生成物を`dist/`へ出力する。
- コンパイル対象は`src/`だけとし、公開物にテストコードを混ぜない。

小規模なCLIでも、引数解析、入力元の優先順位、モード、表示幅、終了コードの境界を型で明示できるためTypeScriptを選ぶ。実行時にTypeScriptローダーを要求せず、配布物はNode.jsだけで実行できるJavaScriptにする。

### Node.jsサポート

- `package.json`の`engines.node`は`>=22`を予定する。
- 開発とCIでは、最低対応のNode.js 22と現行LTSのNode.js 24で確認する方針とする。
- Node.js 20以前は調査時点でEOLのため、新規CLIのサポート対象に含めない。

### package.jsonの予定値

パッケージ名の公開可否はPhase 4で確認するが、Phase 0では次の設計に決定する。

```json
{
  "name": "pikasay",
  "type": "module",
  "bin": {
    "pikasay": "./dist/cli.js"
  },
  "files": [
    "dist"
  ],
  "engines": {
    "node": ">=22"
  }
}
```

- `src/cli.ts`をCLIエントリポイントとし、先頭にNode.js用shebangを置く。`tsc`がshebangを保った`dist/cli.js`を生成する構成にする。
- npmコマンド名は`pikasay`に固定する。npm上のパッケージ名が利用できない場合でも、`bin`名は変更しない。
- 公開対象は`files`で`dist/`に限定する。npmが標準で含める`package.json`、`README.md`、`LICENSE`と合わせ、`npm pack --dry-run`で最終確認する。

### build、test、lint、format

- build: `typescript`の`tsc`を使用し、`npm run build`から実行する。
- test: Node.js標準の`node:test`と`node:assert/strict`を使う。TypeScriptのテスト実行には開発時のみ`tsx`を使い、テスト前にbuildも行う。
- lint・format: 1つの開発ツールで両方を扱えるBiomeを使用する。型検査は`tsc`に任せる。
- 予定する直接`devDependencies`は`typescript`、`@types/node`、`tsx`、`@biomejs/biome`。バージョンは導入時に固定し、`package-lock.json`をコミットする。
- 実行時`dependencies`は初期状態で0件とする。

予定するnpm scriptsは次のとおり。

```json
{
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "npm run build && tsx --test test/*.test.ts",
    "lint": "biome lint .",
    "format": "biome format --write .",
    "format:check": "biome format .",
    "check": "npm run lint && npm run format:check && npm test",
    "prepack": "npm run build"
  }
}
```

テストファイルは当面`test/`直下へ置く。規模が増えて階層化が必要になった時点で、環境依存のglobに頼らないテスト探索方法へ変更する。

## 想定ディレクトリ構成

Phase 1以降で必要になったものだけを作成する。

```text
pikasay/
├── src/
│   ├── cli.ts          # shebangを持つ薄いCLIエントリ
│   ├── options.ts      # 引数解析
│   ├── input.ts        # 引数・標準入力の選択と制限
│   └── render.ts       # AAとメッセージの組み立て
├── test/               # node:testによるテスト
├── dist/               # tsc生成物。npm公開対象
├── docs/
├── package.json
├── package-lock.json
├── tsconfig.json
├── biome.json
├── README.md
└── LICENSE
```

モジュールは責務が実際に分かれた時だけ追加し、先に空ファイルや過剰な階層を作らない。

## インストールから検証までの流れ

初回または依存関係を変更する開発時:

```bash
npm install
npm run build
npm test
npm run lint
npm run format:check
npm pack --dry-run
```

`package-lock.json`作成後のクリーン環境とCI:

```bash
npm ci
npm run check
npm pack --dry-run
```

`npm test`は先にbuildする設計なので、CLI統合テストから`dist/cli.js`を実行できる。`npm run check`はlint、format確認、buildを含むtestを順に実行する。

## 実行時依存を最小限にする方針

- 引数解析、標準入力、端末幅の取得、テストにはNode.js標準APIを使う。
- 4モードと固定された少数オプションのため、汎用CLIフレームワークは導入しない。
- 色を使う場合も小さなANSI表現に留め、色ライブラリは導入しない。
- Unicode表示幅は自前実装を無理に拡大しない。Phase 2で日本語・英語・絵文字のテスト結果を確認し、標準APIだけでは要件を満たせない場合に限り、保守状況とサイズを確認した単機能パッケージの追加を再判断する。
- 実行時の外部通信、動的ダウンロード、外部API呼び出しは行わない。

## Phase 1前の確認事項

- Gitリポジトリをいつ、どのブランチ方針で初期化するか。
- npmパッケージの説明、作者、ライセンスを`package.json`へ記載するため、採用ライセンスを決めること。
- Phase 1で開発ツールを導入する時点の安定版を確認し、正確なバージョンをロックすること。

パッケージ名`pikasay`のnpmレジストリ上の利用可能性確認は、実装計画どおりPhase 4で行う。
