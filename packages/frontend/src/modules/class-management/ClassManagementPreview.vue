<script setup lang="ts">
defineProps<{ screen: string; context: string }>();
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
            {{ screen === "List" ? "Games / Classes" : "Classes / Guardian" }}
          </p>
          <h1 class="text-heading font-semibold">
            {{
              screen === "List"
                ? "Classes"
                : screen === "Copy"
                  ? "Copy from library"
                  : screen === "Removal"
                    ? "Remove skill"
                    : screen === "Character"
                      ? "Character benefits"
                      : "Guardian"
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
          <UButton>Create class</UButton>
        </div>
        <UButton v-else-if="screen === 'Editor'">Save changes</UButton>
      </header>

      <template v-if="screen === 'List'">
        <div class="rounded-panel border border-default bg-elevated p-section">
          <div class="flex items-center justify-between gap-medium">
            <div>
              <h2 class="text-section font-semibold">Guardian</h2>
              <p class="text-muted">Fabula Ultima · 5 skills · 2 benefits</p>
            </div>
            <UButton color="neutral" variant="subtle">View class</UButton>
          </div>
          <p class="mt-medium text-muted">
            A defender who protects allies and stands firm in danger.
          </p>
        </div>
        <p class="text-muted">
          {{
            context === "Library"
              ? "Edits here will not change classes already copied into games."
              : "Game copies are edited independently of the library."
          }}
        </p>
      </template>

      <template v-else-if="screen === 'Editor'">
        <section class="rounded-panel border border-default bg-elevated p-section">
          <h2 class="text-section font-semibold">Class details</h2>
          <div class="mt-large grid gap-large md:grid-cols-2">
            <label class="flex flex-col gap-small"
              >Name <UInput model-value="Guardian" readonly
            /></label>
            <label class="flex flex-col gap-small"
              >RPG system <UInput model-value="Fabula Ultima" readonly
            /></label>
          </div>
          <label class="mt-large flex flex-col gap-small"
            >Description
            <UTextarea
              model-value="A defender who protects allies and stands firm in danger."
              readonly
          /></label>
        </section>
        <section class="rounded-panel border border-default bg-elevated p-section">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-section font-semibold">Free benefits</h2>
              <p class="text-muted">Granted once when the class is acquired.</p>
            </div>
            <UButton color="neutral" variant="subtle">Add benefit</UButton>
          </div>
          <div class="mt-large flex flex-col gap-small">
            <p>Stat modifier · Maximum HP <strong>+5</strong></p>
            <p>Text · Can equip martial armor and shields</p>
          </div>
        </section>
        <section class="rounded-panel border border-default bg-elevated p-section">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-section font-semibold">Skills</h2>
              <p class="text-muted">Define skill effects, ranks and benefits.</p>
            </div>
            <UButton color="neutral" variant="subtle">Add skill</UButton>
          </div>
          <div class="mt-large flex items-center justify-between gap-medium">
            <div>
              <strong>Protect</strong>
              <p class="text-muted">Maximum rank 5 · Text effect</p>
            </div>
            <div class="flex gap-small">
              <UButton color="neutral" variant="subtle">Edit</UButton
              ><UButton color="error" variant="outline">Remove</UButton>
            </div>
          </div>
        </section>
      </template>

      <section
        v-else-if="screen === 'Copy'"
        class="rounded-panel border border-default bg-elevated p-section"
      >
        <h2 class="text-section font-semibold">Choose a class</h2>
        <p class="text-muted">
          Copy into The Crystal Road. The game copy can be edited separately.
        </p>
        <div class="mt-large flex items-center justify-between gap-medium">
          <div>
            <strong>Guardian</strong>
            <p class="text-muted">Fabula Ultima · 5 skills · 2 benefits</p>
          </div>
          <UButton>Copy class</UButton>
        </div>
      </section>
      <section
        v-else-if="screen === 'Removal'"
        class="max-w-xl rounded-panel border border-default bg-elevated p-section"
      >
        <h2 class="text-section font-semibold">Remove Protect?</h2>
        <p class="mt-medium">This skill will also be removed from these characters:</p>
        <ul class="mt-medium list-disc pl-section">
          <li>Rowan Ash</li>
          <li>Nera Vale</li>
        </ul>
        <div class="mt-section flex gap-small">
          <UButton color="error" variant="solid">Remove skill</UButton
          ><UButton color="neutral" variant="outline">Cancel</UButton>
        </div>
      </section>
      <section v-else class="rounded-panel border border-default bg-elevated p-section">
        <h2 class="text-section font-semibold">Rowan Ash · Benefits</h2>
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
      </section>
    </div>
  </main>
</template>
