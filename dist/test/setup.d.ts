import { Browser, Page } from "@playwright/test";
declare global {
    var browser: Browser;
    var page: Page;
}
