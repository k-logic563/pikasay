import type { Mood } from "./options.js";

// Constructors keep the ESC control character out of the source code while
// allowing ANSI CSI sequences to be recognized as zero-width tokens.
// biome-ignore lint/complexity/useRegexLiterals: see above
const ANSI_PATTERN = new RegExp("\\x1B\\[[0-?]*[ -/]*[@-~]", "gu");
// biome-ignore lint/complexity/useRegexLiterals: see above
const ANSI_TOKEN_PATTERN = new RegExp("\\x1B\\[[0-?]*[ -/]*[@-~]", "y");
const CONTROL_PATTERN = /[\p{Cc}\p{Cf}]/u;
const MARK_PATTERN = /\p{Mark}/u;
const EMOJI_PATTERN =
  /\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20e3/u;
const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

const DEFAULT_COLUMNS = 80;
const MESSAGE_INDENT = "  ";

interface MoodAppearance {
  readonly face: string;
  readonly call: string;
  readonly color: number;
}

const APPEARANCES: Record<Mood, MoodAppearance> = {
  normal: { face: "•ᴗ•", call: "ぴ。", color: 36 },
  success: { face: "^ᴗ^", call: "ぴ！", color: 32 },
  warning: { face: "•︵•", call: "ぴぃ…", color: 33 },
  error: { face: ">︵<", call: "ぴぎゃー！", color: 31 },
};

export const PIKA_ASCII_ART = String.raw`   /\_/\
  ( •ᴗ• )
  / >🍃`;

export interface RenderOptions {
  readonly mood?: Mood;
  readonly color?: boolean;
  readonly columns?: number | undefined;
}

interface DisplayToken {
  readonly value: string;
  readonly width: number;
}

function isFullwidthCodePoint(codePoint: number): boolean {
  return (
    codePoint >= 0x1100 &&
    (codePoint <= 0x115f ||
      codePoint === 0x2329 ||
      codePoint === 0x232a ||
      (codePoint >= 0x2e80 && codePoint <= 0xa4cf && codePoint !== 0x303f) ||
      (codePoint >= 0xac00 && codePoint <= 0xd7a3) ||
      (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
      (codePoint >= 0xfe10 && codePoint <= 0xfe19) ||
      (codePoint >= 0xfe30 && codePoint <= 0xfe6f) ||
      (codePoint >= 0xff00 && codePoint <= 0xff60) ||
      (codePoint >= 0xffe0 && codePoint <= 0xffe6) ||
      (codePoint >= 0x20000 && codePoint <= 0x3fffd))
  );
}

function graphemeWidth(grapheme: string): number {
  if (EMOJI_PATTERN.test(grapheme)) {
    return 2;
  }

  let width = 0;
  for (const character of grapheme) {
    if (MARK_PATTERN.test(character) || CONTROL_PATTERN.test(character)) {
      continue;
    }
    const codePoint = character.codePointAt(0);
    if (codePoint !== undefined) {
      width = Math.max(width, isFullwidthCodePoint(codePoint) ? 2 : 1);
    }
  }
  return width;
}

function tokenize(value: string): DisplayToken[] {
  const tokens: DisplayToken[] = [];
  let plainTextStart = 0;
  let index = 0;

  const appendPlainText = (text: string): void => {
    for (const item of segmenter.segment(text)) {
      tokens.push({ value: item.segment, width: graphemeWidth(item.segment) });
    }
  };

  while (index < value.length) {
    ANSI_TOKEN_PATTERN.lastIndex = index;
    const match = ANSI_TOKEN_PATTERN.exec(value);
    if (match === null) {
      index += 1;
      continue;
    }
    appendPlainText(value.slice(plainTextStart, index));
    tokens.push({ value: match[0], width: 0 });
    index = ANSI_TOKEN_PATTERN.lastIndex;
    plainTextStart = index;
  }
  appendPlainText(value.slice(plainTextStart));
  return tokens;
}

export function displayWidth(value: string): number {
  const withoutAnsi = value.replace(ANSI_PATTERN, "");
  let width = 0;
  for (const item of segmenter.segment(withoutAnsi)) {
    width += graphemeWidth(item.segment);
  }
  return width;
}

export function wrapText(value: string, maximumWidth: number): string[] {
  const safeWidth = Math.max(1, Math.floor(maximumWidth) || 1);
  const sourceLines = value.split(/\r\n|\r|\n/u);
  const result: string[] = [];

  for (const sourceLine of sourceLines) {
    const tokens = tokenize(sourceLine);
    if (tokens.length === 0) {
      result.push("");
      continue;
    }

    let line = "";
    let lineWidth = 0;
    for (const token of tokens) {
      if (
        token.width > 0 &&
        lineWidth > 0 &&
        lineWidth + token.width > safeWidth
      ) {
        result.push(line);
        line = "";
        lineWidth = 0;
      }
      line += token.value;
      lineWidth += token.width;
    }
    result.push(line);
  }

  return result;
}

function terminalColumns(columns: number | undefined): number {
  if (columns === undefined || !Number.isFinite(columns) || columns <= 0) {
    return DEFAULT_COLUMNS;
  }
  return Math.max(1, Math.floor(columns));
}

export function renderMessage(
  message: string,
  options: RenderOptions = {},
): string {
  const mood = options.mood ?? "normal";
  const appearance = APPEARANCES[mood];
  const columns = terminalColumns(options.columns);
  const indent = columns > MESSAGE_INDENT.length ? MESSAGE_INDENT : "";
  const messageWidth = Math.max(1, columns - displayWidth(indent));
  const messageLines = wrapText(message, messageWidth);
  const art = String.raw`   /\_/\
  ( ${appearance.face} )  ${appearance.call}
  / >🍃`;
  const decoratedArt = options.color
    ? `\u001B[${appearance.color}m${art}\u001B[0m`
    : art;
  const renderedMessage = messageLines
    .map((line) => `${indent}${line}`)
    .join("\n");

  return `${decoratedArt}\n\n${renderedMessage}\n`;
}
