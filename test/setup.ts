import { chromium, Browser, Page } from "@playwright/test";
import { before, after } from "mocha";

declare global {
  var browser: Browser;
  var page: Page;
}

before(async () => {
  global.browser = await chromium.launch({ headless: true });
  global.page = await global.browser.newPage();
});

after(async () => {
  await global.browser.close();
});
