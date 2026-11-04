// Stable system identifiers are retained while saved games reference them.
export const systems = [{ id: "dnd-5e", name: "Dungeons & Dragons 5e" }];

export function findSystem(id: string) {
  return systems.find((system) => system.id === id);
}
