import { chromium } from "playwright";
import fs from "fs";

(async () => {
  const browser = await chromium.launch({
    headless: false,
    args: ["--start-maximized"]
  });

  const context = await browser.newContext({ viewport: null });
  const page = await context.newPage();

  console.log("Step 1: sign in with Microsoft SSO.");
  await page.goto("https://p.priority-connect.online/portals/app/2/adm2024/contacts", {
    waitUntil: "networkidle"
  });

  console.log(">>> Complete SSO + MFA and manually navigate to the order page.");
  console.log(">>> Press ENTER in this PowerShell window to dump the DOM.");

  process.stdin.once("data", async () => {
    console.log("Step 2: dumping DOM...");

    const dom = await page.evaluate(() => document.documentElement.outerHTML);

    fs.writeFileSync("orderpage-dom.html", dom);

    console.log("Done: orderpage-dom.html saved locally and ignored by Git.");
    await browser.close();
    process.exit(0);
  });
})();
