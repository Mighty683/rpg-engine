<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import { useToast } from "@nuxt/ui/composables";
import CreateGameScreen from "./CreateGameScreen.vue";
import CharacterPreview from "./CharacterPreview.vue";
import CharacterSettings from "./CharacterSettings.vue";
import GamePicker from "./GamePicker.vue";
import GameRoster from "./GameRoster.vue";
import InvitationAcceptance from "./InvitationAcceptance.vue";
import InvitationManager from "./InvitationManager.vue";
import MembershipPanel from "./MembershipPanel.vue";
import ReviewControls from "./ReviewControls.vue";
import {
  accountName,
  accounts,
  createCharacter,
  createGame,
  createInvitation,
  createMember,
  invitationStatus,
  makeDemoGames,
} from "./mock-data";
import { gmControl, type Game, type GameSummary, type Resource, type Role } from "./model";

type Screen = "games" | "create-game" | "roster" | "management" | "settings" | "invitation";

const toast = useToast();
const games = ref(makeDemoGames());
const game = ref(games.value[0]!);
const userId = ref("gm");
const screen = ref<Screen>("roster");
const view = ref<HTMLElement>();
const selectedCharacterId = ref("");
const managedCharacterId = ref<string | null>(null);
const inviteId = ref("");
const signedIn = ref(true);
const gameName = ref("");
const system = ref("");
const gameError = ref("");

function roleIn(candidate: Game): Role | undefined {
  if (candidate.gmId === userId.value) return "GM";
  if (candidate.members.some((entry) => entry.userId === userId.value && !entry.removed)) {
    return "Player";
  }
}

const availableGames = computed(() =>
  games.value.flatMap((candidate): GameSummary[] => {
    const role = roleIn(candidate);
    return role ? [{ id: candidate.id, name: candidate.name, system: candidate.system, role }] : [];
  }),
);
const role = computed(() => roleIn(game.value));
const gameHeading = computed(() => {
  if (screen.value === "settings") return "Settings";
  if (screen.value === "management") return "Characters management";
  return game.value.name;
});
const member = computed(() => game.value.members.find((entry) => entry.userId === userId.value));
const playerOptions = computed(() =>
  game.value.members
    .filter(({ removed }) => !removed)
    .map(({ userId }) => ({ id: userId, label: accountName(userId) })),
);
const controllerOptions = computed(() => [
  { id: gmControl, label: "GM control" },
  ...playerOptions.value,
]);
const characterViews = computed(() =>
  game.value.characters.map((character) => ({
    ...character,
    controller: character.controllerId ? accountName(character.controllerId) : "GM controlled",
    editable: role.value === "GM" || character.controllerId === userId.value,
    active: character.controllerId
      ? game.value.members.some(({ activeCharacterId }) => activeCharacterId === character.id)
      : character.gmActive,
  })),
);
const managedCharacter = computed(() =>
  characterViews.value.find(({ id }) => id === managedCharacterId.value),
);
const members = computed(() =>
  game.value.members.map(({ userId, removed }) => ({
    id: userId,
    name: accountName(userId),
    removed,
  })),
);
const unassigned = computed(() =>
  game.value.characters
    .filter(({ controllerId }) => !controllerId)
    .map(({ id, sheet }) => ({ id, label: sheet.identity.name })),
);
const invitation = computed(() => game.value.invitations.find(({ id }) => id === inviteId.value));
const claimCharacter = computed(() =>
  game.value.characters.find(({ id }) => id === invitation.value?.characterId),
);
const status = computed(() => invitationStatus(game.value, invitation.value));
const links = computed(() =>
  game.value.invitations.map((entry) => ({
    ...entry,
    title: entry.characterId
      ? `Character link · ${game.value.characters.find(({ id }) => id === entry.characterId)?.sheet.identity.name ?? "Unavailable"}`
      : "Game link",
    status: invitationStatus(game.value, entry),
    url: `https://rpg-engine.example/invite/${entry.id}`,
  })),
);
const linkOptions = computed(() =>
  links.value.map(({ id, title, status }, index) => ({
    id,
    label: `${index + 1}. ${title} · ${status}`,
  })),
);

async function show(next: Screen) {
  if (next !== "management") managedCharacterId.value = null;
  screen.value = next;
  await nextTick();
  view.value?.querySelector("h1")?.focus();
}

function selectAccount(id: string) {
  userId.value = id;
  signedIn.value = id !== "guest";
  selectedCharacterId.value = member.value?.activeCharacterId ?? "";
  void show(role.value ? "roster" : "games");
}

function openGame(id: string) {
  const target = games.value.find((entry) => entry.id === id);
  if (!target || !roleIn(target)) return;
  game.value = target;
  selectedCharacterId.value = member.value?.activeCharacterId ?? "";
  void show("roster");
}

function startGame() {
  gameName.value = "";
  system.value = "";
  gameError.value = "";
  void show("create-game");
}

function addGame() {
  if (!gameName.value.trim() || !system.value) {
    gameError.value = "Enter a game name and choose a system.";
    return;
  }
  const created = createGame(gameName.value.trim(), system.value, userId.value);
  games.value.unshift(created);
  openGame(created.id);
  toast.add({ title: "Game created", color: "success" });
}

function openCharacter(id: string) {
  if (!characterViews.value.find((character) => character.id === id)?.active) {
    openManagedCharacter(id);
    return;
  }
  selectedCharacterId.value = id;
  void show("roster");
}

function openManagedCharacter(id: string | null) {
  managedCharacterId.value = id;
  void show("management");
}

function addCharacter(name: string) {
  const character = createCharacter(name, role.value === "GM" ? null : userId.value);
  game.value.characters.push(character);
  if (role.value === "Player" && member.value && !member.value.activeCharacterId) {
    member.value.activeCharacterId = character.id;
  }
  openCharacter(character.id);
  toast.add({ title: "Character created", color: "success" });
}

function overrideMaximum(id: string, resource: Resource, value: number | null) {
  const character = game.value.characters.find((entry) => entry.id === id);
  if (!character || !characterViews.value.some((entry) => entry.id === id && entry.editable))
    return;
  character.maximumOverrides[resource] = value;
}

function overrideManagedMaximum(resource: Resource, value: number | null) {
  if (managedCharacterId.value) overrideMaximum(managedCharacterId.value, resource, value);
}

function assignCharacter(id: string, controllerId: string | null) {
  const character = game.value.characters.find((entry) => entry.id === id);
  if (!character || role.value !== "GM" || character.controllerId === controllerId) return;
  const former = game.value.members.find(({ userId }) => userId === character.controllerId);
  if (former?.activeCharacterId === character.id) former.activeCharacterId = null;
  character.controllerId = controllerId;
  character.gmActive = false;
  toast.add({ title: "Character control updated", color: "success" });
}

function setActive(id: string, active: boolean) {
  const character = game.value.characters.find((entry) => entry.id === id);
  if (!character) return;
  if (role.value === "GM" && character.controllerId === null) {
    character.gmActive = active;
  } else if (role.value === "Player" && member.value && character.controllerId === userId.value) {
    if (!active && member.value.activeCharacterId !== id) return;
    member.value.activeCharacterId = active ? id : null;
  } else {
    return;
  }
  toast.add({ title: "Active character updated", color: "success" });
}

function toggleMember(id: string) {
  const target = game.value.members.find(({ userId }) => userId === id);
  if (!target || role.value !== "GM") return;
  target.removed = !target.removed;
  if (target.removed) {
    target.activeCharacterId = null;
    game.value.characters
      .filter(({ controllerId }) => controllerId === id)
      .forEach((character) => (character.controllerId = null));
  }
  toast.add({ title: target.removed ? "Access removed" : "Access restored", color: "success" });
}

function addInvitation(characterId: string) {
  if (role.value !== "GM" || !unassigned.value.some(({ id }) => id === characterId)) return;
  game.value.invitations.push(createInvitation(characterId));
  toast.add({ title: "Character link created", color: "success" });
}

function changeInvitation(id: string, action: "toggle" | "rotate") {
  const target = game.value.invitations.find((entry) => entry.id === id);
  if (!target || target.spent || role.value !== "GM") return;
  if (action === "rotate") {
    target.id = crypto.randomUUID();
    void show("settings");
  } else {
    target.enabled = !target.enabled;
  }
  toast.add({
    title: action === "rotate" ? "Link rotated" : target.enabled ? "Link enabled" : "Link disabled",
    color: "success",
  });
}

async function copyLink(url: string) {
  try {
    await navigator.clipboard.writeText(url);
    toast.add({ title: "Sample link copied", color: "success" });
  } catch {
    toast.add({
      title: "Could not copy the link",
      description: "Select and copy the URL manually.",
      color: "error",
    });
  }
}

function reviewInvitation(id: string) {
  inviteId.value = id;
  if (signedIn.value) continueInvitation();
  else void show("invitation");
}

function continueInvitation() {
  signedIn.value = true;
  if (
    status.value === "Enabled" &&
    (role.value === "GM" || (!invitation.value?.characterId && role.value))
  ) {
    void show("roster");
    return;
  }
  void show("invitation");
}

function acceptInvitation(makeActive: boolean) {
  const link = invitation.value;
  if (!link || status.value !== "Enabled" || member.value?.removed) return;
  if (role.value === "GM") {
    void show("roster");
    return;
  }
  if (!member.value) game.value.members.push(createMember(userId.value));
  const character = claimCharacter.value;
  if (character && member.value) {
    character.controllerId = userId.value;
    character.gmActive = false;
    link.spent = true;
    if (makeActive) member.value.activeCharacterId = character.id;
    openCharacter(character.id);
    toast.add({ title: "Character assigned", color: "success" });
    return;
  }
  void show("roster");
  toast.add({ title: "Game joined", color: "success" });
}
</script>

<template>
  <UContainer class="space-y-section py-section">
    <ReviewControls
      :accounts="accounts"
      :invitations="linkOptions"
      :account-id="userId"
      @account="selectAccount"
      @invitation="reviewInvitation"
    />
    <main ref="view" class="space-y-section">
      <GamePicker
        v-if="screen === 'games'"
        :games="availableGames"
        @open="openGame"
        @create="startGame"
      />
      <CreateGameScreen
        v-else-if="screen === 'create-game'"
        v-model:game-name="gameName"
        v-model:system="system"
        :form-error="gameError"
        @create="addGame"
        @cancel="show('games')"
      />
      <InvitationAcceptance
        v-else-if="screen === 'invitation'"
        :key="inviteId"
        :game-name="game.name"
        :character-name="claimCharacter?.sheet.identity.name"
        :status="status"
        :removed="member?.removed ?? false"
        :member="Boolean(role)"
        :signed-in="signedIn"
        @sign-in="continueInvitation"
        @accept="acceptInvitation"
        @back="show(role ? 'roster' : 'games')"
      />
      <template v-else-if="role">
        <header class="space-y-medium border-b border-default pb-large">
          <div class="flex flex-wrap items-center justify-between gap-medium">
            <div class="space-y-small">
              <p class="text-muted">{{ game.system }} · {{ accountName(userId) }}</p>
              <h1 tabindex="-1" class="text-heading font-semibold">
                {{ gameHeading }}
              </h1>
              <UButton
                v-if="screen === 'settings' || screen === 'management'"
                variant="outline"
                color="neutral"
                @click="show('roster')"
              >
                Return to game
              </UButton>
            </div>
            <div class="flex flex-wrap items-center gap-small">
              <UBadge :color="role === 'GM' ? 'primary' : 'info'" variant="subtle" size="lg">
                {{ role }}
              </UBadge>
              <UButton
                v-if="screen === 'roster' && role === 'GM'"
                color="neutral"
                variant="outline"
                @click="show('settings')"
              >
                Settings
              </UButton>
            </div>
          </div>
        </header>
        <GameRoster
          v-if="screen === 'roster' && game.system === 'Fabula Ultima'"
          :key="`${game.id}:${userId}`"
          v-model="selectedCharacterId"
          :role="role"
          :characters="characterViews"
          @create="addCharacter"
          @manage="show('management')"
          @override-maximum="overrideMaximum"
        />
        <p v-else-if="screen === 'roster'" class="text-muted">
          Character sheets are not available for {{ game.system }}.
        </p>
        <section
          v-if="screen === 'management'"
          aria-labelledby="character-settings"
          class="space-y-medium"
        >
          <h2 id="character-settings" class="text-section font-semibold">
            {{ managedCharacter?.sheet.identity.name || "Characters" }}
          </h2>
          <template v-if="managedCharacter">
            <UButton color="neutral" variant="outline" @click="openManagedCharacter(null)">
              Back to characters
            </UButton>
            <CharacterPreview
              :key="managedCharacter.id"
              :character="managedCharacter"
              @override-maximum="overrideManagedMaximum"
            />
          </template>
          <CharacterSettings
            v-else
            :role="role"
            :characters="characterViews"
            :controllers="controllerOptions"
            @assign="assignCharacter"
            @set-active="setActive"
            @open="openManagedCharacter"
          />
        </section>
        <div v-if="screen === 'settings'" class="space-y-page">
          <MembershipPanel v-if="role === 'GM'" :members="members" @toggle="toggleMember" />
          <section
            v-if="role === 'GM'"
            aria-labelledby="invitation-settings"
            class="space-y-medium"
          >
            <h2 id="invitation-settings" class="text-section font-semibold">Invitations</h2>
            <InvitationManager
              :links="links"
              :available-characters="unassigned"
              @create="addInvitation"
              @copy="copyLink"
              @toggle="changeInvitation($event, 'toggle')"
              @rotate="changeInvitation($event, 'rotate')"
            />
          </section>
        </div>
      </template>
    </main>
  </UContainer>
</template>
