import { chromium } from "playwright";

export async function insertOrder(order) {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto("https://p.priority-connect.online/portals/app/2/adm2024/contacts");

  // TODO: login + order entry selectors invullen zodra DOM bekend is

  await browser.close();

  return {
    status: "pending",
    message: "Order-entry flow wordt gebouwd zodra DOM bekend is."
  };
}
