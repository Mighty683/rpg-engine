import { fileURLToPath } from "node:url";
import type { Express } from "express";
import swaggerUi from "swagger-ui-express";

const schemaUrl = "/openapi.json";
const bundle = fileURLToPath(new URL("../dist/openapi.json", import.meta.url));
const options = {
  swaggerOptions: { url: schemaUrl, validatorUrl: null, queryConfigEnabled: false },
};

/** Serve the local bundle and same-origin Swagger assets under the app's Helmet policy. */
export function mountApiDocumentation(app: Express) {
  app.get(schemaUrl, (_request, response) => response.sendFile(bundle));
  app.get("/api-docs", (request, response, next) => {
    if (!request.path.endsWith("/")) response.redirect("/api-docs/");
    else next();
  });
  app.use("/api-docs", swaggerUi.serveFiles(undefined, options));
  app.get("/api-docs/", swaggerUi.setup(undefined, options));
}
