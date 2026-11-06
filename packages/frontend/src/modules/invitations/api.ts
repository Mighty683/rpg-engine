export type InvitationPreview = {
  kind: "game" | "character";
  gameId: string;
  gameName: string;
  alreadyMember: boolean;
  characterId?: string;
  characterName?: string;
};

async function request<T>(token: string, accept?: { makeActive: boolean }): Promise<T> {
  const response = await fetch(`/api/invitations/${encodeURIComponent(token)}${accept ? "/accept" : ""}`, accept ? {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(accept),
    referrerPolicy: "no-referrer",
  } : { referrerPolicy: "no-referrer" });
  if (!response.ok) throw Object.assign(new Error("Invitation unavailable"), { status: response.status });
  return response.json() as Promise<T>;
}
export const invitationApi = {
  preview: (token: string) => request<{ invitation: InvitationPreview }>(token),
  accept: (token: string, makeActive: boolean) => request<{ gameId: string; characterId?: string }>(token, { makeActive }),
};
