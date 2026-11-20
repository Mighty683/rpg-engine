<script setup lang="ts">
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
  { format: "bold", label: "Bold", text: "B" },
  { format: "italic", label: "Italic", text: "I" },
  { format: "underline", label: "Underline", text: "U" },
  { format: "strike", label: "Strikethrough", text: "S" },
  { format: "list", label: "Bulleted list", text: "• List", value: "bullet" },
  { format: "list", label: "Numbered list", text: "1. List", value: "ordered" },
  { format: "clean", label: "Clear formatting", text: "Clear" },
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
  editor.root.setAttribute("aria-label", "Content");
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
    <p class="text-label font-medium">Content</p>
    <div class="rounded-md border border-default">
      <div
        ref="toolbar"
        class="note-toolbar flex flex-wrap items-center gap-small border-b border-default p-small"
        role="toolbar"
        aria-label="Note formatting"
        data-testid="note-toolbar"
      >
        <select
          class="ql-header"
          aria-label="Text style"
          data-testid="note-format-header"
          :disabled="disabled"
        >
          <option selected>Normal text</option>
          <option value="1">Heading 1</option>
          <option value="2">Heading 2</option>
          <option value="3">Heading 3</option>
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
  border-radius: 0.25rem;
  background: var(--ui-bg);
  padding: 0.25rem 0.5rem;
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
  outline: 2px solid var(--ui-primary);
  outline-offset: -2px;
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
