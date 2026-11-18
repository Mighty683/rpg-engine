<script setup lang="ts">
import { computed, h, type VNodeChild } from "vue";
import type { NoteDocument } from "./types";

const props = defineProps<{ document: NoteDocument }>();
const inlineTags = { bold: "strong", italic: "em", underline: "u", strike: "s" } as const;
const headings = ["p", "h1", "h2", "h3"] as const;

const lines = computed(() => {
  const result: { tag: string; list?: "ol" | "ul"; content: VNodeChild[] }[] = [];
  let content: VNodeChild[] = [];
  for (const { insert, attributes = {} } of props.document.ops) {
    if (typeof insert !== "string") continue;
    const chunks = insert.split("\n");
    chunks.forEach((text, index) => {
      if (text) {
        const formatted = Object.entries(inlineTags).reduce<VNodeChild>(
          (child, [format, tag]) => (attributes[format] === true ? h(tag, [child]) : child),
          text,
        );
        content.push(formatted);
      }
      if (index === chunks.length - 1) return;
      const list =
        attributes.list === "ordered" ? "ol" : attributes.list === "bullet" ? "ul" : undefined;
      const level = attributes.header;
      const heading = level === 1 || level === 2 || level === 3 ? headings[level] : "p";
      result.push({
        tag: list ? "li" : heading,
        list,
        content: content.length ? content : [h("br")],
      });
      content = [];
    });
  }
  return result;
});

function renderBody() {
  const blocks: { tag: string; children: VNodeChild[] }[] = [];
  for (const line of lines.value) {
    const previous = blocks.at(-1);
    if (!line.list) blocks.push({ tag: line.tag, children: line.content });
    else if (previous?.tag === line.list) previous.children.push(h("li", line.content));
    else blocks.push({ tag: line.list, children: [h("li", line.content)] });
  }
  return blocks.map(({ tag, children }) => h(tag, children));
}
</script>

<template>
  <div class="note-body whitespace-pre-wrap wrap-anywhere"><component :is="renderBody" /></div>
</template>

<style scoped>
.note-body :deep(ol) {
  list-style: decimal;
  padding-inline-start: 1.5em;
}
.note-body :deep(ul) {
  list-style: disc;
  padding-inline-start: 1.5em;
}
.note-body :deep(h1) {
  font-size: 1.5em;
  font-weight: 600;
}
.note-body :deep(h2) {
  font-size: 1.25em;
  font-weight: 600;
}
.note-body :deep(h3) {
  font-size: 1.125em;
  font-weight: 600;
}
</style>
