import { mkdir, writeFile } from "node:fs/promises";
import { instance } from "@viz-js/viz";
import { cruise } from "dependency-cruiser";

const packages = process.argv.slice(2);
if (!packages.length || packages.some((name) => !["frontend", "backend"].includes(name))) {
  throw new Error("Pass frontend, backend, or both.");
}

const outputDirectory = "dist/dependencies";
await mkdir(outputDirectory, { recursive: true });
const graphviz = await instance();

for (const name of packages) {
  const source = `packages/${name}/src`;
  const { output } = await cruise([source], {
    outputType: "dot",
    includeOnly: `^${source}/`,
    exclude: "\\.(browser(-support)?|test|spec|story|stories|d)\\.",
    tsPreCompilationDeps: true,
  });
  const svg = graphviz.renderString(output, { engine: "dot", format: "svg" });
  await writeFile(`${outputDirectory}/${name}.dot`, output);
  await writeFile(`${outputDirectory}/${name}.svg`, svg);
  console.log(`Generated ${outputDirectory}/${name}.svg`);
}
