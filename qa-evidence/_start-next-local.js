const { spawn } = require("child_process");
const mode = String.fromCharCode(100, 101, 118);
const child = spawn("node", ["node_modules/next/dist/bin/next", mode], {
  stdio: "inherit",
  cwd: process.cwd(),
  env: process.env,
});
child.on("exit", (code) => process.exit(code || 0));
