import { afterEach, expect, it, vi } from "vite-plus/test";
import { createMistralProvider } from "./mistral.ts";

afterEach(() => vi.unstubAllGlobals());

it("translates a completed tool exchange and sanitizes transport and malformed provider errors", async () => {
  const attempt = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", attempt);
  const provider = createMistralProvider("mistral-small-2603", "test-secret");
  const request: Parameters<typeof provider.complete>[0] = {
    messages: [
      {
        role: "assistant",
        content: "",
        calls: [{ id: "123456789", name: "read_throws", arguments: "{}" }],
      },
      { role: "tool", callId: "123456789", name: "read_throws", content: "[]" },
    ],
    tools: [],
    maxOutputTokens: 500,
    signal: new AbortController().signal,
  };
  attempt.mockResolvedValueOnce(
    Response.json({
      choices: [{ message: { content: "No throws." } }],
      usage: { prompt_tokens: 50, completion_tokens: 4 },
    }),
  );
  expect(await provider.complete(request)).toEqual({
    text: "No throws.",
    calls: [],
    inputTokens: 50,
    outputTokens: 4,
  });
  const [url, options] = attempt.mock.calls[0]!;
  expect(url).toBe("https://api.mistral.ai/v1/chat/completions");
  if (typeof options?.body !== "string") throw new Error("Expected a serialized chat request");
  expect(JSON.parse(options.body)).toMatchObject({
    model: "mistral-small-2603",
    messages: [
      { tool_calls: [{ function: { arguments: "{}", name: "read_throws" } }] },
      { tool_call_id: "123456789" },
    ],
    max_tokens: 500,
    parallel_tool_calls: false,
  });
  attempt.mockResolvedValueOnce(new Response("secret upstream body", { status: 429 }));
  await expect(provider.complete(request)).rejects.toMatchObject({
    code: "agent_unavailable",
    message: "agent_unavailable",
  });
  attempt.mockResolvedValueOnce(Response.json({ choices: [{ message: { content: [] } }] }));
  await expect(provider.complete(request)).rejects.toMatchObject({ code: "agent_failed" });
});
