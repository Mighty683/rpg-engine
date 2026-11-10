const noPrototypeImports = {
  meta: {
    type: "problem",
    messages: { prototype: "Production code must not import from prototypes." },
    schema: [],
  },
  create(context) {
    function check(source) {
      const path =
        source?.type === "Literal"
          ? source.value
          : source?.type === "TemplateLiteral" && source.expressions.length === 0
            ? source.quasis[0].value.cooked
            : undefined;
      if (typeof path === "string" && path.split("/").includes("prototypes")) {
        context.report({ node: source, messageId: "prototype" });
      }
    }
    return {
      ImportDeclaration(node) {
        check(node.source);
      },
      ExportNamedDeclaration(node) {
        check(node.source);
      },
      ExportAllDeclaration(node) {
        check(node.source);
      },
      ImportExpression(node) {
        check(node.source);
      },
      CallExpression(node) {
        if (node.callee.type === "Identifier" && node.callee.name === "require")
          check(node.arguments[0]);
      },
    };
  },
};

export default {
  meta: { name: "prototype-boundary" },
  rules: { "no-prototype-imports": noPrototypeImports },
};
