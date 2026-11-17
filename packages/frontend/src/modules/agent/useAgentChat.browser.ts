import { expect, test, vi } from "vite-plus/test";
import { createApp, defineComponent, h } from "vue";
import ui from "@nuxt/ui/vue-plugin";
import UApp from "@nuxt/ui/components/App.vue";
import { apiServicesKey } from "../../shared/api-services";
import { browserApiServices } from "../../shared/api-services.browser-support";
import { useAgentChat } from "./useAgentChat";
import type { AgentStatus, AgentTurn, HistoryTurn } from "./types";

test("paginates history, preserves an unsent draft and rolls back a failed optimistic send", async () => {
  const turn = (id: string): HistoryTurn => ({
    id,
    author: "GM",
    message: id,
    reply: "Reply",
    tools: [],
  });
  const status = vi.fn(
    async (_game: string, _signal?: AbortSignal, before?: string): Promise<AgentStatus> => ({
      available: true,
      busy: false,
      turns: [turn(before ? "older" : "newest")],
      nextBefore: before ? null : "newest",
    }),
  );
  let failRequest!: (error: Error) => void;
  const submit = vi.fn(
    () =>
      new Promise<AgentTurn>((_resolve, reject) => {
        failRequest = reject;
      }),
  );
  let chat!: ReturnType<typeof useAgentChat>;
  const component = defineComponent({
    setup() {
      chat = useAgentChat("game");
      return () => h("div");
    },
  });
  const root = document.createElement("div");
  document.body.append(root);
  const app = createApp({ render: () => h(UApp, null, { default: () => h(component) }) })
    .provide(apiServicesKey, { ...browserApiServices, agent: { status, submit } })
    .use(ui);
  app.mount(root);
  try {
    chat.setOpen(true);
    await expect.poll(() => chat.available.value).toBe(true);
    await chat.older();
    await chat.older();
    expect(
      chat.messages.value
        .filter((message) => message.role === "user")
        .map((message) => message.text),
    ).toEqual(["older", "newest"]);
    expect(status).toHaveBeenCalledTimes(2);
    chat.draft.value = "draft";
    chat.setOpen(false);
    expect(chat.draft.value).toBe("draft");
    const sending = chat.submit();
    expect(chat.draft.value).toBe("");
    expect(chat.messages.value.at(-1)?.text).toBe("draft");
    chat.draft.value = "next";
    failRequest(new Error("offline"));
    await sending;
    expect(chat.messages.value.some((message) => message.text === "draft")).toBe(false);
    expect(chat.draft.value).toBe("next");
  } finally {
    app.unmount();
    root.remove();
  }
});
