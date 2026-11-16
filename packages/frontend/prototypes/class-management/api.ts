import { createCatalogClient } from "../../src/modules/class-management/api";
import { contractRequest, wireId, viewId, classGamePath } from "./contract";

export const classCatalogApi = createCatalogClient(
  classGamePath.split("/").at(-1),
  true,
  (path, method, body) => contractRequest(path, { method, body }),
  wireId,
  viewId,
  true,
);
