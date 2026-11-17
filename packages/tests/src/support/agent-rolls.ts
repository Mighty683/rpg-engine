import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import type { AgentProvider } from "../../../backend/src/modules/agent/types.ts";
import { agentReply, agentTool } from "./agent-provider.ts";

export async function seedAgentRolls(pool: Pool, game: string, robert: string, christine: string) {
  const warHammer = randomUUID(),
    lightHammer = randomUUID(),
    agile = randomUUID();
  await pool.query(
    "update characters set name='Robert',gm_active=true,dex_die=8,mig_die=10 where id=$1",
    [robert],
  );
  await pool.query("update characters set name='Christine',dex_die=8 where id=$1", [christine]);
  await pool.query(
    "update players set active_character_id=$1 where id=(select player_id from characters where id=$1)",
    [christine],
  );
  await pool.query(
    "insert into character_equipment(id,character_id,name,notes,position,kind,equipped,accuracy_attribute_1,accuracy_attribute_2,accuracy_bonus) values($1,$3,'War Hammer','',10,'weapon',true,'DEX','MIG',2),($2,$3,'Light Hammer','',11,'weapon',false,'DEX','DEX',0)",
    [warHammer, lightHammer, robert],
  );
  await pool.query(
    "insert into npcs(id,game_id,name,relationship,level,visibility,dex_die,ins_die,mig_die,wlp_die,current_hp,max_hp,current_mp,max_mp,defense,magic_defense,notes) values($1,$2,'Agile','enemy',5,'hidden',8,8,8,8,17,17,4,4,8,8,'Hidden ambush')",
    [agile, game],
  );
  return { warHammer, lightHammer, agile };
}

export const rollProvider: AgentProvider = {
  async complete({ messages }) {
    const last = messages.at(-1)!;
    if (last.role === "tool") {
      const result = JSON.parse(last.content);
      if (last.name === "read_throws")
        return agentTool("prepare_throw", {
          kind: "reroll",
          sourceThrowId: result.filter((r: { private: boolean }) => r.private).at(-1).id,
        });
      return agentReply(result.reason ?? "Ready for GM review.");
    }
    if (last.content.includes("Reroll")) return agentTool("read_throws", {});
    if (last.content.includes("10d"))
      return agentTool("prepare_throw", { kind: "free", dice: [10, 10] });
    if (last.content.includes("Christine"))
      return agentTool("prepare_throw", {
        kind: "attribute",
        actor: "Christine",
        attributes: ["DEX", "DEX"],
        note: "Tumbling",
      });
    return agentTool("prepare_throw", {
      kind: "weapon",
      actor: "Robert",
      target: "Agile",
      weapon: "War Hammer",
    });
  },
};
