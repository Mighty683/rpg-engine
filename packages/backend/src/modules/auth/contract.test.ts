import { expect, it } from "vite-plus/test";
import { validateCredentials, parseLoginCredentials } from "./contract.ts";

it("preserves registration normalization and collects both credential errors", () => {
  expect(validateCredentials({ username: "  Player_1  ", password: " pass123 " })).toEqual({
    username: "Player_1",
    password: " pass123 ",
    fields: {},
  });
  expect(validateCredentials(null).fields).toEqual({
    username: "Use 3–32 letters, numbers, dots, underscores, or hyphens.",
    password: "Use at least 8 characters and at most 1024 bytes.",
  });
  expect(validateCredentials([]).fields).toEqual(validateCredentials(null).fields);
});

it("preserves password byte limits and intentionally ignored extra fields", () => {
  expect(
    validateCredentials({ username: "Player", password: "😀".repeat(256), ignored: true }).fields,
  ).toEqual({});
  expect(validateCredentials({ username: "Player", password: "😀".repeat(257) }).fields).toEqual({
    password: "Use at least 8 characters and at most 1024 bytes.",
  });
});

it("keeps malformed login values as invalid credentials and preserves truncation/byte limits", () => {
  expect(parseLoginCredentials({ username: 42, password: {} })).toEqual({
    username: "",
    password: "",
  });
  expect(parseLoginCredentials(null)).toEqual({ username: "", password: "" });
  expect(
    parseLoginCredentials({ username: ` ${"a".repeat(129)} `, password: "😀".repeat(257) }),
  ).toEqual({ username: "a".repeat(128), password: "" });
  expect(
    parseLoginCredentials({ username: " unusual@name ", password: "😀".repeat(256), extra: true }),
  ).toEqual({ username: "unusual@name", password: "😀".repeat(256) });
  expect(validateCredentials({ username: "Player", password: "😀".repeat(4) }).fields).toEqual({});
});
