import type { ProgressionClass } from "../../src/modules/class-progression/types";

export const progressionPlayerCharacterId = "catalog-rowan";

/** Illustrative game-local definitions, not a transcription of the official skill catalog. */
export const progressionCatalog: ProgressionClass[] = [
  {
    id: "guardian",
    name: "Guardian",
    description: "Defend your companions.",
    benefits: [
      {
        id: "vitality",
        name: "Vitality",
        description: "Maximum HP +5, once on acquiring this class.",
        stat: "maxHp",
        amount: 5,
      },
    ],
    skills: [
      {
        id: "resolve",
        name: "Resolve",
        maxRank: 5,
        description: "Increase your maximum HP by 2 for each rank in Resolve.",
        benefits: [
          {
            id: "resilience",
            name: "Resilience",
            description: "Maximum HP +2 per acquired rank.",
            stat: "maxHp",
            amount: 2,
            perRank: true,
          },
        ],
      },
      {
        id: "cover",
        name: "Cover",
        maxRank: 5,
        description: "Once per round, take an attack in place of a nearby ally.",
        benefits: [
          {
            id: "protection",
            name: "Protect an ally",
            description:
              "Once per round, when a nearby ally is targeted by an attack, become its target instead.",
          },
        ],
      },
    ],
  },
  {
    id: "scholar",
    name: "Scholar",
    description: "Study the world and its mysteries.",
    benefits: [
      {
        id: "focus",
        name: "Focus",
        description: "Maximum MP +5, once on acquiring this class.",
        stat: "maxMp",
        amount: 5,
      },
    ],
    skills: [
      {
        id: "insight",
        name: "Insight",
        maxRank: 5,
        description: "When you study a creature, learn one of its vulnerabilities or resistances.",
        benefits: [
          {
            id: "lore",
            name: "Recall lore",
            description:
              "After studying a creature, ask which damage type it is vulnerable or resistant to.",
          },
        ],
      },
      {
        id: "study",
        name: "Study",
        maxRank: 5,
        description: "Increase your maximum MP by 2 for each rank in Study.",
        benefits: [
          {
            id: "reserve",
            name: "Reserve",
            description: "Maximum MP +2 per rank.",
            stat: "maxMp",
            amount: 2,
            perRank: true,
          },
        ],
      },
    ],
  },
  {
    id: "wayfarer",
    name: "Wayfarer",
    description: "Find a path through unfamiliar lands.",
    benefits: [
      {
        id: "travel",
        name: "Travel knowledge",
        description: "Identify a safe campsite and a source of drinking water while traveling.",
      },
    ],
    skills: [
      {
        id: "trail",
        name: "Trail sense",
        maxRank: 10,
        description: "Identify the number and direction of creatures that passed through an area.",
        benefits: [
          {
            id: "tracking",
            name: "Follow a trail",
            description:
              "Examine tracks to learn how many creatures passed, their direction, and how recently.",
          },
        ],
      },
    ],
  },
  {
    id: "artisan",
    name: "Artisan",
    description: "Create useful tools.",
    benefits: [],
    skills: [
      {
        id: "craft",
        name: "Craft",
        maxRank: 10,
        description: "During a rest, repair one damaged nonmagical tool or piece of equipment.",
        benefits: [],
      },
    ],
  },
];
export function seedProgressionRanks(): Record<string, Record<string, number>> {
  return {
    "catalog-rowan": { resolve: 2, cover: 1, insight: 2 },
    "catalog-nera": { study: 3, insight: 1, trail: 1 },
    "catalog-new": {},
  };
}
