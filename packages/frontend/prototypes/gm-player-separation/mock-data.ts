import type { Character, Game, Invitation, InvitationStatus, Member } from "./model";

export const accounts = [
  { id: "gm", label: "Robin · GM in The Lantern Road" },
  { id: "mira", label: "Mira · Player in The Lantern Road" },
  { id: "guest", label: "Ellis · New to The Lantern Road" },
];

const accountNames: Record<string, string> = { gm: "Robin", mira: "Mira", guest: "Ellis" };

export function accountName(userId: string) {
  return accountNames[userId] ?? userId;
}

export function createMember(userId: string): Member {
  return { userId, activeCharacterId: null, removed: false };
}

export function createInvitation(characterId: string | null, id = crypto.randomUUID()): Invitation {
  return { id, characterId, enabled: true, spent: false };
}

export function createGame(name: string, system: string, gmId: string): Game {
  return {
    id: crypto.randomUUID(),
    name,
    system,
    gmId,
    members: [],
    characters: [],
    invitations: [createInvitation(null)],
  };
}

export function createCharacter(
  name: string,
  controllerId: string | null,
  id: string = crypto.randomUUID(),
): Character {
  return {
    id,
    controllerId,
    gmActive: false,
    sheet: {
      id,
      identity: { name, theme: "" },
      level: 5,
      editingLocked: false,
      classes: [],
      skills: [],
      attributes: { DEX: "8", INS: "10", MIG: "6", WLP: "8" },
      equipment: [],
      current: { HP: null, MP: null, IP: null, Fabula: 3 },
      overrides: { DEF: null, "MAG DEF": null, INIT: null },
    },
    maximumOverrides: { HP: null, MP: null, IP: null },
  };
}

export function invitationStatus(game: Game, invitation?: Invitation): InvitationStatus {
  if (!invitation) return "Unavailable";
  if (invitation.spent) return "Used";
  if (!invitation.enabled) return "Disabled";
  if (!invitation.characterId) return "Enabled";
  const character = game.characters.find(({ id }) => id === invitation.characterId);
  if (!character) return "Unavailable";
  return character.controllerId ? "Assigned" : "Enabled";
}

export function makeDemoGames(): Game[] {
  const lanternRoad = createGame("The Lantern Road", "Fabula Ultima", "gm");
  lanternRoad.members = [{ ...createMember("mira"), activeCharacterId: "nera" }];
  const nera = createCharacter("Nera Vale", "mira", "nera");
  nera.sheet.identity.theme = "Duty";
  nera.sheet.level = 8;
  nera.sheet.classes = [{ id: "orator", name: "Orator", notes: "", price: null }];
  nera.sheet.equipment = [
    {
      id: "lantern",
      name: "Watchtower lantern",
      notes: "The last lantern from the old watchtower.",
      price: null,
      itemType: "other",
    },
  ];
  const rowan = createCharacter("Rowan Ash", null, "rowan");
  rowan.gmActive = true;
  rowan.sheet.identity.theme = "Curiosity";
  rowan.sheet.level = 6;
  const iona = createCharacter("Captain Iona", null, "captain");
  iona.sheet.identity.theme = "Resolve";
  iona.sheet.level = 9;
  lanternRoad.characters = [nera, rowan, iona];
  lanternRoad.invitations.push(createInvitation("rowan"), createInvitation("rowan"));

  const emberCoast = createGame("The Ember Coast", "Fabula Ultima", "mira");
  emberCoast.members = [createMember("gm")];
  const sable = createCharacter("Sable Reed", "gm");
  sable.sheet.identity.theme = "Hope";
  emberCoast.characters = [sable];

  return [lanternRoad, emberCoast];
}
