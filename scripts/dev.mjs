import { spawn, spawnSync } from "node:child_process";
import { copyFileSync, constants, existsSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const root = fileURLToPath(new URL("../", import.meta.url));
const backend = path.join(root, "backend");
const frontend = path.join(root, "frontend");
const windows = process.platform === "win32";
const python = path.join(backend, "venv", windows ? "Scripts/python.exe" : "bin/python");
const next = path.join(frontend, "node_modules/next/dist/bin/next");
const children = [];
let stopping = false;


function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.exitCode !== null || !child.pid) continue;
    if (windows) {
      // Next.js owns a worker process; stop only the trees started here.
      spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    } else {
      process.kill(-child.pid, "SIGTERM");
    }
  }
  process.exitCode = code;
}

process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());

function runPython(args) {
  const result = spawnSync(python, args, { cwd: backend, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Backend setup failed (${args[0]}).`);
}

function ensurePort(port) {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", () => reject(new Error(
      `Port ${port} is already in use. Stop the existing local server before running npm run dev.`,
    )));
    probe.listen(port, "127.0.0.1", () => probe.close(resolve));
  });
}

function start(command, args, cwd, env) {
  const child = spawn(command, args, { cwd, env, stdio: "inherit", detached: !windows });
  children.push(child);
  child.once("error", (error) => {
    console.error(error.message);
    stop(1);
  });
  child.once("exit", (code, signal) => {
    if (!stopping) {
      console.error(`Local server stopped (${signal || code}). Restart with npm run dev.`);
      stop(code || 1);
    }
  });
  return child;
}

async function main() {
  if (!existsSync(python)) {
    throw new Error("Create the backend environment first: cd backend && python -m venv venv && venv/bin/pip install -r requirements.txt");
  }
  if (!existsSync(next)) {
    throw new Error("Frontend dependencies are missing. Run npm ci --prefix frontend first.");
  }
  await Promise.all([ensurePort(7860), ensurePort(3000)]);

  // Never overwrite existing env files.
  for (const [dir, name, example] of [[backend, ".env", ".env.example"], [frontend, ".env.local", ".env.local.example"]]) {
    if (!existsSync(path.join(dir, name))) {
      copyFileSync(path.join(dir, example), path.join(dir, name), constants.COPYFILE_EXCL);
    }
  }

  runPython(["manage.py", "check"]);
  runPython(["manage.py", "migrate", "--noinput"]);
  // Never reseed an existing database: its accounts, classes and grades remain.
  runPython(["manage.py", "shell", "-c",
    "from apps.accounts.models import Profile; from django.core.management import call_command; " +
    "call_command('seed_demo_data') if not Profile.objects.exists() else None",
  ]);
  const api = start(python, ["manage.py", "runserver", "127.0.0.1:7860", "--noreload"], backend, process.env);
  let ready = false;
  for (let attempt = 0; attempt < 80 && !stopping; attempt++) {
    try {
      const response = await fetch("http://127.0.0.1:7860/health", { signal: AbortSignal.timeout(1000) });
      ready = response.ok && (await response.json()).status === "ok";
      if (ready) break;
    } catch { /* The backend is still starting. */ }
    if (api.exitCode !== null) break;
    await delay(250);
  }
  if (stopping) return;
  if (!ready) throw new Error("Django did not become ready on port 7860. Check the backend output above.");

  start(process.execPath, [next, "dev", "--port", "3000", "--hostname", "127.0.0.1"], frontend, {
    ...process.env,
    NEXT_PUBLIC_BACKEND_URL: "http://127.0.0.1:7860",
  });
  console.log("\nThinkPath: http://localhost:3000 — frontend and backend start together. Ctrl+C stops both.");
}

main().catch((error) => {
  console.error(error.message);
  stop(1);
});
