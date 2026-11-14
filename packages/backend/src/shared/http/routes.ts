import type { AppConfigurator } from "arrow-express";
import type { Express } from "express";

/** Keep Arrow's controller composition, but forward errors to our Express error boundary. */
export function mountRoutes(app: Express, routes: AppConfigurator) {
  const methods = ["get", "post", "head", "put", "delete", "options", "patch"] as const;
  for (const route of routes.buildRoutes()) {
    const method = methods.find((method) => method === route.method);
    if (!method) throw new Error("Unsupported route method");
    app[method](`/${route.path}`, async (request, response, next) => {
      try {
        const result = await route.handler(request, response, undefined);
        if (!response.writableEnded && !response.destroyed) response.send(result);
      } catch (error) {
        next(error);
      }
    });
  }
}
