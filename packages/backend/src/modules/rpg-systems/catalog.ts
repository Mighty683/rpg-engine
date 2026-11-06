// Stable system identifiers are retained while saved games reference them.
export const systems = [{ id: "fabula-ultima", name: "Fabula Ultima" }] as const;

export function findSystem(id: string) {
  return systems.find((system) => system.id === id);
}
