#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";

function run(command, args, extraEnv = {}) {
  const bin = path.join(process.cwd(), "node_modules", ".bin");
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: {
      ...process.env,
      ELECTRON_BUILD: "1",
      PATH: `${bin}${path.delimiter}${process.env.PATH ?? ""}`,
      ...extraEnv,
    },
    shell: process.platform === "win32",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

process.env.ELECTRON_BUILD = "1";
run("npm", ["run", "build"]);

const output = path.join(process.cwd(), ".output");
if (!existsSync(output)) {
  console.error("Electron pack: vite build did not produce .output/");
  process.exit(1);
}

const pgliteDist = path.join(process.cwd(), "node_modules", "@electric-sql", "pglite", "dist");
const libs = path.join(output, "server", "_libs");
mkdirSync(libs, { recursive: true });
for (const file of ["pglite.data", "pglite.wasm", "initdb.wasm"]) {
  const from = path.join(pgliteDist, file);
  if (!existsSync(from)) {
    console.warn(`Electron pack: missing ${from}`);
    continue;
  }
  copyFileSync(from, path.join(libs, file));
}

const builderArgs = ["electron-builder", "--config", "electron-builder.yml", "--publish", "never"];
if (process.argv.includes("--win") || process.platform === "win32") {
  builderArgs.push("--win", "nsis");
} else if (process.argv.includes("--dir")) {
  builderArgs.push("--dir");
}
run("npx", builderArgs);
