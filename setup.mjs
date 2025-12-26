#!/usr/bin/env node
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const args = new Set(process.argv.slice(2));
const shouldTypecheck = !args.has("--no-typecheck");
const installOnly = args.has("--install-only");

const log = (message) => console.log(`[setup] ${message}`);

const run = (command, commandArgs, options = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, {
      cwd: projectRoot,
      stdio: "inherit",
      ...options
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${commandArgs.join(" ")} exited with ${code}`));
    });
  });

const ensureNodeVersion = () => {
  const [major] = process.versions.node.split(".").map((n) => Number(n));
  if (!Number.isFinite(major) || major < 18) {
    throw new Error(
      `Node.js 版本过低：${process.versions.node}（需要 >= 18）。`
    );
  }
};

const fileExists = async (filePath) => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

const main = async () => {
  ensureNodeVersion();

  const isWindows = process.platform === "win32";
  const runNpm = async (npmArgs) => {
    if (!Array.isArray(npmArgs) || npmArgs.some((arg) => typeof arg !== "string")) {
      throw new Error("内部错误：npm 参数不合法。");
    }

    if (!isWindows) {
      await run("npm", npmArgs);
      return;
    }

    const comSpec = process.env.ComSpec || "cmd.exe";
    const commandLine = `npm.cmd ${npmArgs.join(" ")}`;
    await run(comSpec, ["/d", "/s", "/c", commandLine]);
  };

  const lockExists = await fileExists(path.join(projectRoot, "package-lock.json"));
  log(`安装依赖（${lockExists ? "npm ci" : "npm install"}）...`);
  await runNpm(lockExists ? ["ci"] : ["install"]);

  const envLocalPath = path.join(projectRoot, ".env.local");
  const envExamplePath = path.join(projectRoot, ".env.example");

  const envLocalExists = await fileExists(envLocalPath);
  if (!envLocalExists) {
    const exampleExists = await fileExists(envExamplePath);
    if (exampleExists) {
      log("创建 .env.local（从 .env.example 复制）...");
      await fs.copyFile(envExamplePath, envLocalPath);
      log("已生成 .env.local：请填入 ZHIPU_TEXT_API_KEY 与 ZHIPU_IMAGE_API_KEY。");
    } else {
      log("未找到 .env.example，跳过 .env.local 生成。");
    }
  } else {
    log(".env.local 已存在，跳过生成。");
  }

  if (installOnly) {
    log("完成（install-only）。");
    return;
  }

  if (shouldTypecheck) {
    log("类型检查（前端）...");
    await runNpm(["run", "typecheck"]);
    log("类型检查（服务端）...");
    await runNpm(["run", "typecheck:server"]);
  }

  log("完成。下一步：npm run dev（PowerShell 可用 npm.cmd run dev）");
};

main().catch((error) => {
  console.error("[setup] 失败：", error instanceof Error ? error.message : error);
  process.exit(1);
});
