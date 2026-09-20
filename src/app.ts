import type { InputStream } from "./input.js";
import { readStandardInput, trimTrailingLineBreaks } from "./input.js";
import { parseArguments } from "./options.js";
import { renderMessage } from "./render.js";

interface OutputStream {
  write(chunk: string): unknown;
}

export interface CliEnvironment {
  readonly args: readonly string[];
  readonly input: InputStream;
  readonly output: OutputStream;
  readonly error: OutputStream;
  readonly version: string;
}

export const HELP_TEXT = `ナキウサギがメッセージを一言しゃべります。

使い方:
  pikasay [message...]
  command | pikasay

例:
  pikasay "こんにちは"
  printf 'こんにちは\\n' | pikasay

オプション:
  -h, --help     ヘルプを表示
  -v, --version  バージョンを表示
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

  if (parsed.kind === "message") {
    const message = trimTrailingLineBreaks(parsed.message);
    if (message.length > 0) {
      environment.output.write(renderMessage(message));
      return 0;
    }
  } else if (environment.input.isTTY !== true) {
    const message = await readStandardInput(environment.input);
    if (message.length > 0) {
      environment.output.write(renderMessage(message));
      return 0;
    }
  }

  environment.error.write(NO_INPUT_MESSAGE);
  return 1;
}
