import type { ClassCatalogApi, ClassCatalogChange } from "../../src/modules/class-management/types";

async function request(changes?: ClassCatalogChange[]) {
  const response = await fetch(
    "/api/prototype/class-catalog",
    changes && {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ changes }),
    },
  );
  if (!response.ok) {
    const error = await response.json();
    throw Object.assign(
      new Error(error.error?.message ?? "Could not confirm the catalog change."),
      {
        status: response.status,
      },
    );
  }
  return response.json();
}

export const classCatalogApi: ClassCatalogApi = { load: () => request(), save: request };
