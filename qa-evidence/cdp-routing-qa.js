const WebSocket = require("ws");
const http = require("http");
const fs = require("fs");

const email = "rajyam141502@gmail.com";
const password = "QaTest1234";
const readyChildId = "556bdac3-568c-45f2-ac64-6f41dbe8910a";
const port = Number(process.env.CDP_PORT || 9222);
const base = "http://localhost:3000";

function getPages() {
  return new Promise((resolve, reject) => {
    http
      .get(`http://127.0.0.1:${port}/json`, (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => resolve(JSON.parse(data)));
      })
      .on("error", reject);
  });
}

function cdp(wsUrl, fn) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let id = 0;
    const pending = new Map();
    ws.on("open", async () => {
      try {
        const result = await fn((method, params = {}) => {
          const msgId = ++id;
          return new Promise((res, rej) => {
            pending.set(msgId, { res, rej });
            ws.send(JSON.stringify({ id: msgId, method, params }));
          });
        });
        resolve(result);
      } catch (e) {
        reject(e);
      } finally {
        ws.close();
      }
    });
    ws.on("message", (raw) => {
      const msg = JSON.parse(raw);
      if (msg.id && pending.has(msg.id)) {
        const { res, rej } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) rej(new Error(msg.error.message));
        else res(msg.result);
      }
    });
    ws.on("error", reject);
  });
}

async function evalText(send, expr) {
  const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true });
  return r.result?.value ?? "";
}

async function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function ensureHome(send) {
  let url = await evalText(send, "location.href");
  if (!url.includes("/sign-in") && !url.includes("/kingdom-map")) {
    await send("Page.navigate", { url: `${base}/sign-in` });
    await wait(3000);
  }
  url = await evalText(send, "location.href");
  if (url.includes("/sign-in")) {
    await evalText(
      send,
      `(function(){const s=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;const e=document.querySelector('#email');const p=document.querySelector('#password');const b=document.querySelector('button[type=submit]');s.call(e,'${email}');e.dispatchEvent(new Event('input',{bubbles:true}));s.call(p,'${password}');p.dispatchEvent(new Event('input',{bubbles:true}));b.disabled=false;b.click();return 'ok';})()`
    );
    await wait(10000);
  }
  await evalText(
    send,
    `(function(){
      document.cookie = 'cka_active_child=; path=/; max-age=0; SameSite=Lax';
      document.cookie = 'cka_active_child=${readyChildId}; path=/; max-age=31536000; SameSite=Lax';
      return 'ok';
    })()`
  );
  await send("Page.navigate", { url: `${base}/kingdom-map` });
  for (let i = 0; i < 20; i++) {
    await wait(1000);
    const ready = await evalText(
      send,
      "document.body.innerText.includes('Chess Mind') || document.body.innerText.includes('What should we do')"
    );
    if (ready === true) break;
  }
  await evalText(send, "window.scrollTo(0, 0)");
  await wait(1000);
  url = await evalText(send, "location.href");
  const overlay = await evalText(send, "document.body.innerText.includes(\"Today's chess time is complete\")");
  return { url, screenTimeBlocked: overlay === true };
}

async function clickByText(send, text, tag = "a") {
  const expr = `(function(){
    const els = Array.from(document.querySelectorAll('${tag}, button'));
    const el = els.find(e => (e.innerText || e.textContent || '').trim().includes('${text.replace(/'/g, "\\'")}'));
    if (!el) return 'NOT_FOUND';
    el.click();
    return el.tagName + ':' + (el.getAttribute('href') || el.innerText.slice(0,40));
  })()`;
  return await evalText(send, expr);
}

async function clickHref(send, hrefPart) {
  return await evalText(
    send,
    `(function(){
      const el = document.querySelector('a[href*="${hrefPart}"]');
      if (!el) return 'NOT_FOUND';
      el.click();
      return el.getAttribute('href');
    })()`
  );
}

async function navigateAndCheck(send, label, action, expectPath) {
  const home = await ensureHome(send);
  if (home.screenTimeBlocked) {
    return { label, skipped: true, reason: "screen_time_blocked" };
  }
  const clickResult = await action(send);
  await wait(5000);
  const url = await evalText(send, "location.href");
  const body = await evalText(send, "document.body.innerText.slice(0,500)");
  const pass = expectPath ? url.includes(expectPath) : true;
  return { label, clickResult, url, pass, bodySnippet: body };
}

(async () => {
  const pages = await getPages();
  const page = pages.find((p) => p.type === "page");
  if (!page) throw new Error("NO_PAGE");

  const report = await cdp(page.webSocketDebuggerUrl, async (send) => {
    await send("Page.enable");
    await send("Runtime.enable");

    const home = await ensureHome(send);
    const bodyText = await evalText(send, "document.body.innerText");
    const dims = {
      scrollWidth: await evalText(send, "document.documentElement.scrollWidth"),
      clientWidth: await evalText(send, "document.documentElement.clientWidth"),
      scrollHeight: await evalText(send, "document.documentElement.scrollHeight"),
      clientHeight: await evalText(send, "document.documentElement.clientHeight"),
    };

    const homeChecks = {
      url: home.url,
      screenTimeBlocked: home.screenTimeBlocked,
      hasChessMindTitle: /Chess Mind/i.test(bodyText),
      hasPlay: /\bPlay\b/.test(bodyText),
      hasPuzzles: /\bPuzzles\b/.test(bodyText),
      hasWorld: /\bWorld\b/.test(bodyText),
      hasLearn: /\bLearn\b/.test(bodyText),
      hasToday: /\bTODAY\b/i.test(bodyText),
      hasDiscover: /\bDISCOVER\b/i.test(bodyText),
      hasTrainYourMind: /Train Your Mind/i.test(bodyText),
      hasProgress: /Your Progress/i.test(bodyText),
      hasAchievements: /Achievements/i.test(bodyText),
      hasSeeAll: /See all/i.test(bodyText),
      hasForParents: /For Parents/i.test(bodyText),
      hasOllie: /Ollie|🦉/i.test(bodyText),
      hasChessSchool: /Chess School/i.test(bodyText),
      heroTwoColumn: Number(dims.clientWidth) >= 768,
      ...dims,
    };

    const routes = [];
    const routeTests = [
      { label: "Play tile", fn: (s) => clickByText(s, "Play", "a"), expect: "/play" },
      { label: "Puzzles tile", fn: (s) => clickByText(s, "Puzzles", "a"), expect: "/puzzles" },
      { label: "World tile", fn: (s) => clickByText(s, "World", "a"), expect: "/world" },
      { label: "Learn tile", fn: (s) => clickHref(s, "/learn"), expect: "/learn" },
      { label: "Train Your Mind", fn: (s) => clickByText(s, "Train Your Mind"), expect: "/chess-mind" },
      { label: "Chess School Start", fn: (s) => clickByText(s, "Start Session 1"), expect: "/chess-school" },
      { label: "Profile strip", fn: (s) => clickHref(s, "/profile"), expect: "/profile" },
      { label: "For Parents", fn: (s) => clickByText(s, "For Parents"), expect: "/parent" },
      { label: "Achievements See all", fn: (s) => clickByText(s, "See all"), expect: "achievement" },
    ];

    for (const t of routeTests) {
      const r = await navigateAndCheck(send, t.label, t.fn, t.expect);
      routes.push(r);
      await send("Page.navigate", { url: `${base}/kingdom-map` });
      await wait(4000);
    }

    // Chess School Lesson 1 piece intro check
    await send("Page.navigate", { url: `${base}/chess-school` });
    await wait(6000);
    let schoolUrl = await evalText(send, "location.href");
    let schoolBody = await evalText(send, "document.body.innerText");
    const startClick = await clickByText(send, "Start Session 1");
    await wait(8000);
    schoolUrl = await evalText(send, "location.href");
    schoolBody = await evalText(send, "document.body.innerText");
    const pieces = ["Pawn", "Rook", "Knight", "Bishop", "Queen", "King"];
    const pieceFound = pieces.filter((p) => schoolBody.includes(p));

    return { homeChecks, routes, school: { startClick, schoolUrl, pieceFound, bodySnippet: schoolBody.slice(0, 800) } };
  });

  const outFile = process.env.QA_REPORT_FILE;
  if (outFile) fs.writeFileSync(outFile, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
})().catch((err) => {
  console.error("ERR", err.message);
  process.exit(1);
});
