import { Controller, Route } from "arrow-express";
import { systems } from "./catalog.ts";

export function rpgSystemsController() {
  return Controller()
    .prefix("rpg-systems")
    .registerRoute(
      Route()
        .method("get")
        .path("")
        .handler(() => ({ systems })),
    );
}
