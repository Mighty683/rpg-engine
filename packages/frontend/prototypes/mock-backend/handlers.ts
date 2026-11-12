/** MSW HTTP boundary for offline prototypes, including production character clients. */
import { delay, http, HttpResponse } from "msw";
import type { Sheet } from "../../src/modules/characters/sheet/types";
import type { CreateThrowInput } from "../../src/modules/game-table/types";
import { createPrototypeThrow } from "./throws";
import { projectCharacter, projectParty, prototypeStore as store } from "./store";

const missing = () => HttpResponse.json({ error: { code: "not_found" } }, { status: 404 });

export const prototypeHandlers = [
  http.get(
    "*/api/games/:gameId/events",
    () =>
      new HttpResponse(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(": prototype connected\n\n"));
          },
        }),
        { headers: { "Content-Type": "text/event-stream" } },
      ),
  ),
  http.get("*/api/auth/csrf", () => HttpResponse.json({ csrfToken: "prototype-csrf" })),
  http.all("*/api/*", async ({ request }) => {
    if (store.scenario === "loading") await delay(1500);
    if (store.scenario === "error")
      return HttpResponse.json({ error: { code: "prototype_error" } }, { status: 500 });
    const path = new URL(request.url).pathname;
    const method = request.method;
    const body =
      method === "GET" || method === "DELETE"
        ? {}
        : ((await request.json()) as Record<string, any>);
    const empty = store.scenario === "empty";
    const game = {
      id: "prototype-game",
      name: "The Lantern Road",
      systemId: "fabula-ultima",
      role: "GM",
    };
    if (path === "/api/games") return HttpResponse.json({ games: [game] });
    if (/\/api\/games\/[^/]+$/.test(path)) return HttpResponse.json({ game });
    if (path.endsWith("/members")) return HttpResponse.json({ members: store.members });
    if (path.endsWith("/party"))
      return HttpResponse.json({ characters: empty ? [] : store.characters.map(projectParty) });
    if (path.endsWith("/throws")) {
      if (method === "POST") {
        const record = createPrototypeThrow(body as CreateThrowInput);
        store.throws.unshift(record);
        return HttpResponse.json({ throw: record }, { status: 201 });
      }
      const query = new URL(request.url).searchParams;
      return HttpResponse.json({
        throws: empty
          ? []
          : store.throws
              .slice(
                query.has("before")
                  ? store.throws.findIndex((entry) => entry.id === query.get("before")) + 1
                  : 0,
              )
              .slice(0, Number(query.get("limit") ?? 50))
              .reverse(),
      });
    }
    if (path.includes("/throws/") && method === "DELETE") {
      const index = store.throws.findIndex((entry) => entry.id === path.split("/").at(-1));
      if (index < 0) return missing();
      store.throws.splice(index, 1);
      return HttpResponse.json({ deleted: true });
    }
    if (path.endsWith("/characters"))
      return HttpResponse.json({
        characters: empty
          ? []
          : store.characters.map((character) => ({
              ...projectCharacter(character),
              controllerMembershipId: "member-nera",
              controllerName: "Nera",
              canEdit: true,
              active: true,
            })),
      });
    const match = path.match(/\/characters\/([^/]+)$/);
    if (!match) return missing();
    const character = store.characters.find((entry) => entry.id === match[1]);
    if (!character) return missing();
    if (method === "PATCH") {
      if (body.expectedRevision !== character.revision)
        return HttpResponse.json(
          { error: { code: "revision_conflict" }, character: projectCharacter(character) },
          { status: 409 },
        );
      const sheet = character.sheet as Sheet;
      const changes = body.changes as Partial<Sheet>;
      character.sheet = {
        ...sheet,
        ...changes,
        resources: { ...sheet.resources, ...changes.resources },
        overrides: { ...sheet.overrides, ...changes.overrides },
      };
      character.revision += 1;
    }
    return HttpResponse.json({ character: projectCharacter(character) });
  }),
];
