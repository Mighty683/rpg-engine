import type {
  ProgressionApi,
  ProgressionSnapshot,
} from "../../src/modules/class-progression/types";
async function request(path: string, body?: unknown): Promise<ProgressionSnapshot> {
  const response = await fetch(`/api/prototype/class-progression${path}`, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const error = await response.json();
    throw Object.assign(new Error(error.error?.message ?? "Could not confirm class progression."), {
      status: response.status,
    });
  }
  return response.json();
}
export const progressionApi: ProgressionApi = {
  load: () => request(""),
  save: (id, input) => request(`/${id}`, input),
};
