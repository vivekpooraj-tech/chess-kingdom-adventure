const https = require("https");
function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "user-agent": "Mozilla/5.0" } }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode, loc: res.headers.location, body: Buffer.concat(chunks).toString("utf8") }));
    }).on("error", reject);
  });
}
(async () => {
  const html = await get("https://www.chessmind.club/sign-in");
  const scripts = [...html.body.matchAll(/\/_next\/static\/[^"']+\.js/g)].map((m) => m[0]);
  const uniq = [...new Set(scripts)];
  console.log("scripts", uniq.length);
  const hits = [];
  for (const s of uniq.slice(0, 40)) {
    const r = await get("https://www.chessmind.club" + s);
    const needles = ["Classic Pro", "Championship Match Chamber", "Classical Chess Study Program", "Master Training Atelier", "Enchanted Kingdom", "34900", "799", "19900", "399"];
    const found = needles.filter((n) => r.body.includes(n));
    if (found.length) hits.push({ s, found, len: r.body.length });
  }
  console.log(JSON.stringify(hits, null, 2));
})().catch((e) => { console.error(e); process.exit(1); });
