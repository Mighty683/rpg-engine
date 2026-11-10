/** MSW HTTP boundary for offline prototypes, including production character clients. */
import { delay, http, HttpResponse } from "msw";
import type { Sheet } from "../../src/modules/characters/sheet/types";
import type { Npc } from "../npcs-and-enemies/fixtures";
import type { Tag } from "../../src/shared/types";
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
    if (path === "/api/prototype/tags") {
      if (method === "PUT") store.tags = structuredClone(body.tags as Tag[]);
      return HttpResponse.json({ tags: empty ? [] : store.tags });
    }
    if (path === "/api/prototype/npcs")
      return HttpResponse.json({ npcs: empty ? [] : store.npcs, tags: empty ? [] : store.tags });
    const characterTags = path.match(/^\/api\/prototype\/characters\/([^/]+)\/tags$/);
    if (characterTags && method === "PUT") {
      const id = decodeURIComponent(characterTags[1]);
      if (!store.characters.some((character) => character.id === id)) return missing();
      store.characterTags[id] = structuredClone(body.tags as Tag[]);
      for (const tag of store.characterTags[id])
        if (!store.tags.some((saved) => saved.name === tag.name)) store.tags.push(tag);
      return HttpResponse.json({ tags: store.characterTags[id] });
    }
    if (path.startsWith("/api/prototype/npcs/")) {
      const id = decodeURIComponent(path.split("/").at(-1)!);
      const index = store.npcs.findIndex((npc) => npc.id === id);
      if (method === "PUT") {
        const npc = { ...(body.npc ?? body), id } as Npc;
        if (index < 0) store.npcs.push(npc);
        else store.npcs[index] = npc;
        for (const tag of npc.tags)
          if (!store.tags.some((saved) => saved.name === tag.name)) store.tags.push(tag);
        for (const tag of (body.tags ?? []) as Tag[])
          if (!store.tags.some((saved) => saved.name === tag.name)) store.tags.push(tag);
        return HttpResponse.json({ npc });
      }
      if (index < 0) return missing();
      if (method === "DELETE") {
        store.npcs.splice(index, 1);
        return new HttpResponse(null, { status: 204 });
      }
      return HttpResponse.json({ npc: store.npcs[index] });
    }
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
              .filter((entry) => !query.has("before") || entry.seq < Number(query.get("before")))
              .slice(0, Number(query.get("limit") ?? 50)),
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
