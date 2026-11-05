<script setup lang="ts">
import type { NavigationMenuItem } from "@nuxt/ui";
defineProps<{ items: NavigationMenuItem[] }>();
const open = defineModel<boolean>({ required: true });
</script>

<template>
        <USidebar collapsible="none" title="Navigation" class="hidden lg:flex">
          <UNavigationMenu :items="items" orientation="vertical" aria-label="Game navigation" />
        </USidebar>
        <div class="lg:hidden">
          <USlideover v-model:open="open" title="Navigation" side="left">
            <UButton color="neutral" variant="outline">Menu</UButton>
            <template #body><UNavigationMenu :items="items" orientation="vertical" aria-label="Game navigation" /></template>
          </USlideover>
        </div>
</template>
