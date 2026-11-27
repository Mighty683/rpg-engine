import { tr } from "../../shared/i18n";
import { computed, onMounted, ref, shallowRef } from "vue";
import { useToast } from "@nuxt/ui/composables";
import { useApiServices } from "../../shared/api-services";
import { useSaveGameCharacterMutation } from "../characters/hooks";
import type { GmNpc, NpcWrite } from "../npcs/types";
import type { AgentEditRequest } from "./types";
import { editDifferences, mergedProfile, nested } from "./edit-preview";

export function useAgentEdit(props: AgentEditRequest, dismiss: () => void) {
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

  const diff = computed(() => (profile.value ? editDifferences(profile.value, changes.value) : []));
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
      if (npc?.view !== "gm") throw new Error(tr("ui.thisNpcIsUnavailable"));
      if (
        !profile.value &&
        npc.revision !== action.expectedRevision &&
        Object.values(action.changes).some(nested)
      )
        throw new Error(tr("ui.theNpcChangedBeforeReviewRequestAFreshProposal"));
      npcWrite.value = extractWrite(npc);
      profile.value = npcWrite.value;
      currentRevision = npc.revision;
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
      notice.value = tr("ui.theSavedRevisionChangedReviewTheLatestValuesBefore");
    revision.value = currentRevision;
  }
  async function refresh() {
    busy.value = true;
    try {
      await load();
    } catch (error) {
      profile.value = undefined;
      notice.value = error instanceof Error ? error.message : tr("ui.couldNotLoadTheSavedProfile");
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
      toast.add({ title: tr("ui.profileSaved") });
      dismiss();
    } catch (error) {
      if ((error as { status?: number }).status === 409) await refresh();
      else {
        notice.value = tr("ui.couldNotConfirmTheSaveReviewTheLatestSaved");
        await refresh();
      }
    } finally {
      busy.value = false;
    }
  }

  return {
    profile: computed(() => (profile.value ? String(profile.value.name) : undefined)),
    diff,
    busy,
    notice,
    accept,
  };
}
