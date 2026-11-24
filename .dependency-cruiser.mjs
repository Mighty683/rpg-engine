const backend = "^packages/backend/src/";
const modules = backend + "modules/";
const ownModule = modules + "$1/";
const fromModule = { path: modules + "([^/]+)/", pathNot: "\\.test\\.ts$" };
const controller = backend + ".*controller\\.ts$";
const pureModules = modules + "(?:fabula/(?:rules|rolls)|rpg-systems/catalog)\\.ts$";

export default {
  options: {
    tsPreCompilationDeps: true,
    doNotFollow: { path: "(^|/)(node_modules|prototypes)/" },
  },
  forbidden: [
    {
      name: "no-prototype-imports",
      severity: "error",
      from: { path: "^packages/[^/]+/src/" },
      to: { path: "(^|/)prototypes(/|$)" },
    },
    {
      name: "no-controller-to-controller",
      severity: "error",
      from: { path: controller },
      to: { path: controller },
    },
    {
      name: "no-module-to-application",
      severity: "error",
      from: fromModule,
      to: { path: backend + "application/" },
    },
    {
      name: "no-public-types-to-implementation",
      severity: "error",
      from: { path: modules + "([^/]+)(?=/).*/types\\.ts$" },
      to: { path: ownModule, pathNot: "/types\\.ts$" },
    },
    {
      name: "no-sibling-implementation",
      severity: "error",
      from: fromModule,
      to: { path: modules, pathNot: [ownModule, "/types\\.ts$", pureModules] },
    },
    {
      name: "sibling-types-are-type-only",
      severity: "error",
      from: fromModule,
      to: {
        path: modules + ".+/types\\.ts$",
        pathNot: ownModule,
        dependencyTypesNot: ["type-only", "type-import"],
      },
    },
  ],
};
