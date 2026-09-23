import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

await mkdir('research/raw', { recursive: true });
const context = await chromium.launchPersistentContext('research/.browser-profile', {
  headless: process.env.HEADLESS === '1', viewport: { width: 1280, height: 900 },
});
const page = await context.newPage();
const responseSummary = [];
page.on('response', async response => {
  if (response.url().includes('tiktok.com/api/')) {
    const path = new URL(response.url()).pathname;
    let data;
    try { data = await response.json(); } catch { return; }
    responseSummary.push({ path, keys: Object.keys(data), count: data.itemList?.length ?? data.data?.length });
    if (data.itemList || data.data) await writeFile(`research/raw/probe-${responseSummary.length}.json`, JSON.stringify(data));
  }
});
const url = process.argv[2] || 'https://www.tiktok.com/@currys';
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.locator('body').waitFor();
await page.waitForFunction(() => document.body.innerText.length > 500 || /verify|captcha/i.test(document.body.innerText), { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(4000);
console.log(JSON.stringify({ url: page.url(), title: await page.title(), body: (await page.locator('body').innerText()).slice(0,16000), responses:responseSummary },null,2));
await writeFile('research/raw/probe.html', await page.content());
await page.screenshot({path:'research/raw/probe.png'});
await context.close();
