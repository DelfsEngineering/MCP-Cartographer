<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  text: string
}>()

const html = computed(() => renderMarkdown(props.text))

function renderMarkdown(markdown: string): string {
  const normalized = markdown
    .replace(/\\r\\n/g, '\n')
    .replace(/\\r/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n')
    .replace(/[\r\u2028\u2029]/g, '\n')
  const lines = normalized.trim().split('\n')
  const blocks: string[] = []
  let paragraph: string[] = []
  let listItems: string[] = []
  let listType: 'ul' | 'ol' | null = null

  function flushParagraph() {
    if (!paragraph.length) return
    blocks.push(`<p>${renderInline(paragraph.join(' '))}</p>`)
    paragraph = []
  }

  function flushList() {
    if (!listType || !listItems.length) return
    blocks.push(`<${listType}>${listItems.map((item) => `<li>${renderInline(item)}</li>`).join('')}</${listType}>`)
    listItems = []
    listType = null
  }

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      flushParagraph()
      flushList()
      continue
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(trimmed)
    if (heading) {
      flushParagraph()
      flushList()
      const level = Math.min(heading[1].length + 2, 6)
      blocks.push(`<h${level}>${renderInline(heading[2])}</h${level}>`)
      continue
    }

    const unordered = /^[-*]\s+(.+)$/.exec(trimmed)
    if (unordered) {
      flushParagraph()
      if (listType !== 'ul') flushList()
      listType = 'ul'
      listItems.push(unordered[1])
      continue
    }

    const ordered = /^\d+\.\s+(.+)$/.exec(trimmed)
    if (ordered) {
      flushParagraph()
      if (listType !== 'ol') flushList()
      listType = 'ol'
      listItems.push(ordered[1])
      continue
    }

    flushList()
    paragraph.push(trimmed)
  }

  flushParagraph()
  flushList()
  return blocks.join('')
}

function renderInline(markdown: string): string {
  return markdown
    .split(/(`[^`]*`)/g)
    .map((part) => {
      if (part.startsWith('`') && part.endsWith('`')) {
        return `<code>${escapeHtml(part.slice(1, -1))}</code>`
      }
      return renderTextWithLinks(part)
    })
    .join('')
}

function renderTextWithLinks(text: string): string {
  const linkPattern = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g
  let result = ''
  let lastIndex = 0
  for (const match of text.matchAll(linkPattern)) {
    result += applyEmphasis(escapeHtml(text.slice(lastIndex, match.index)))
    result += `<a href="${escapeAttribute(match[2])}" target="_blank" rel="noopener noreferrer">${applyEmphasis(escapeHtml(match[1]))}</a>`
    lastIndex = (match.index ?? 0) + match[0].length
  }
  result += applyEmphasis(escapeHtml(text.slice(lastIndex)))
  return result
}

function applyEmphasis(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function escapeAttribute(text: string): string {
  return escapeHtml(text).replace(/`/g, '&#96;')
}
</script>

<template>
  <div class="markdown-text" v-html="html" />
</template>

<style scoped>
.markdown-text {
  display: grid;
  gap: 0.5rem;
}

.markdown-text :deep(p) {
  margin: 0;
}

.markdown-text :deep(ul),
.markdown-text :deep(ol) {
  display: grid;
  gap: 0.25rem;
  margin: 0;
  padding-left: 1.1rem;
}

.markdown-text :deep(ul) {
  list-style: disc;
}

.markdown-text :deep(ol) {
  list-style: decimal;
}

.markdown-text :deep(h3),
.markdown-text :deep(h4),
.markdown-text :deep(h5),
.markdown-text :deep(h6) {
  margin: 0;
  color: #2F2923;
  font-size: 0.8rem;
  font-weight: 600;
}

.markdown-text :deep(code) {
  border-radius: 0.25rem;
  background: #F1EDE6;
  color: #2F2923;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 0.85em;
  padding: 0.08rem 0.25rem;
}

.markdown-text :deep(a) {
  color: #6D4DFF;
  text-decoration: underline;
  text-underline-offset: 2px;
}
</style>
