const CDP = require("chrome-remote-interface");

const email = "rajyam141502@gmail.com";
const password = "QaTest1234";
const port = Number(process.env.CDP_PORT || 9222);
const target = process.env.CDP_TARGET;

async function getTargetId() {
  if (target) return target;
  const res = await fetch(`http://127.0.0.1:${port}/json`);
  const pages = await res.json();
  const page = pages.find((p) => p.type === "page");
  if (!page) throw new Error("NO_CDP_PAGE");
  return page.id;
}

getTargetId()
  .then((id) => CDP({ port, target: id }, run))
  .catch((err) => {
    console.error("CDP_ERR", err.message);
    process.exit(1);
  });

async function run(client) {
  const { Page, Runtime } = client;
  try {
    await Page.enable();
    await Runtime.enable();
    await Page.navigate({ url: "http://localhost:3000/sign-in" });
    await Page.loadEventFired();
    await new Promise((r) => setTimeout(r, 2500));
    const submit = await Runtime.evaluate({
      expression: `
        (function() {
          const emailEl = document.querySelector('#email');
          const passwordEl = document.querySelector('#password');
          const btn = document.querySelector('button[type="submit"]');
          if (!emailEl || !passwordEl || !btn) return 'MISSING_ELEMENTS';
          emailEl.value = ${JSON.stringify(email)};
          emailEl.dispatchEvent(new Event('input', { bubbles: true }));
          emailEl.dispatchEvent(new Event('change', { bubbles: true }));
          passwordEl.value = ${JSON.stringify(password)};
          passwordEl.dispatchEvent(new Event('input', { bubbles: true }));
          passwordEl.dispatchEvent(new Event('change', { bubbles: true }));
          btn.disabled = false;
          btn.click();
          return 'SUBMITTED';
        })()
      `,
      returnByValue: true,
    });
    console.log("SUBMIT", submit.result.value);
    await new Promise((r) => setTimeout(r, 12000));
    const url = await Runtime.evaluate({
      expression: "window.location.href",
      returnByValue: true,
    });
    console.log("URL", url.result.value);
    const title = await Runtime.evaluate({
      expression: "document.title + ' | ' + (document.querySelector('h1')?.textContent || '')",
      returnByValue: true,
    });
    console.log("TITLE", title.result.value);
  } catch (err) {
    console.error("CDP_ERR", err.message);
    process.exitCode = 1;
  } finally {
    await client.close();
  }
}
