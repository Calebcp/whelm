import { renameSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";

const rootDir = process.cwd();
const apiDir = path.join(rootDir, "app", "api");
const apiBackupDir = path.join(rootDir, ".cap-build-app-api");

function moveAppApiAway() {
  renameSync(apiDir, apiBackupDir);
}

function restoreAppApi() {
  renameSync(apiBackupDir, apiDir);
}

async function runBuild() {
  await new Promise((resolve, reject) => {
    const child = spawn(
      process.platform === "win32" ? "npm.cmd" : "npm",
      ["run", "build"],
      {
        cwd: rootDir,
        stdio: "inherit",
        env: {
          ...process.env,
          CAP_STATIC_EXPORT: "1",
        },
      },
    );

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Capacitor static export failed with exit code ${code ?? "unknown"}.`));
    });
    child.on("error", reject);
  });
}

async function main() {
  moveAppApiAway();
  try {
    await runBuild();
  } finally {
    restoreAppApi();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
