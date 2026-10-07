// Paste-able Runtime.evaluate body: measures pages at several widths in same-origin iframes.
(async () => {
  const pages = (window.__QA_PAGES || [
    "/kingdom-map?world=enchanted", "/kingdom-map?world=atelier", "/kingdom-map?world=classic",
    "/free-play?world=enchanted", "/free-play?world=atelier", "/free-play?world=classic",
    "/puzzles?world=enchanted", "/puzzles?world=atelier", "/puzzles?world=classic",
    "/chess-school/classroom?world=enchanted", "/chess-school/classroom?world=atelier", "/chess-school/classroom?world=classic",
  ]);
  const widths = window.__QA_WIDTHS || [390, 411, 430, 800];
  const H = { 390: 844, 411: 914, 430: 932, 800: 1309 };
  const out = [];
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  for (const url of pages) {
    for (const w of widths) {
      const f = document.createElement("iframe");
      f.style.cssText = `position:fixed;left:0;top:0;width:${w}px;height:${H[w] || 900}px;border:0;opacity:0.01;z-index:-1`;
      f.src = url;
      document.body.appendChild(f);
      await new Promise((r) => f.addEventListener("load", r, { once: true }));
      const d = f.contentDocument;
      const win = f.contentWindow;
      const t0 = Date.now();
      while (Date.now() - t0 < 15000) {
        const txt = d.body ? d.body.innerText : "";
        if (d.querySelector("[data-world]") && !/Loading your classroom|Loading…$/.test(txt) && txt.length > 200) break;
        await wait(300);
      }
      await wait(1200);
      const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden"; };
      const worlds = [...d.querySelectorAll("[data-world]")].map((e) => e.getAttribute("data-world"));
      const pill = [...d.querySelectorAll(".phone-utility-icons")].find(vis);
      const pr = pill ? pill.getBoundingClientRect() : null;
      const collide = [];
      if (pr) {
        for (const el of d.querySelectorAll("h1,h2,p,a,button,[role=button]")) {
          if (pill.contains(el) || el.closest(".fixed") || !vis(el)) continue;
          const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
          if (!hasText && !/^(A|BUTTON)$/.test(el.tagName)) continue;
          const r = el.getBoundingClientRect();
          if (r.right > pr.left + 1 && r.left < pr.right - 1 && r.bottom > pr.top + 1 && r.top < pr.bottom - 1) {
            collide.push(`${el.tagName}:${(el.textContent || "").trim().slice(0, 30)}`);
          }
          if (collide.length >= 3) break;
        }
      }
      const a8 = d.querySelector('button[aria-label^="a8"]');
      const h1 = d.querySelector('button[aria-label^="h1"]');
      const board = a8 && h1 ? { l: Math.round(a8.getBoundingClientRect().left), r: Math.round(h1.getBoundingClientRect().right), b: Math.round(h1.getBoundingClientRect().bottom) } : null;
      const ctas = [...d.querySelectorAll(".world-cta, main a[class*='btn'], main button")].filter(vis)
        .map((e) => ({ t: (e.textContent || "").replace(/\s+/g, " ").trim().slice(0, 28), h: Math.round(e.getBoundingClientRect().height) }))
        .filter((c) => c.t.length > 2);
      const nav = [...d.querySelectorAll("nav[aria-label=Primary] a")].filter(vis).length;
      out.push({
        url, w,
        layout: d.documentElement.getAttribute("data-layout"),
        world: worlds[0] || null,
        mixed: new Set(worlds).size > 1,
        ov: d.documentElement.scrollWidth - d.documentElement.clientWidth,
        board,
        boardClipped: board ? board.l < 0 || board.r > w : null,
        pill: pr ? [Math.round(pr.left), Math.round(pr.top), Math.round(pr.right), Math.round(pr.bottom)] : null,
        collide,
        smallCta: ctas.filter((c) => c.h < 44).slice(0, 4),
        primaryCta: ctas.find((c) => /Continue|Start|Solve|Play|Unlock|Lifetime|Begin|Next|Enter/i.test(c.t)) || null,
        nav,
        leak: {
          schPath: !!d.querySelector(".sch-path"), schAcademy: !!d.querySelector(".sch-academy"), schStudy: !!d.querySelector(".sch-study"),
          pzGrid: !!d.querySelector(".pz-grid"), pzPath: !!d.querySelector(".pz-path"), pzSheet: !!d.querySelector(".pz-meta--classic"),
        },
        err: /Application error|Unhandled Runtime Error|Hydration failed|did not match/i.test(d.body ? d.body.innerText : ""),
      });
      f.remove();
    }
  }
  return out;
})()
