/** Local prototype data and operations; no network or production persistence. */
import type { Character, Game, Player } from "./types";

function newCharacter(): Character {
  return { id: crypto.randomUUID(), identity: { name: "", theme: "" }, level: 5, editingLocked: false, classes: [], skills: [], attributes: { DEX: "8", INS: "10", MIG: "6", WLP: "8" }, equipment: [], current: { HP: null, MP: null, IP: null, Fabula: 3 }, overrides: { DEF: null, "MAG DEF": null, INIT: null } };
}

export function createMockApi() {
  const camilla = newCharacter();
  Object.assign(camilla, { identity: { name: "Camilla", theme: "Hope" }, classes: [{ id: "orator", name: "Orator", notes: "", price: null }, { id: "weaponmaster", name: "Weaponmaster", notes: "", price: null }], equipment: [
    { id: "rapier", name: "Rapier", notes: "Martial melee weapon", price: 200, itemType: "weapon", weapon: { attributes: ["DEX", "INS"], accuracyBonus: 1 } },
    { id: "garb", name: "Traveler garb", notes: "Light armor", price: 100, itemType: "armor", defenseKind: "armor", equipped: true, armor: { fixedDefense: null, physicalBonus: 1, magicBonus: 1, initiative: -1 } },
    { id: "shield", name: "Runic shield", notes: "Martial shield", price: 150, itemType: "armor", defenseKind: "shield", equipped: true, shield: { physicalBonus: 2, magicBonus: 2, initiative: 0 } },
  ] });
  const games: Game[] = [
    { id: "starfall", name: "The Starfall Isles", system: "Fabula Ultima", players: [{ id: "alex", name: "Alex", activeCharacterId: camilla.id, characters: [camilla] }] },
    { id: "old-road", name: "The Old Road", system: "Dungeons & Dragons 5e", players: [] },
  ];
  return {
    games,
    createGame(name: string, system: string): Game { return { id: crypto.randomUUID(), name, system, players: [] }; },
    createPlayer(name: string): Player { return { id: crypto.randomUUID(), name, activeCharacterId: null, characters: [] }; },
    createCharacter: newCharacter,
  };
}
