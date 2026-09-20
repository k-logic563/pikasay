import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { once } from "node:events";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { runCli } from "../src/app.js";
import { parseArguments } from "../src/options.js";
import {
  ensureInputWithinLimit,
  InputTooLongError,
  MAX_INPUT_BYTES,
  trimTrailingLineBreaks,
} from "../src/input.js";
import { displayWidth, renderMessage, wrapText } from "../src/render.js";

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

async function runInjectedCli(
  args: readonly string[],
  options: {
    readonly input?: string;
    readonly inputIsTTY?: boolean;
    readonly outputIsTTY?: boolean;
    readonly columns?: number;
    readonly noColorEnvironment?: boolean;
  } = {},
): Promise<CliResult> {
  let stdout = "";
  let stderr = "";
  const inputValue = options.input ?? "";
  const input = {
    isTTY: options.inputIsTTY,
    async *[Symbol.asyncIterator](): AsyncGenerator<string> {
      if (inputValue.length > 0) {
        yield inputValue;
      }
    },
  };
  const output = {
    isTTY: options.outputIsTTY,
    columns: options.columns,
    write(chunk: string): boolean {
      stdout += chunk;
      return true;
    },
  };
  const error = {
    write(chunk: string): boolean {
      stderr += chunk;
      return true;
    },
  };
  const code = await runCli({
    args,
    input,
    output,
    error,
    version: "0.1.0",
    noColorEnvironment: options.noColorEnvironment,
  });
  return { code, stdout, stderr };
}

async function executeCli(
  args: readonly string[],
  input?: string,
  environment?: NodeJS.ProcessEnv,
): Promise<CliResult> {
  const child = spawn(process.execPath, [cliPath, ...args], {
    cwd: repositoryRoot,
    env: environment === undefined ? process.env : environment,
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
    mood: "normal",
    noColor: false,
  });
});

test("表示オプションはメッセージの前後どちらでも解析できる", () => {
  assert.deepEqual(
    parseArguments(["テスト成功", "--mood", "success", "--no-color"]),
    {
      kind: "message",
      message: "テスト成功",
      mood: "success",
      noColor: true,
    },
  );
});

test("--以降はオプションに見える文字列もメッセージとして扱う", () => {
  assert.deepEqual(parseArguments(["--", "--help", "-から始まる"]), {
    kind: "message",
    message: "--help -から始まる",
    mood: "normal",
    noColor: false,
  });
});

test("helpとversionは--より前ならほかの引数より優先する", () => {
  assert.deepEqual(parseArguments(["--unknown", "--version"]), {
    kind: "version",
  });
  assert.deepEqual(parseArguments(["--version", "--help", "message"]), {
    kind: "help",
  });
});

test("標準入力末尾の改行だけを取り除く", () => {
  assert.equal(trimTrailingLineBreaks("1行目\n2行目\n\n"), "1行目\n2行目");
});

test("入力上限以内を受理し、1 byte超過を拒否する", () => {
  assert.doesNotThrow(() =>
    ensureInputWithinLimit("a".repeat(MAX_INPUT_BYTES)),
  );
  assert.throws(
    () => ensureInputWithinLimit("a".repeat(MAX_INPUT_BYTES + 1)),
    InputTooLongError,
  );
});

test("描画結果に通常状態のAAと複数行メッセージを含む", () => {
  const output = renderMessage("1行目\n2行目");
  assert.match(output, /\/\\_\/\\/u);
  assert.match(output, /\( •ᴗ• \).*ぴ。/u);
  assert.match(output, /1行目\n {2}2行目/u);
});

test("モード未指定時はnormalになる", () => {
  assert.equal(
    renderMessage("通常"),
    renderMessage("通常", { mood: "normal" }),
  );
});

test("4モードを色なしでも表情と鳴き声で識別できる", () => {
  const expectations = {
    normal: ["•ᴗ•", "ぴ。"],
    success: ["^ᴗ^", "ぴ！"],
    warning: ["•︵•", "ぴぃ…"],
    error: [">︵<", "ぴぎゃー！"],
  } as const;

  for (const [mood, markers] of Object.entries(expectations)) {
    const output = renderMessage("メッセージ", {
      mood: mood as keyof typeof expectations,
    });
    for (const marker of markers) {
      assert.ok(output.includes(marker), `${mood}に${marker}が含まれる`);
    }
    assert.ok(!output.includes("\u001B["));
  }
});

test("各モードに控えめなANSIカラーを付けられる", () => {
  const colors = {
    normal: 36,
    success: 32,
    warning: 33,
    error: 31,
  } as const;
  for (const [mood, color] of Object.entries(colors)) {
    assert.match(
      renderMessage("色付き", {
        mood: mood as keyof typeof colors,
        color: true,
      }),
      new RegExp(`\\u001B\\[${color}m`),
    );
  }
});

test("日本語、英語、絵文字、結合文字、ANSIの表示幅を数えられる", () => {
  assert.equal(displayWidth("日本語"), 6);
  assert.equal(displayWidth("English"), 7);
  assert.equal(displayWidth("👨‍👩‍👧‍👦"), 2);
  assert.equal(displayWidth("e\u0301"), 1);
  assert.equal(displayWidth("\u001B[31m赤\u001B[0m"), 2);
});

test("日本語と英語を表示幅で折り返す", () => {
  assert.deepEqual(wrapText("日本語です", 6), ["日本語", "です"]);
  assert.deepEqual(wrapText("abcdef", 3), ["abc", "def"]);
});

test("絵文字と結合文字を書記素の途中で壊さない", () => {
  assert.deepEqual(wrapText("A👨‍👩‍👧‍👦Be\u0301", 2), [
    "A",
    "👨‍👩‍👧‍👦",
    "Be\u0301",
  ]);
});

test("明示的な改行と空行を維持し、各行だけを追加で折り返す", () => {
  assert.deepEqual(wrapText("abcd\n\nefgh", 2), ["ab", "cd", "", "ef", "gh"]);
});

test("端末幅がない場合は既定幅を使い、極端に狭くても例外にならない", () => {
  const defaultWidthOutput = renderMessage("a".repeat(100));
  const messageLines = defaultWidthOutput.split("\n").slice(4, -1);
  assert.ok(messageLines.every((line) => displayWidth(line) <= 80));
  assert.doesNotThrow(() => renderMessage("日本語👨‍👩‍👧‍👦", { columns: 1 }));
  assert.ok(renderMessage("👨‍👩‍👧‍👦", { columns: 1 }).includes("👨‍👩‍👧‍👦"));
});

test("1つの日本語引数を表示できる", async () => {
  const result = await executeCli(["こんにちは"]);
  assert.equal(result.code, 0);
  assert.equal(result.stderr, "");
  assert.match(result.stdout, /こんにちは/u);
  assert.match(result.stdout, /\( •ᴗ• \)/u);
});

test("英語、絵文字、結合文字を引数から安全に表示できる", async () => {
  const message = "English 👨‍👩‍👧‍👦 e\u0301";
  const result = await executeCli([message]);
  assert.equal(result.code, 0);
  assert.ok(result.stdout.includes(message));
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

test("標準入力の空行を維持する", async () => {
  const result = await executeCli(["--mood", "success"], "1行目\n\n3行目\n");
  assert.equal(result.code, 0);
  assert.match(result.stdout, /1行目\n {2}\n {2}3行目/u);
});

test("標準入力とmoodオプションを組み合わせられる", async () => {
  const result = await executeCli(["--mood", "warning"], "警告です\n");
  assert.equal(result.code, 0);
  assert.match(result.stdout, /ぴぃ…/u);
  assert.match(result.stdout, /警告です/u);
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

test("不正なモードは候補を標準エラーへ示して終了コード1を返す", async () => {
  const result = await executeCli(["--mood", "unknown", "メッセージ"]);
  assert.equal(result.code, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /unknown/u);
  assert.match(result.stderr, /normal, success, warning, error/u);
});

test("値のない--moodも分かりやすい利用エラーになる", async () => {
  const result = await executeCli(["--mood"]);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /値がありません/u);
});

test("不明なオプションは標準エラーへ案内して終了コード1を返す", async () => {
  const result = await executeCli(["--unknown-option"]);
  assert.equal(result.code, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /不明なオプション/u);
  assert.match(result.stderr, /pikasay --help/u);
});

test("--以降の-から始まる文字列をメッセージとして表示する", async () => {
  const result = await executeCli(["--", "--helpではないメッセージ"]);
  assert.equal(result.code, 0);
  assert.equal(result.stderr, "");
  assert.match(result.stdout, /--helpではないメッセージ/u);
});

test("正しいerrorモードは表示に成功して終了コード0を返す", async () => {
  const result = await executeCli(["--mood", "error", "失敗しました"]);
  assert.equal(result.code, 0);
  assert.equal(result.stderr, "");
  assert.match(result.stdout, /ぴぎゃー！/u);
});

test("TTYでは色を付け、--no-colorで無効化する", async () => {
  const colored = await runInjectedCli(["成功"], {
    inputIsTTY: true,
    outputIsTTY: true,
  });
  const plain = await runInjectedCli(["--no-color", "成功"], {
    inputIsTTY: true,
    outputIsTTY: true,
  });
  assert.ok(colored.stdout.includes("\u001B["));
  assert.ok(!plain.stdout.includes("\u001B["));
});

test("NO_COLORが存在するとTTYでも色を無効化する", async () => {
  const result = await runInjectedCli(["--mood", "warning", "確認"], {
    inputIsTTY: true,
    outputIsTTY: true,
    noColorEnvironment: true,
  });
  assert.ok(!result.stdout.includes("\u001B["));
});

test("非TTY出力にはANSIコードを含めない", async () => {
  const result = await runInjectedCli(["--mood", "success", "成功"], {
    inputIsTTY: true,
    outputIsTTY: false,
  });
  assert.ok(!result.stdout.includes("\u001B["));
});

test("注入した端末幅でメッセージを折り返す", async () => {
  const result = await runInjectedCli(["日本語です"], {
    inputIsTTY: true,
    outputIsTTY: true,
    columns: 8,
    noColorEnvironment: true,
  });
  assert.match(result.stdout, / {2}日本語\n {2}です/u);
});

test("子プロセスでも--no-color、NO_COLOR、非TTYはANSIを出さない", async () => {
  const noColorOption = await executeCli(["--no-color", "色なし"]);
  const noColorEnvironment = await executeCli(
    ["--mood", "warning", "色なし"],
    undefined,
    { ...process.env, NO_COLOR: "1" },
  );
  const nonTty = await executeCli(["--mood", "success", "非TTY"]);
  for (const result of [noColorOption, noColorEnvironment, nonTty]) {
    assert.equal(result.code, 0);
    assert.ok(!result.stdout.includes("\u001B["));
  }
});

test("--helpはヘルプを標準出力へ表示する", async () => {
  const result = await executeCli(["--help"]);
  assert.equal(result.code, 0);
  assert.equal(result.stderr, "");
  assert.match(result.stdout, /使い方:/u);
  assert.match(result.stdout, /command \| pikasay/u);
  assert.match(result.stdout, /--mood <normal\|success\|warning\|error>/u);
  assert.match(result.stdout, /--no-color/u);
  assert.match(result.stdout, /NO_COLOR/u);
  assert.match(result.stdout, /65536 bytes/u);
  assert.match(result.stdout, /-- の後/u);
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

test("空文字列と空白だけの引数を入力なしとして拒否する", async () => {
  for (const args of [[""], ["   \t"]]) {
    const result = await executeCli(args);
    assert.equal(result.code, 1);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /メッセージがありません。/u);
  }
});

test("改行だけと空白だけの標準入力を拒否する", async () => {
  for (const input of ["\n\r\n", "  \t  \n"] as const) {
    const result = await executeCli([], input);
    assert.equal(result.code, 1);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /メッセージがありません。/u);
  }
});

test("上限以内の長い引数を処理できる", async () => {
  const result = await runInjectedCli(["a".repeat(MAX_INPUT_BYTES)], {
    inputIsTTY: true,
    columns: 80,
  });
  assert.equal(result.code, 0);
  assert.equal(result.stderr, "");
  const messageLines = result.stdout.split("\n").slice(4, -1);
  assert.ok(messageLines.every((line) => displayWidth(line) <= 80));
});

test("上限を超える引数はスタックトレースなしで拒否する", async () => {
  const result = await runInjectedCli(["a".repeat(MAX_INPUT_BYTES + 1)], {
    inputIsTTY: true,
  });
  assert.equal(result.code, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /入力が長すぎます/u);
  assert.doesNotMatch(result.stderr, /at runCli|InputTooLongError/u);
});

test("上限を超える標準入力は読み取り中に拒否する", async () => {
  const result = await runInjectedCli([], {
    input: "あ".repeat(Math.floor(MAX_INPUT_BYTES / 3) + 1),
    inputIsTTY: false,
  });
  assert.equal(result.code, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /入力が長すぎます/u);
  assert.doesNotMatch(result.stderr, /at runCli|InputTooLongError/u);
});

test("入力内容をシェルコードとして解釈しない", async () => {
  const message = "$(printf 危険) `uname` ; rm -rf example";
  const result = await executeCli([message]);
  assert.equal(result.code, 0);
  assert.ok(result.stdout.includes(message));
});
