/** SQL text must be static; request values belong in PostgreSQL parameters. */
function isLiteral(node) {
  return (
    (node?.type === "Literal" && typeof node.value === "string") ||
    (node?.type === "TemplateLiteral" && node.expressions.length === 0)
  );
}

function isStaticConstant(sourceCode, identifier) {
  let scope = sourceCode.getScope(identifier);
  while (scope) {
    const variable = scope.set.get(identifier.name);
    if (variable) {
      const definition = variable.defs.length === 1 && variable.defs[0];
      const declaration = definition && definition.parent;
      const statement = declaration?.parent;
      const topLevel =
        statement?.type === "Program" ||
        (statement?.parent?.type === "Program" && statement.type === "ExportNamedDeclaration");
      return (
        definition?.type === "Variable" &&
        declaration?.kind === "const" &&
        topLevel &&
        isLiteral(definition.node.init)
      );
    }
    scope = scope.upper;
  }
  return false;
}

const staticQuery = {
  meta: {
    type: "problem",
    messages: { dynamic: "SQL query text must be static; pass values separately as parameters." },
    schema: [],
  },
  create(context) {
    return {
      CallExpression(node) {
        const callee = node.callee;
        if (callee.type !== "MemberExpression") return;
        const queryMethod =
          (!callee.computed &&
            callee.property.type === "Identifier" &&
            callee.property.name === "query") ||
          (callee.computed &&
            callee.property.type === "Literal" &&
            callee.property.value === "query");
        if (!queryMethod) return;
        const query = node.arguments[0];
        if (
          isLiteral(query) ||
          (query?.type === "Identifier" && isStaticConstant(context.sourceCode, query))
        )
          return;
        context.report({ node: query ?? node, messageId: "dynamic" });
      },
    };
  },
};

const noDrizzleRaw = {
  meta: {
    type: "problem",
    messages: { raw: "Avoid sql.raw(); use the query builder or parameterized sql templates." },
    schema: [],
  },
  create(context) {
    const sqlNames = new Set();
    return {
      ImportDeclaration(node) {
        if (node.source.value !== "drizzle-orm") return;
        for (const specifier of node.specifiers) {
          if (specifier.type === "ImportSpecifier" && specifier.imported.name === "sql")
            sqlNames.add(specifier.local.name);
        }
      },
      CallExpression(node) {
        const callee = node.callee;
        if (
          callee.type !== "MemberExpression" ||
          callee.object.type !== "Identifier" ||
          !sqlNames.has(callee.object.name)
        )
          return;
        const raw =
          (!callee.computed &&
            callee.property.type === "Identifier" &&
            callee.property.name === "raw") ||
          (callee.computed &&
            callee.property.type === "Literal" &&
            callee.property.value === "raw");
        if (raw) context.report({ node, messageId: "raw" });
      },
    };
  },
};

export default {
  meta: { name: "sql-security" },
  rules: { "static-query": staticQuery, "no-drizzle-raw": noDrizzleRaw },
};
