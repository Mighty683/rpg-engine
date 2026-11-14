import path from "node:path";

const sourceRoot = "/packages/backend/src/";
const pureExports = new Set(["fabula/rules.ts", "fabula/rolls.ts", "rpg-systems/catalog.ts"]);
const tableOwners = {
  accounts: "auth",
  sessions: "auth",
  signInAttempts: "auth",
  games: "games",
  players: "players",
  characters: "characters",
  characterClasses: "characters",
  characterSkills: "characters",
  characterEquipment: "characters",
  characterCreateRequests: "characters",
  invitations: "invitations",
  throws: "throws",
  npcs: "npcs",
  npcAttacks: "npcs",
  npcCreateRequests: "npcs",
};

function localPath(filename) {
  const normalized = filename.replaceAll("\\", "/");
  return normalized.split(sourceRoot)[1];
}
function moduleName(filename) {
  return filename?.match(/^modules\/([^/]+)\//)?.[1];
}
function controller(filename) {
  return /(?:^|\/)\w*(?:-)?controller\.ts$/.test(filename);
}
function literal(node) {
  if (node?.type === "Literal") return node.value;
  if (node?.type === "TemplateLiteral" && !node.expressions.length)
    return node.quasis[0].value.cooked;
}
function property(node) {
  return node.computed ? literal(node.property) : node.property.name;
}
function typeOnly(node) {
  return (
    node.type === "TSImportType" ||
    node.importKind === "type" ||
    node.exportKind === "type" ||
    (node.specifiers?.length > 0 &&
      node.specifiers.every((item) => item.importKind === "type" || item.exportKind === "type"))
  );
}

const imports = {
  meta: {
    type: "problem",
    schema: [],
    messages: {
      controller:
        "Controllers must not import other controllers; move shared behavior to shared HTTP helpers.",
      dependency:
        "Import sibling capabilities from types.ts; inject implementations at application composition.",
      layering: "Domain modules must not import application orchestration.",
      implementationType:
        "Public module types must declare capabilities without importing their implementation.",
    },
  },
  create(context) {
    const current = localPath(context.filename);
    const owner = moduleName(current);
    function check(source, declaration) {
      const value = literal(source);
      if (!current || typeof value !== "string" || !value.startsWith(".")) return;
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(current), value));
      const targetOwner = moduleName(target);
      let messageId;
      if (controller(current) && controller(target)) messageId = "controller";
      else if (owner && target.startsWith("application/")) messageId = "layering";
      else if (
        owner &&
        current.endsWith("/types.ts") &&
        targetOwner === owner &&
        !target.endsWith("/types.ts")
      )
        messageId = "implementationType";
      else if (
        owner &&
        targetOwner &&
        owner !== targetOwner &&
        !pureExports.has(target.slice(8)) &&
        !(target.endsWith("/types.ts") && typeOnly(declaration))
      )
        messageId = "dependency";
      if (messageId) context.report({ node: source, messageId });
    }
    return {
      ImportDeclaration(node) {
        check(node.source, node);
      },
      ExportNamedDeclaration(node) {
        check(node.source, node);
      },
      ExportAllDeclaration(node) {
        check(node.source, node);
      },
      ImportExpression(node) {
        check(node.source, node);
      },
      TSImportType(node) {
        check(node.source, node);
      },
      CallExpression(node) {
        if (node.callee.type === "Identifier" && node.callee.name === "require")
          check(node.arguments[0], node);
      },
    };
  },
};

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
export default { meta: { name: "backend-boundaries" }, rules: { imports, "owner-writes": writes } };
