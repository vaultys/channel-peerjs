import { chromium } from "@playwright/test";
import { before, after } from "mocha";
before(async () => {
    global.browser = await chromium.launch({ headless: true });
    global.page = await global.browser.newPage();
});
after(async () => {
    await global.browser.close();
});
