import { When } from "@cucumber/cucumber";
import type { BrowserWorld } from "../support/world.ts";

When("I reload the page", async function (this: BrowserWorld) {
  await this.page.reload();
});
