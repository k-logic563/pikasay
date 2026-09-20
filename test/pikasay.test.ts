import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { once } from "node:events";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { parseArguments } from "../src/options.js";
import { trimTrailingLineBreaks } from "../src/input.js";
import { PIKA_ASCII_ART, renderMessage } from "../src/render.js";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const cliPath = path.join(repositoryRoot, "dist", "cli.js");

interface CliResult {
  readonly code: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

async function executeCli(
  args: readonly string[],
  input?: string,
): Promise<CliResult> {
  const child = spawn(process.execPath, [cliPath, ...args], {
    cwd: repositoryRoot,
    stdio: ["pipe", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk: string) => {
    stderr += chunk;
  });
  child.stdin.end(input);
  const [code] = (await once(child, "close")) as [number | null];
  return { code, stdout, stderr };
}

test("引数解析は複数のメッセージ引数を空白で結合する", () => {
  assert.deepEqual(parseArguments(["複数の", "引数です"]), {
    kind: "message",
    message: "複数の 引数です",
  });
});

test("標準入力末尾の改行だけを取り除く", () => {
  assert.equal(trimTrailingLineBreaks("1行目\n2行目\n\n"), "1行目\n2行目");
});

test("描画結果に通常状態のAAと複数行メッセージを含む", () => {
  const output = renderMessage("1行目\n2行目");
  assert.match(
    output,
    new RegExp(PIKA_ASCII_ART.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
  );
  assert.match(output, /1行目\n {2}2行目/u);
});

test("1つの日本語引数を表示できる", async () => {
  const result = await executeCli(["こんにちは"]);
  assert.equal(result.code, 0);
  assert.equal(result.stderr, "");
  assert.match(result.stdout, /こんにちは/u);
  assert.match(result.stdout, /\( •ᴗ• \)/u);
});

test("複数引数を空白で結合して表示できる", async () => {
  const result = await executeCli(["複数の", "引数です"]);
  assert.equal(result.code, 0);
  assert.match(result.stdout, /複数の 引数です/u);
});

test("標準入力を表示し、入力内の改行を保持する", async () => {
  const result = await executeCli([], "1行目\n2行目\n");
  assert.equal(result.code, 0);
  assert.match(result.stdout, /1行目\n {2}2行目/u);
});

test("引数を標準入力より優先する", async () => {
  const result = await executeCli(["引数"], "標準入力\n");
  assert.equal(result.code, 0);
  assert.match(result.stdout, /引数/u);
  assert.doesNotMatch(result.stdout, /標準入力/u);
});

test("引数がある場合は閉じていない標準入力を待たない", async () => {
  const child = spawn(process.execPath, [cliPath, "すぐ表示"], {
    cwd: repositoryRoot,
    stdio: ["pipe", "pipe", "pipe"],
  });
  const timeout = setTimeout(() => child.kill(), 2_000);
  const [code] = (await once(child, "close")) as [number | null];
  clearTimeout(timeout);
  assert.equal(code, 0);
});

test("--helpはヘルプを標準出力へ表示する", async () => {
  const result = await executeCli(["--help"]);
  assert.equal(result.code, 0);
  assert.equal(result.stderr, "");
  assert.match(result.stdout, /使い方:/u);
  assert.match(result.stdout, /command \| pikasay/u);
});

test("-hは--helpの短縮形として動作する", async () => {
  const result = await executeCli(["-h"]);
  assert.equal(result.code, 0);
  assert.match(result.stdout, /使い方:/u);
});

test("--versionはpackage.jsonのバージョンと一致する", async () => {
  const packageJson = JSON.parse(
    await readFile(path.join(repositoryRoot, "package.json"), "utf8"),
  ) as {
    version: string;
  };
  const result = await executeCli(["--version"]);
  assert.equal(result.code, 0);
  assert.equal(result.stderr, "");
  assert.equal(result.stdout, `${packageJson.version}\n`);
});

test("-vは--versionの短縮形として動作する", async () => {
  const [shortResult, longResult] = await Promise.all([
    executeCli(["-v"]),
    executeCli(["--version"]),
  ]);
  assert.equal(shortResult.code, 0);
  assert.equal(shortResult.stdout, longResult.stdout);
});

test("入力がない場合は標準エラーへ案内を表示して終了コード1を返す", async () => {
  const result = await executeCli([]);
  assert.equal(result.code, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /メッセージがありません。/u);
  assert.match(result.stderr, /pikasay --help/u);
});
