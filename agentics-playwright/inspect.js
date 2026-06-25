import { chromium } from "playwright";
import fs from "fs";

(async () => {
  const browser = await chromium.launch({
    headless: false,
    args: ["--start-maximized"]
  });

  const context = await browser.newContext({ viewport: null });
  const page = await context.newPage();

  console.log("Opening the Priority Connect contacts page...");
  await page.goto("https://p.priority-connect.online/portals/app/2/adm2024/contacts");

  console.log("Sign in with Microsoft SSO, then press ENTER in the terminal.");
  process.stdin.once("data", async () => {
    console.log("Dumping DOM...");

    const dom = await page.evaluate(() => document.body.innerHTML);

    fs.writeFileSync("orderpage-dom.html", dom);

    console.log("DOM saved as orderpage-dom.html. Keep this local; it is ignored by Git.");

    await browser.close();
    process.exit(0);
  });
})();
