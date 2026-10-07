const fs = require("fs");
const file = process.argv[2];
const xml = fs.readFileSync(file, "utf8");
const texts = [...xml.matchAll(/text="([^"]+)"/g)].map((m) => m[1]).filter((t) => t.trim());
const descs = [...xml.matchAll(/content-desc="([^"]+)"/g)].map((m) => m[1]).filter((t) => t.trim());
console.log("TEXTS:");
console.log(texts.join("\n"));
console.log("DESCS:");
console.log(descs.join("\n"));
