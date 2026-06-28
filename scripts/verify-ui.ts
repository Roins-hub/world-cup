import { chromium } from "playwright";

const url = process.env.UI_URL || "http://localhost:5173";
const apiUrl = process.env.UI_API_URL;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 980 } });

if (apiUrl) {
  await page.route("**/api/**", async (route) => {
    const sourceUrl = new URL(route.request().url());
    const targetUrl = new URL(`${sourceUrl.pathname}${sourceUrl.search}`, apiUrl);
    const headers = { ...route.request().headers() };
    delete headers.host;
    const method = route.request().method();
    const response = await fetch(targetUrl, {
      method,
      headers,
      body: method === "GET" || method === "HEAD" ? undefined : route.request().postData()
    });
    const responseHeaders = Object.fromEntries(response.headers.entries());
    delete responseHeaders["content-encoding"];
    delete responseHeaders["content-length"];
    await route.fulfill({
      status: response.status,
      headers: responseHeaders,
      body: Buffer.from(await response.arrayBuffer())
    });
  });
}

await page.goto(url, { waitUntil: "networkidle" });
await page.screenshot({ path: "runs/ui-empty-desktop.png" });
await page.getByRole("button", { name: /生成选题/ }).click();
await page.waitForSelector(".execution-rail.running", { timeout: 5000 }).catch(() => undefined);
await page.screenshot({ path: "runs/ui-loading-desktop.png" });
await page.waitForSelector(".topic-card", { timeout: 120000 });
await page.locator(".topic-card").first().click();
await page.waitForSelector(".script-row", { timeout: 20000 });
await page.waitForTimeout(800);
await page.evaluate(() => window.scrollTo(0, 0));
await page.screenshot({ path: "runs/ui-desktop.png" });
await page.setViewportSize({ width: 390, height: 900 });
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(500);
await page.screenshot({ path: "runs/ui-mobile.png" });
const title = await page.locator("h1").innerText();
const firstTopic = await page.locator(".topic-card strong").first().innerText();
const buttonCount = await page.locator("button").count();
await browser.close();

console.log(
  JSON.stringify(
    {
      ok: true,
      title,
      firstTopic,
      buttonCount,
      screenshots: ["runs/ui-empty-desktop.png", "runs/ui-loading-desktop.png", "runs/ui-desktop.png", "runs/ui-mobile.png"]
    },
    null,
    2
  )
);
