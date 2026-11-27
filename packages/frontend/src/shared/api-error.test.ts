import { expect, it } from "vite-plus/test";
import { apiFailure } from "./api-error";

it("interprets the same wire code in the context of the failed operation", async () => {
  const failure = (path: string, code = "ERR01") =>
    apiFailure(Response.json({ error: { code, message: "Untrusted server text" } }), path, "POST");
  expect((await failure("/api/auth/login")).message).toBe("Invalid username or password.");
  expect((await failure("/api/auth/register")).message).toBe("Username is already in use.");
  expect((await failure("/api/auth/login", "ERR77")).message).toBe("Request failed. Try again.");
});
