export type ParsedArguments =
  | { kind: "help" }
  | { kind: "version" }
  | { kind: "message"; message: string }
  | { kind: "none" };

export function parseArguments(args: readonly string[]): ParsedArguments {
  if (args.includes("-h") || args.includes("--help")) {
    return { kind: "help" };
  }

  if (args.includes("-v") || args.includes("--version")) {
    return { kind: "version" };
  }

  if (args.length > 0) {
    return { kind: "message", message: args.join(" ") };
  }

  return { kind: "none" };
}
