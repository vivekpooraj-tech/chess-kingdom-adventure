const https = require("https");

function get(url, headers = {}) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "user-agent": "Mozilla/5.0", accept: "application/json", ...headers } }, (res) => {
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: d }));
      })
      .on("error", reject);
  });
}

(async () => {
  for (const [label, url, extra] of [
    ["pricing-in", "https://www.chessmind.club/api/pricing", { "x-vercel-ip-country": "IN" }],
    ["pricing-us", "https://www.chessmind.club/api/pricing", { "x-vercel-ip-country": "US" }],
    ["school-in", "https://www.chessmind.club/api/pricing/school", { "x-vercel-ip-country": "IN" }],
    ["school-us", "https://www.chessmind.club/api/pricing/school", { "x-vercel-ip-country": "US" }],
    ["home", "https://www.chessmind.club/", {}],
  ]) {
    const r = await get(url, extra);
    console.log("====", label, r.status, r.headers["content-type"], r.headers["x-vercel-id"]);
    console.log(r.body.slice(0, 500));
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
