<script setup lang="ts">
import { computed, onMounted, ref, shallowRef } from "vue";
import { useToast } from "@nuxt/ui/composables";
import { useApiServices } from "../../shared/api-services";
import { useSaveGameCharacterMutation } from "../characters/hooks";
import type { GmNpc, NpcWrite } from "../npcs/api";
import type { AgentAction } from "./types";

const props = defineProps<{
  gameId: string;
  action: Exclude<AgentAction, { kind: "roll" }>;
  saveNpc(id: string, revision: number, next: NpcWrite): Promise<void>;
}>();
const emit = defineEmits<{ dismiss: [] }>();
const api = useApiServices();
const toast = useToast();
const saveCharacter = useSaveGameCharacterMutation(
  props.gameId,
  props.action.kind === "edit_character" ? props.action.characterId : "",
);
const busy = ref(false);
const notice = ref("");
const revision = ref(props.action.expectedRevision);
const profile = shallowRef<Record<string, unknown>>();
const npcWrite = shallowRef<NpcWrite>();
const changes = shallowRef<Record<string, unknown>>(props.action.changes);

function nested(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
function differences(before: Record<string, unknown>, after: Record<string, unknown>) {
  const entries: { field: string; oldValue: unknown; newValue: unknown }[] = [];
  for (const [key, value] of Object.entries(after)) {
    const previous = before[key];
    if (nested(value) && nested(previous)) {
      for (const item of differences(previous, value))
        entries.push({ ...item, field: key + "." + item.field });
    } else if (previous !== value)
      entries.push({ field: key, oldValue: previous, newValue: value });
  }
  return entries;
}
function fieldLabel(path: string) {
  const [group, field] = path.split(".");
  if (group === "baseDice") return field + " base die";
  if (group === "resources")
    return field === "fabula" ? "Fabula Points" : "Current " + field?.toUpperCase();
  if (group === "hp" || group === "mp")
    return (field === "current" ? "Current " : "Maximum ") + group.toUpperCase();
  if (group === "magicDefense") return "Magic Defense";
  if (group === "notes") return "GM notes";
  return path.charAt(0).toUpperCase() + path.slice(1);
}
const diff = computed(() => (profile.value ? differences(profile.value, changes.value) : []));
function mergedProfile(base: NpcWrite, patch: Record<string, unknown>): NpcWrite {
  const updated = { ...base, ...patch };
  for (const key of ["baseDice", "hp", "mp"] as const) {
    if (nested(patch[key])) Object.assign(updated, { [key]: { ...base[key], ...patch[key] } });
  }
  return updated;
}
function extractWrite({
  view: _view,
  id: _id,
  revision: _revision,
  createdAt: _created,
  updatedAt: _updated,
  ...write
}: GmNpc) {
  return write;
}
async function load() {
  let currentRevision;
  const action = props.action;
  if (action.kind === "edit_character") {
    const { character } = await api.characters.getGameCharacter(props.gameId, action.characterId);
    profile.value = character.sheet;
    currentRevision = character.revision;
  } else {
    const { npcs } = await api.npcs.list(props.gameId);
    const npc = npcs.find((record) => record.id === action.npcId);
    if (npc?.view !== "gm") throw new Error("This NPC is unavailable.");
    if (
      !profile.value &&
      npc.revision !== action.expectedRevision &&
      Object.values(action.changes).some(nested)
    )
      throw new Error("The NPC changed before review. Request a fresh proposal.");
    npcWrite.value = extractWrite(npc);
    profile.value = npcWrite.value;
    currentRevision = npc.revision;
    // Only carry requested changes forward when refreshing a stale composite field.
    if (currentRevision === action.expectedRevision) {
      changes.value = Object.fromEntries(
        Object.entries(action.changes).map(([key, next]) => {
          const previous = profile.value?.[key];
          if (!nested(previous) || !nested(next)) return [key, next];
          return [
            key,
            Object.fromEntries(
              Object.entries(next).filter(([field, value]) => previous[field] !== value),
            ),
          ];
        }),
      );
    }
  }
  if (currentRevision !== revision.value)
    notice.value = "The saved revision changed. Review the latest values before accepting.";
  revision.value = currentRevision;
}
async function refresh() {
  busy.value = true;
  try {
    await load();
  } catch (error) {
    profile.value = undefined;
    notice.value = error instanceof Error ? error.message : "Could not load the saved profile.";
  } finally {
    busy.value = false;
  }
}
onMounted(refresh);
async function accept() {
  if (busy.value || !profile.value || !diff.value.length) return;
  const action = props.action;
  busy.value = true;
  try {
    if (action.kind === "edit_character")
      await saveCharacter.mutateAsync({
        expectedRevision: revision.value,
        changes: action.changes,
      });
    else if (npcWrite.value)
      await props.saveNpc(
        action.npcId,
        revision.value,
        mergedProfile(npcWrite.value, changes.value),
      );
    toast.add({ title: "Profile saved." });
    emit("dismiss");
  } catch (error) {
    if ((error as { status?: number }).status === 409) await refresh();
    else {
      notice.value = "Could not confirm the save. Review the latest saved values.";
      await refresh();
    }
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <section
    aria-label="Review profile edit"
    class="mt-tight w-full space-y-tight rounded-panel border border-default p-small"
  >
    <h3 class="font-semibold">
      Review edit<span v-if="profile"> · {{ profile.name }}</span>
    </h3>
    <p v-if="notice" role="status" data-testid="agent-edit-notice">{{ notice }}</p>
    <ul v-if="diff.length" data-testid="agent-edit-diff">
      <li v-for="row in diff" :key="row.field" class="whitespace-pre-wrap break-words">
        <strong>{{ fieldLabel(row.field) }}</strong> · {{ row.oldValue ?? "None" }} →
        {{ row.newValue ?? "None" }}
      </li>
    </ul>
    <p v-else-if="busy && !profile" role="status">Loading changes…</p>
    <p v-else-if="!busy && profile">The saved values already match this proposal.</p>
    <div class="flex justify-end gap-small">
      <UButton
        size="xs"
        color="neutral"
        variant="outline"
        :disabled="busy"
        data-testid="agent-cancel-edit"
        @click="emit('dismiss')"
        >Cancel</UButton
      >
      <UButton
        size="xs"
        :loading="busy"
        :disabled="busy || !diff.length"
        data-testid="agent-accept-edit"
        @click="accept"
        >Accept edit</UButton
      >
    </div>
  </section>
</template>
