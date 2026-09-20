export const MOODS = ["normal", "success", "warning", "error"] as const;

export type Mood = (typeof MOODS)[number];

interface DisplayOptions {
  readonly mood: Mood;
  readonly noColor: boolean;
}

export type ParsedArguments =
  | { kind: "help" }
  | { kind: "version" }
  | ({ kind: "message"; message: string } & DisplayOptions)
  | ({ kind: "none" } & DisplayOptions)
  | { kind: "error"; message: string };

function isMood(value: string): value is Mood {
  return MOODS.some((mood) => mood === value);
}

export function parseArguments(args: readonly string[]): ParsedArguments {
  // Help/version take priority wherever they appear before `--`. Arguments
  // after the delimiter are always message text.
  const delimiterIndex = args.indexOf("--");
  const optionArgs =
    delimiterIndex === -1 ? args : args.slice(0, delimiterIndex);
  if (optionArgs.includes("-h") || optionArgs.includes("--help")) {
    return { kind: "help" };
  }

  if (optionArgs.includes("-v") || optionArgs.includes("--version")) {
    return { kind: "version" };
  }

  let mood: Mood = "normal";
  let noColor = false;
  const messageParts: string[] = [];
  let optionsEnded = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (!optionsEnded && argument === "--") {
      optionsEnded = true;
      continue;
    }

    if (!optionsEnded && argument === "--no-color") {
      noColor = true;
      continue;
    }

    if (!optionsEnded && argument === "--mood") {
      const value = args[index + 1];
      if (value === undefined || !isMood(value)) {
        const received =
          value === undefined ? "値がありません" : `「${value}」`;
        return {
          kind: "error",
          message: `pikasay: --mood の値 ${received} は使用できません。利用可能なモード: ${MOODS.join(", ")}\n`,
        };
      }
      mood = value;
      index += 1;
      continue;
    }

    if (!optionsEnded && argument?.startsWith("-")) {
      return {
        kind: "error",
        message: `pikasay: 不明なオプションです: ${argument}\n詳しくは pikasay --help を実行してください。\n`,
      };
    }

    if (argument !== undefined) {
      messageParts.push(argument);
    }
  }

  if (messageParts.length > 0) {
    return { kind: "message", message: messageParts.join(" "), mood, noColor };
  }

  return { kind: "none", mood, noColor };
}
