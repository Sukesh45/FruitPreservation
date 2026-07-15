import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

console.log("=================================================");
console.log(" STARTING VITE DEV SERVER & PRESERVATION DAEMON  ");
console.log("=================================================");

// Start Vite
const viteProcess = spawn("npx", ["vite"], {
  cwd: rootDir,
  shell: true,
  stdio: "inherit"
});

// Start Daemon
const daemonProcess = spawn("node", ["daemon/index.js"], {
  cwd: rootDir,
  shell: true,
  stdio: "inherit"
});

// Handle graceful exit
process.on("SIGINT", () => {
  viteProcess.kill("SIGINT");
  daemonProcess.kill("SIGINT");
  process.exit(0);
});

process.on("exit", () => {
  viteProcess.kill();
  daemonProcess.kill();
});
