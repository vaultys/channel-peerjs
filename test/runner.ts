import { expect } from "chai";
import path from "path";

describe("Browser Tests", () => {
  it("should run all tests in browser", async () => {
    const testUrl = `file:${path.join(__dirname, "test.html")}`;
    await page.goto(testUrl);

    // Wait for tests to complete
    await page.waitForFunction(() => (window as any).mochaResults);

    const mochaResults = await page.evaluate(
      () => (window as any).mochaResults,
    );

    expect(mochaResults.failures).to.equal(0);
  }).timeout(10000);
});
