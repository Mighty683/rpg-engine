import { afterEach, expect, it, vi } from "vite-plus/test";
import { createMistralEmbeddings } from "./mistral-embeddings.ts";

afterEach(() => vi.unstubAllGlobals());

const success = (embeddings: unknown[]) =>
  Response.json({ data: embeddings.map((embedding, index) => ({ embedding, index })) });

it("requests the model and inputs and returns one vector per input", async () => {
  const attempt = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", attempt);
  attempt.mockResolvedValueOnce(
    success([
      [0.5, -0.25, 1],
      [0.1, 0.2, 0.3],
    ]),
  );
  const vectors = await createMistralEmbeddings("mistral-embed", "test-secret").embed([
    "Title\n\nBody",
    "Title",
  ]);
  expect(vectors).toEqual([
    [0.5, -0.25, 1],
    [0.1, 0.2, 0.3],
  ]);
  const [url, options] = attempt.mock.calls[0]!;
  expect(url).toBe("https://api.mistral.ai/v1/embeddings");
  expect(options?.method).toBe("POST");
  if (typeof options?.body !== "string") throw new Error("Expected a serialized request");
  expect(JSON.parse(options.body)).toEqual({
    model: "mistral-embed",
    input: ["Title\n\nBody", "Title"],
  });
  expect(new Headers(options?.headers).get("authorization")).toBe("Bearer test-secret");
});

it("forwards the abort signal and sanitizes transport and upstream failures", async () => {
  const attempt = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", attempt);
  const client = createMistralEmbeddings("mistral-embed", "test-secret");
  const signal = AbortSignal.timeout(1000);
  attempt.mockResolvedValueOnce(new Response("secret upstream body", { status: 429 }));
  await expect(client.embed(["text"], signal)).rejects.toMatchObject({
    code: "embeddings_unavailable",
    message: "embeddings_unavailable",
  });
  expect(attempt.mock.calls[0]![1]?.signal).toBe(signal);
  attempt.mockRejectedValueOnce(new Error("network down"));
  await expect(client.embed(["text"])).rejects.toMatchObject({ code: "embeddings_unavailable" });
});

it.each([
  ["missing data", Response.json({}), "invalid_embedding_response"],
  ["an empty data array", success([]), "invalid_embedding_response"],
  ["fewer vectors than inputs", success([[0.5]]), "invalid_embedding_response"],
  ["vectors beyond the inputs", success([[0.5], [0.5], [0.5]]), "invalid_embedding_response"],
  ["an empty vector", success([[], [0.5]]), "invalid_embedding_response"],
  ["a non finite component", success([[0.5, Number.NaN], [0.5]]), "invalid_embedding_response"],
  ["a non numeric component", success([[0.5, "0.5"], [0.5]]), "invalid_embedding_response"],
  ["a null component", success([[0.5, null], [0.5]]), "invalid_embedding_response"],
  ["heterogeneous dimensions", success([[0.5, 0.6], [0.5]]), "invalid_embedding_response"],
  ["a malformed body", "not json", "invalid_embedding_response"],
  ["an upstream error status", new Response("nope", { status: 502 }), "embeddings_unavailable"],
])("rejects %s", async (_name, body, code) => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(typeof body === "string" ? new Response(body, { status: 200 }) : body),
  );
  await expect(
    createMistralEmbeddings("mistral-embed", "k").embed(["a", "b"]),
  ).rejects.toMatchObject({ code, message: code });
});
