#!/usr/bin/env node

import { createRequire } from "node:module";
import { runCli } from "./app.js";

interface PackageJson {
  readonly version: string;
}

const require = createRequire(import.meta.url);
const packageJson = require("../package.json") as PackageJson;

try {
  process.exitCode = await runCli({
    args: process.argv.slice(2),
    input: process.stdin,
    output: process.stdout,
    error: process.stderr,
    version: packageJson.version,
    noColorEnvironment: Object.hasOwn(process.env, "NO_COLOR"),
  });
} catch {
  process.stderr.write("pikasay: 入力の読み取りに失敗しました。\n");
  process.exitCode = 1;
}
