<script setup lang="ts">
import SurfaceCard from "../../shared/design-system/base/SurfaceCard.vue";
import LabeledInput from "../../shared/design-system/base/LabeledInput.vue";
defineProps<{ screen: string; context: string; className: string; classDescription: string }>();
defineEmits<{
  navigate: [screen: string];
  updateClassName: [value: string];
  updateClassDescription: [value: string];
}>();
</script>

<template>
  <main class="min-h-screen bg-default p-section text-default">
    <div class="mx-auto flex max-w-5xl flex-col gap-section">
      <p class="text-label text-muted">
        {{ context === "Library" ? "LIBRARY" : "GAME / THE CRYSTAL ROAD" }} · FABULA ULTIMA
      </p>
      <header class="flex flex-wrap items-start justify-between gap-medium">
        <div>
          <p class="text-primary">
            {{ context === "Library" ? "Library / Classes" : "The Crystal Road / Classes" }}
          </p>
          <h1 class="text-heading font-semibold">
            {{
              screen === "List"
                ? "Classes"
                : screen === "Create"
                  ? "Create class"
                  : screen === "Copy"
                    ? "Copy from library"
                    : screen === "Removal"
                      ? "Remove skill"
                      : screen === "Character"
                        ? "Character benefits"
                        : className
            }}
          </h1>
          <p class="text-muted">
            {{
              context === "Library"
                ? "Reusable classes outside your games"
                : "Classes for The Crystal Road"
            }}
          </p>
        </div>
        <div v-if="screen === 'List'" class="flex gap-small">
          <UButton v-if="context !== 'Library'" color="neutral" variant="outline"
            >Copy from library</UButton
          >
          <UButton @click="$emit('navigate', 'Create')">Create class</UButton>
        </div>
        <div v-else-if="screen === 'Details' || screen === 'Create'" class="flex gap-small">
          <UButton color="neutral" variant="outline" @click="$emit('navigate', 'List')"
            >Back to classes</UButton
          >
        </div>
        <p v-if="screen === 'Details'" class="w-full text-muted">
          Changes are a temporary draft and reset on reload. Saving and editing skills are not
          available yet.
        </p>
      </header>

      <template v-if="screen === 'List'">
        <SurfaceCard>
          <div class="flex items-center justify-between gap-medium">
            <div>
              <h2 class="text-section font-semibold">Guardian</h2>
              <p class="text-muted">Fabula Ultima · 1 sample skill · 2 benefits</p>
            </div>
            <UButton
              color="neutral"
              variant="subtle"
              data-testid="view-class"
              @click="$emit('navigate', 'Details')"
              >View class</UButton
            >
          </div>
          <p class="mt-medium text-muted">
            A defender who protects allies and stands firm in danger.
          </p>
        </SurfaceCard>
        <p class="text-muted">
          {{
            context === "Library"
              ? "Edits here will not change classes already copied into games."
              : "Game copies are edited independently of the library."
          }}
        </p>
      </template>

      <template v-else-if="screen === 'Create'">
        <SurfaceCard>
          <h2 class="text-section font-semibold">Class details</h2>
          <p class="text-muted">
            {{
              context === "Library"
                ? "Create a reusable library class."
                : "Create a class for The Crystal Road."
            }}
          </p>
          <LabeledInput class="mt-medium" label="Name" placeholder="Class name" readonly />
          <LabeledInput
            class="mt-medium"
            label="Description"
            placeholder="Describe the class"
            readonly
            multiline
          />
        </SurfaceCard>
        <slot name="free-benefits" />
        <SurfaceCard>
          <h2 class="text-section font-semibold">Skills</h2>
          <p class="text-muted">Define each skill's description, rank limit and benefits.</p>
          <p class="mt-medium text-muted">No skills added yet.</p>
        </SurfaceCard>
        <p class="text-muted">
          Benefit edits are a temporary draft and reset on reload. Class details, saving, and adding
          skills are not available yet.
        </p>
      </template>

      <template v-else-if="screen === 'Details'">
        <SurfaceCard>
          <h2 class="text-section font-semibold">Class details</h2>
          <p class="text-muted">
            {{
              context === "Library"
                ? "Editing the library version; existing game copies will not change."
                : "Editing this game’s copy; the library and other games will not change."
            }}
          </p>
          <LabeledInput
            class="mt-medium max-w-xs"
            label="Name"
            :model-value="className"
            data-testid="class-name"
            @update:model-value="$emit('updateClassName', String($event))"
          />
          <LabeledInput
            class="mt-medium"
            label="Description"
            multiline
            :model-value="classDescription"
            data-testid="class-description"
            @update:model-value="$emit('updateClassDescription', String($event))"
          />
        </SurfaceCard>
        <slot name="free-benefits" />
        <SurfaceCard>
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-section font-semibold">Skills</h2>
              <p class="text-muted">Define skill effects, ranks and benefits.</p>
            </div>
          </div>
          <div class="mt-large flex items-center justify-between gap-medium">
            <div>
              <strong>Protect</strong>
              <p class="text-muted">Maximum rank 5 · Text effect</p>
            </div>
          </div>
        </SurfaceCard>
      </template>

      <SurfaceCard v-else-if="screen === 'Copy'">
        <h2 class="text-section font-semibold">Choose a class</h2>
        <p class="text-muted">
          Copy into The Crystal Road. Later library edits will not update this game copy.
        </p>
        <div class="mt-large flex items-center justify-between gap-medium">
          <div>
            <strong>Guardian</strong>
            <p class="text-muted">Fabula Ultima · 1 sample skill · 2 benefits</p>
          </div>
          <UButton>Copy class</UButton>
        </div>
      </SurfaceCard>
      <SurfaceCard v-else-if="screen === 'Removal'" class="max-w-xl">
        <h2 class="text-section font-semibold">Remove Protect?</h2>
        <p class="mt-medium">
          This removes Protect from The Crystal Road and from these characters:
        </p>
        <ul class="mt-medium list-disc pl-section">
          <li>Rowan Ash</li>
          <li>Nera Vale</li>
        </ul>
        <div class="mt-section flex gap-small">
          <UButton color="error" variant="solid">Remove skill</UButton
          ><UButton color="neutral" variant="outline">Cancel</UButton>
        </div>
      </SurfaceCard>
      <SurfaceCard v-else>
        <h2 class="text-section font-semibold">Rowan Ash · Benefits</h2>
        <p class="text-muted">
          Applied modifiers change your stats. Text benefits describe effects to interpret during
          play.
        </p>
        <div class="mt-large flex flex-col gap-medium">
          <p>
            <strong>Maximum HP +5</strong> · Applied<br /><span class="text-muted"
              >Guardian · Free benefit</span
            >
          </p>
          <p>
            <strong>Martial armor and shields</strong> · Text<br /><span class="text-muted"
              >Guardian · Free benefit</span
            >
          </p>
        </div>
        <p class="mt-large text-muted">Maximum HP: 45 → 50</p>
      </SurfaceCard>
    </div>
  </main>
</template>
