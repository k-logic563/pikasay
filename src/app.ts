import type { InputStream } from "./input.js";
import { readStandardInput, trimTrailingLineBreaks } from "./input.js";
import { parseArguments } from "./options.js";
import { renderMessage } from "./render.js";

interface OutputStream {
  readonly isTTY?: boolean;
  readonly columns?: number;
  write(chunk: string): unknown;
}

export interface CliEnvironment {
  readonly args: readonly string[];
  readonly input: InputStream;
  readonly output: OutputStream;
  readonly error: OutputStream;
  readonly version: string;
  readonly noColorEnvironment?: boolean;
}

export const HELP_TEXT = `ナキウサギがメッセージを一言しゃべります。

使い方:
  pikasay [options] [message...]
  command | pikasay [options]

例:
  pikasay "こんにちは"
  pikasay --mood success "テスト、通ったよ"
  printf '確認が必要です\\n' | pikasay --mood warning

オプション:
  --mood <normal|success|warning|error>
                     表情・雰囲気を指定（既定値: normal）
  --no-color         ANSIカラーを無効化
  -h, --help         ヘルプを表示
  -v, --version      バージョンを表示

環境変数:
  NO_COLOR           値にかかわらず、存在する場合はANSIカラーを無効化
`;

export const NO_INPUT_MESSAGE = `メッセージがありません。
使い方: pikasay [message...]
詳しくは pikasay --help を実行してください。
`;

export async function runCli(environment: CliEnvironment): Promise<number> {
  const parsed = parseArguments(environment.args);

  if (parsed.kind === "help") {
    environment.output.write(HELP_TEXT);
    return 0;
  }

  if (parsed.kind === "version") {
    environment.output.write(`${environment.version}\n`);
    return 0;
  }

  if (parsed.kind === "error") {
    environment.error.write(parsed.message);
    return 1;
  }

  const render = (message: string): void => {
    environment.output.write(
      renderMessage(message, {
        mood: parsed.mood,
        color:
          !parsed.noColor &&
          environment.noColorEnvironment !== true &&
          environment.output.isTTY === true,
        columns: environment.output.columns,
      }),
    );
  };

  if (parsed.kind === "message") {
    const message = trimTrailingLineBreaks(parsed.message);
    if (message.length > 0) {
      render(message);
      return 0;
    }
  } else if (environment.input.isTTY !== true) {
    const message = await readStandardInput(environment.input);
    if (message.length > 0) {
      render(message);
      return 0;
    }
  }

  environment.error.write(NO_INPUT_MESSAGE);
  return 1;
}
