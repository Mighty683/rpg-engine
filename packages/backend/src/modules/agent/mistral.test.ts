import type { AgentProvider } from "./types.ts";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { createMistralProvider } from "./mistral.ts";

afterEach(() => vi.unstubAllGlobals());

const request: Parameters<AgentProvider["complete"]>[0] = {
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

it("translates a completed tool exchange and sanitizes transport and malformed provider errors", async () => {
  const attempt = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", attempt);
  const provider = createMistralProvider("mistral-small-2603", "test-secret");
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

it("decodes tool calls and records usage from a successful upstream response", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      Response.json({
        choices: [
          {
            message: {
              tool_calls: [{ id: "call123", function: { name: "read_throws", arguments: "{}" } }],
            },
          },
        ],
        usage: { prompt_tokens: 200, completion_tokens: 10 },
      }),
    ),
  );
  expect(await createMistralProvider("model", "test").complete(request)).toEqual({
    text: "",
    calls: [{ id: "call123", name: "read_throws", arguments: "{}" }],
    inputTokens: 200,
    outputTokens: 10,
  });
});

it.each([
  { usage: { prompt_tokens: 0, completion_tokens: 1 } },
  { usage: { prompt_tokens: 20.5, completion_tokens: 1 } },
  { usage: { prompt_tokens: 20, completion_tokens: -1 } },
  { usage: undefined },
])("rejects invalid upstream usage %#", async ({ usage }) => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(Response.json({ choices: [{ message: { content: "reply" } }], usage })),
  );
  await expect(createMistralProvider("model", "test").complete(request)).rejects.toMatchObject({
    code: "agent_failed",
    reason: "invalid_provider_response",
  });
});

it.each([
  null,
  { function: { name: "read_throws", arguments: "{}" } },
  { id: "call123", function: null },
  { id: "call123", function: { name: 5, arguments: "{}" } },
  { id: "call123", function: { name: "read_throws", arguments: {} } },
])("rejects malformed upstream tool calls %#", async (call: unknown) => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      Response.json({
        choices: [{ message: { tool_calls: [call] } }],
        usage: { prompt_tokens: 20, completion_tokens: 1 },
      }),
    ),
  );
  await expect(createMistralProvider("model", "test").complete(request)).rejects.toMatchObject({
    code: "agent_failed",
    reason: "invalid_provider_response",
  });
});
