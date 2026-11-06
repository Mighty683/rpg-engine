<script setup lang="ts">
import { computed, ref } from "vue";

const props = defineProps<{ members: { id: string; name: string; removed: boolean }[] }>();
const emit = defineEmits<{ toggle: [id: string] }>();
const pendingId = ref<string | null>(null);
const pending = computed(() => props.members.find(({ id }) => id === pendingId.value));

function remove() {
  if (pending.value) emit("toggle", pending.value.id);
  pendingId.value = null;
}
</script>

<template>
  <section aria-labelledby="game-members" class="space-y-medium">
    <h2 id="game-members" class="text-section font-semibold">Players</h2>
    <p class="text-muted">Manage game access here. Assign characters in Characters management.</p>
    <p v-if="!members.length" class="rounded-panel border border-default p-large">
      No players have joined.
    </p>
    <ul v-else class="space-y-small">
      <li
        v-for="member in members"
        :key="member.id"
        class="flex flex-wrap items-center justify-between gap-medium rounded-panel border border-default p-large"
      >
        <div class="flex flex-wrap items-center gap-small">
          <span class="font-semibold">{{ member.name }}</span>
          <UBadge color="neutral" variant="subtle">{{
            member.removed ? "Access removed" : "Player"
          }}</UBadge>
        </div>
        <UButton
          v-if="member.removed"
          color="neutral"
          variant="outline"
          @click="emit('toggle', member.id)"
        >
          Restore access
        </UButton>
        <UButton v-else color="error" variant="outline" @click="pendingId = member.id"
          >Remove access</UButton
        >
      </li>
    </ul>
    <UModal
      :open="pending !== undefined"
      :title="pending ? `Remove access for ${pending.name}?` : 'Remove access'"
      description="Their characters will stay in the game under GM control."
      @update:open="
        (open: boolean) => {
          if (!open) pendingId = null;
        }
      "
    >
      <template #footer>
        <UButton variant="outline" color="neutral" @click="pendingId = null">Cancel</UButton>
        <UButton color="error" @click="remove">Remove access</UButton>
      </template>
    </UModal>
  </section>
</template>
