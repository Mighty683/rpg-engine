import path from "node:path";

const sourceRoot = "/packages/backend/src/";
const tableOwners = {
  agentTurns: "agent",
  accounts: "auth",
  sessions: "auth",
  signInAttempts: "auth",
  games: "games",
  players: "players",
  characters: "characters",
  characterClasses: "characters",
  characterClassLevels: "characters",
  characterSkillRanks: "characters",
  characterSkills: "characters",
  characterEquipment: "characters",
  characterCreateRequests: "characters",
  invitations: "invitations",
  throws: "throws",
  npcs: "npcs",
  npcAttacks: "npcs",
  npcCreateRequests: "npcs",
  classTemplates: "class-catalog",
  gameClasses: "class-catalog",
  gameClassSkills: "class-catalog",
  classCreateRequests: "class-catalog",
};

function localPath(filename) {
  const normalized = filename.replaceAll("\\", "/");
  return normalized.split(sourceRoot)[1];
}
function moduleName(filename) {
  return filename?.match(/^modules\/([^/]+)\//)?.[1];
}
function literal(node) {
  if (node?.type === "Literal") return node.value;
  if (node?.type === "TemplateLiteral" && !node.expressions.length)
    return node.quasis[0].value.cooked;
}
function property(node) {
  return node.computed ? literal(node.property) : node.property.name;
}
/** Direct imported table writes only: aliases through variables/helpers and raw SQL require review. */
const writes = {
  meta: {
    type: "problem",
    schema: [],
    messages: {
      ownership: "This table belongs to {{owner}}; inject its transaction-bound owner operations.",
    },
  },
  create(context) {
    const current = localPath(context.filename);
    const owner = moduleName(current);
    const names = new Map();
    const namespaces = new Set();
    if (!owner && !current?.startsWith("application/")) return {};
    function importedTable(node) {
      if (node?.type === "Identifier") return names.get(node.name);
      if (
        node?.type === "MemberExpression" &&
        node.object.type === "Identifier" &&
        namespaces.has(node.object.name)
      )
        return property(node);
    }
    return {
      ImportDeclaration(node) {
        const value = literal(node.source);
        if (typeof value !== "string" || !value.startsWith(".")) return;
        if (
          path.posix.normalize(path.posix.join(path.posix.dirname(current), value)) !==
          "database/schema.ts"
        )
          return;
        for (const specifier of node.specifiers) {
          if (specifier.type === "ImportSpecifier")
            names.set(specifier.local.name, specifier.imported.name);
          if (specifier.type === "ImportNamespaceSpecifier") namespaces.add(specifier.local.name);
        }
      },
      CallExpression(node) {
        if (
          node.callee.type !== "MemberExpression" ||
          !["insert", "update", "delete"].includes(property(node.callee))
        )
          return;
        const table = importedTable(node.arguments[0]);
        const tableOwner = tableOwners[table];
        if (tableOwner && tableOwner !== owner)
          context.report({ node, messageId: "ownership", data: { owner: tableOwner } });
      },
    };
  },
};
export default { meta: { name: "backend-boundaries" }, rules: { "owner-writes": writes } };
