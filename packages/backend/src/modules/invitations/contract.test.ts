import { expect, it } from "vite-plus/test";
import {
  parseCreateInvitation,
  parseUpdateInvitation,
  parseAcceptInvitation,
  parseInvitationId,
} from "./contract.ts";
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
it("preserves invitation defaults and permissive extra properties", () => {
  for (const value of [undefined, null, false, 0, "", { kind: "game", ignored: true }])
    expect(parseCreateInvitation(value)).toEqual({ kind: "game" });
  expect(parseCreateInvitation({ kind: "character", characterId: id, ignored: true })).toEqual({
    kind: "character",
    characterId: id,
  });
  for (const value of [undefined, null, [], {}, { makeActive: null }])
    expect(parseAcceptInvitation(value)).toEqual({ makeActive: true });
  expect(parseAcceptInvitation({ makeActive: false, ignored: true })).toEqual({
    makeActive: false,
  });
  expect(parseUpdateInvitation({ enabled: false, ignored: true })).toEqual({
    enabled: false,
    ignored: true,
  });
  expect(parseInvitationId(id)).toBe(id);
});
it("rejects invalid invitation fields without coercion", () => {
  for (const value of [{}, { kind: "character", characterId: "bad" }, []])
    expect(() => parseCreateInvitation(value)).toThrowError(
      expect.objectContaining({ httpCode: 400 }),
    );
  expect(() => parseAcceptInvitation({ makeActive: "false" })).toThrowError(
    expect.objectContaining({ httpCode: 400 }),
  );
  expect(() => parseUpdateInvitation({ enabled: 1 })).toThrowError(
    expect.objectContaining({ httpCode: 400 }),
  );
  expect(() => parseInvitationId("bad")).toThrowError(expect.objectContaining({ httpCode: 400 }));
});
