<script setup lang="ts">
import { ref } from "vue";
const gameName = defineModel<string>("gameName", { required: true });
const system = defineModel<string>("system", { required: true });
defineProps<{ formError: string }>();
defineEmits<{ cancel: []; create: [] }>();
const heading = ref<HTMLElement>();
defineExpose({ focus: () => heading.value?.focus() });
</script>

<template>

        <UButton variant="ghost" @click="$emit('cancel')">← Games</UButton><div class="max-w-xl space-y-section"><h1 ref="heading" tabindex="-1" class="text-heading font-semibold">Create game</h1><form class="space-y-field" @submit.prevent="$emit('create')"><label class="block font-medium">Game name<input v-model="gameName" maxlength="20" class="mt-small block w-full rounded-panel border border-default bg-default p-medium" /></label><label class="block font-medium">RPG system<select v-model="system" class="mt-small block w-full rounded-panel border border-default bg-default p-medium"><option value="">Select a system</option><option>Fabula Ultima</option><option>Dungeons &amp; Dragons 5e</option></select></label><p class="text-muted">The system cannot be changed after the game is created.</p><p v-if="formError" role="alert" class="text-error">{{ formError }}</p><div class="flex gap-medium"><UButton type="submit">Create game</UButton><UButton variant="outline" @click="$emit('cancel')">Cancel</UButton></div></form></div>

</template>
