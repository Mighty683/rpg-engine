export type ChatMessage = {
  role: "user" | "agent" | "tool";
  text: string;
};
