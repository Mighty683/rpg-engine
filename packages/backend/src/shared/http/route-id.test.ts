import { expect, it } from "vite-plus/test";
import { routeId } from "./route-id.ts";
import { routeId as compatibilityRouteId } from "../../modules/games/controller.ts";

it("preserves accepted UUID spelling and first route-array entry through the compatibility export", () => {
  const id = "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA";
  expect(routeId(id)).toBe(id);
  expect(routeId([id, "invalid"])).toBe(id);
  expect(compatibilityRouteId).toBe(routeId);
});

it.each(["", "invalid", "aaaaaaaa-aaaa-7aaa-8aaa-aaaaaaaaaaaa", []])(
  "rejects invalid identifier %j with the unchanged response",
  (input) => {
    expect(() => routeId(input)).toThrowError(
      expect.objectContaining({
        httpCode: 400,
        response: { error: { code: "bad_request", message: "Invalid identifier." } },
      }),
    );
  },
);
