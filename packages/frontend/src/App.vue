<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute } from "vue-router";
const menuOpen = ref(false);
const route = useRoute();
const gameLink = computed(() =>
  route.params.gameId ? `/games/${String(route.params.gameId)}` : "/",
);
const playerLink = computed(() =>
  route.params.gameId && route.params.playerId
    ? `/games/${String(route.params.gameId)}/players/${String(route.params.playerId)}`
    : "",
);
</script>
<template>
  <UApp>
    <main class="min-h-screen bg-default text-default lg:flex">
      <aside class="hidden min-h-screen w-64 border-r border-default p-large lg:block">
        <nav aria-label="Primary navigation" class="space-y-small">
          <RouterLink to="/" class="block rounded p-small font-semibold">Games</RouterLink
          ><RouterLink v-if="playerLink" :to="playerLink" class="block rounded p-small text-muted"
            >Player roster</RouterLink
          ><RouterLink
            v-if="gameLink !== '/'"
            :to="gameLink"
            class="block rounded p-small text-muted"
            >Game overview</RouterLink
          >
        </nav>
      </aside>
      <div class="min-w-0 flex-1">
        <header class="flex items-center gap-small border-b border-default p-small lg:hidden">
          <UButton variant="outline" size="sm" aria-label="Open menu" @click="menuOpen = true"
            >Menu</UButton
          ><span class="font-semibold">RPG Engine</span>
        </header>
        <USlideover v-model:open="menuOpen" title="Navigation"
          ><template #body
            ><nav aria-label="Mobile navigation" class="space-y-small">
              <RouterLink to="/" class="block rounded p-medium" @click="menuOpen = false"
                >Games</RouterLink
              ><RouterLink
                v-if="playerLink"
                :to="playerLink"
                class="block rounded p-medium"
                @click="menuOpen = false"
                >Player roster</RouterLink
              ><RouterLink
                v-if="gameLink !== '/'"
                :to="gameLink"
                class="block rounded p-medium"
                @click="menuOpen = false"
                >Game overview</RouterLink
              >
            </nav></template
          ></USlideover
        ><UContainer :class="route.params.characterId ? 'py-small' : 'py-page sm:py-page-wide'"
          ><RouterView :key="$route.fullPath"
        /></UContainer>
      </div>
    </main>
  </UApp>
</template>
