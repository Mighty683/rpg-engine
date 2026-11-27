<script setup lang="ts">
import { tr } from "../../shared/i18n";
import { onMounted, useTemplateRef, watch } from "vue";
import type Quill from "quill";
import "quill/dist/quill.core.css";
import {
  codePoints,
  noteBodyCodePointLimit,
  sameNoteDocument,
  visibleNoteText,
} from "./note-document";
import type { NoteAttributes, NoteDocument } from "./types";
/**
 * Quill wrapper for note bodies: the allowlisted toolbar (Normal text and
 * headings 1–3, bullet and numbered lists, bold, italic, underline,
 * strikethrough, Clear formatting), paste filtering through the same format
 * allowlist, and the server's 5,000 code point body limit. The editor and
 * its toolbar form one focus boundary; leaving both commits the pending edit.
 */
const content = defineModel<NoteDocument>({ required: true });
const props = defineProps<{ disabled?: boolean }>();
const emit = defineEmits<{ commit: [] }>();
const surface = useTemplateRef("surface");
const toolbar = useTemplateRef("toolbar");
const controls = [
  { format: "bold", label: tr("ui.bold"), text: "B" },
  { format: "italic", label: tr("ui.italic"), text: "I" },
  { format: "underline", label: tr("ui.underline"), text: "U" },
  { format: "strike", label: tr("ui.strikethrough"), text: "S" },
  { format: "list", label: tr("ui.bulletedList"), text: tr("ui.bulletList"), value: "bullet" },
  { format: "list", label: tr("ui.numberedList"), text: tr("ui.label1List"), value: "ordered" },
  { format: "clean", label: tr("ui.clearFormatting"), text: tr("ui.clear") },
];
let editor: Quill | undefined;

onMounted(async () => {
  const { default: Quill, Delta } = await import("quill");
  if (!surface.value || !toolbar.value) return;
  editor = new Quill(surface.value, {
    formats: ["bold", "italic", "underline", "strike", "header", "list"],
    modules: { toolbar: toolbar.value },
    readOnly: props.disabled,
  });
  editor.clipboard.addMatcher("h4, h5, h6", (_node, delta) =>
    delta.compose(new Delta().retain(delta.length(), { header: null })),
  );
  editor.root.setAttribute("role", "textbox");
  editor.root.setAttribute("aria-label", tr("ui.content"));
  editor.root.setAttribute("aria-multiline", "true");
  editor.root.setAttribute("data-testid", "note-content");
  editor.setContents(content.value.ops);
  editor.on("text-change", (_change, _old, source) => {
    if (source === "user" && editor) publish(editor);
  });
});

function publish(instance: Quill) {
  const visible = visibleNoteText(instance.getContents());
  if (codePoints(visible) > noteBodyCodePointLimit) {
    const end = Array.from(visible).slice(0, noteBodyCodePointLimit).join("").length;
    instance.deleteText(end, instance.getLength() - 1 - end);
  }
  const ops = instance
    .getContents()
    .ops.filter(
      (op): op is { insert: string; attributes?: Record<string, unknown> } =>
        typeof op.insert === "string",
    )
    .map((op) => ({
      insert: op.insert,
      ...(op.attributes ? { attributes: op.attributes as NoteAttributes } : {}),
    }));
  content.value = { ops };
}

watch(content, (document) => {
  if (editor && !sameNoteDocument(document, editor.getContents())) editor.setContents(document.ops);
});
watch(
  () => props.disabled,
  (disabled) => editor?.enable(!disabled),
);

function commitOnExit(event: FocusEvent) {
  const owner = event.currentTarget as HTMLElement;
  if (event.relatedTarget instanceof Node && owner.contains(event.relatedTarget)) return;
  emit("commit");
}
</script>

<template>
  <div class="space-y-small" @focusout="commitOnExit">
    <p class="text-label font-medium">{{ tr("ui.content") }}</p>
    <div class="rounded-md border border-default">
      <div
        ref="toolbar"
        class="note-toolbar flex flex-wrap items-center gap-small border-b border-default p-small"
        role="toolbar"
        :aria-label="tr('ui.noteFormatting')"
        data-testid="note-toolbar"
      >
        <select
          class="ql-header"
          :aria-label="tr('ui.textStyle')"
          data-testid="note-format-header"
          :disabled="disabled"
        >
          <option selected>{{ tr("ui.normalText") }}</option>
          <option value="1">{{ tr("ui.heading1") }}</option>
          <option value="2">{{ tr("ui.heading2") }}</option>
          <option value="3">{{ tr("ui.heading3") }}</option>
        </select>
        <button
          v-for="control in controls"
          :key="control.label"
          type="button"
          :class="`ql-${control.format}`"
          :aria-label="control.label"
          :title="control.label"
          :value="control.value"
          :disabled="disabled"
          :data-testid="`note-format-${control.value ?? control.format}`"
        >
          {{ control.text }}
        </button>
      </div>
      <div ref="surface" class="note-surface" />
    </div>
  </div>
</template>

<style scoped>
.note-toolbar :is(button, select) {
  border: 1px solid var(--ui-border);
  border-radius: var(--radius-control);
  background: var(--ui-bg);
  padding: var(--spacing-tight) var(--spacing-small);
}

.note-toolbar .ql-active {
  color: var(--ui-primary);
  border-color: currentColor;
}

.ql-bold {
  font-weight: bold;
}
.ql-italic {
  font-style: italic;
}
.ql-underline {
  text-decoration: underline;
}
.ql-strike {
  text-decoration: line-through;
}

.note-surface :deep(.ql-editor) {
  min-height: 9rem;
  overflow-wrap: anywhere;
}

.note-surface :deep(.ql-editor:focus-visible) {
  outline: var(--focus-ring-width) solid var(--focus-ring-color);
  outline-offset: calc(-1 * var(--focus-ring-offset));
}

.note-surface :deep(h1) {
  font-size: 1.5em;
  font-weight: 600;
}
.note-surface :deep(h2) {
  font-size: 1.25em;
  font-weight: 600;
}
.note-surface :deep(h3) {
  font-size: 1.125em;
  font-weight: 600;
}
</style>
