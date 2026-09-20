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
  // Phase 1と同じく、help/versionは指定位置にかかわらず優先する。
  if (args.includes("-h") || args.includes("--help")) {
    return { kind: "help" };
  }

  if (args.includes("-v") || args.includes("--version")) {
    return { kind: "version" };
  }

  let mood: Mood = "normal";
  let noColor = false;
  const messageParts: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === "--no-color") {
      noColor = true;
      continue;
    }

    if (argument === "--mood") {
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

    if (argument !== undefined) {
      messageParts.push(argument);
    }
  }

  if (messageParts.length > 0) {
    return { kind: "message", message: messageParts.join(" "), mood, noColor };
  }

  return { kind: "none", mood, noColor };
}
