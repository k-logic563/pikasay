import { Buffer } from "node:buffer";

export interface InputStream extends AsyncIterable<string | Uint8Array> {
  readonly isTTY?: boolean;
}

export function trimTrailingLineBreaks(input: string): string {
  return input.replace(/(?:\r\n|\r|\n)+$/u, "");
}

export async function readStandardInput(input: InputStream): Promise<string> {
  const chunks: Uint8Array[] = [];

  for await (const chunk of input) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  return trimTrailingLineBreaks(Buffer.concat(chunks).toString("utf8"));
}
