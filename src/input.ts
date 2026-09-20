import { Buffer } from "node:buffer";

// pikasay is a short-message CLI. 64 KiB leaves ample room for long, multiline
// messages while bounding memory use when data is piped accidentally.
export const MAX_INPUT_BYTES = 64 * 1024;

export class InputTooLongError extends Error {
  constructor() {
    super(`入力が長すぎます（上限: ${MAX_INPUT_BYTES} bytes）。`);
    this.name = "InputTooLongError";
  }
}

export interface InputStream extends AsyncIterable<string | Uint8Array> {
  readonly isTTY?: boolean;
}

export function trimTrailingLineBreaks(input: string): string {
  return input.replace(/(?:\r\n|\r|\n)+$/u, "");
}

export function ensureInputWithinLimit(input: string): void {
  if (Buffer.byteLength(input, "utf8") > MAX_INPUT_BYTES) {
    throw new InputTooLongError();
  }
}

export async function readStandardInput(input: InputStream): Promise<string> {
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  for await (const chunk of input) {
    const bytes = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
    totalBytes += bytes.byteLength;
    if (totalBytes > MAX_INPUT_BYTES) {
      throw new InputTooLongError();
    }
    chunks.push(bytes);
  }

  return trimTrailingLineBreaks(Buffer.concat(chunks).toString("utf8"));
}
