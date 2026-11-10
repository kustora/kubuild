# ADR-001: Rich Inline Text Handling Strategy for HTML Import

- **Status:** Accepted
- **Date:** 2026-11-10
- **Deciders:** KUBUILD Core Team
- **Consulted:** `@kubuild/renderer`, `@kubuild/components`, `@kubuild/schema`, `@kubuild/html-import`
- **Related Tickets:** STORA-608, STORA-609, STORA-610, STORA-650

---

## 1. Context and Problem Statement

When importing arbitrary HTML pages into KUBUILD's `PageDocument` tree, paragraphs, headings, and text blocks frequently contain inline markup, for example:

```html
<p>
  Welcome to <strong>KUBUILD</strong>, an innovative platform for modern web design.
  Explore our <a href="https://example.com/docs" target="_blank">documentation</a>
  or read the <a href="/changelog">latest updates</a>.
</p>
```

In standard HTML, such paragraphs combine textual content, styling annotations (`<b>`, `<strong>`, `<i>`, `<em>`, `<u>`, `<span>`), and interactive navigation (`<a>` hyperlinks or `<button>` triggers) seamlessly in an inline formatting context.

However, KUBUILD represents pages as a structured, hierarchical component AST (`PageDocument` conforming to `PageDocumentSchema`). We must determine how the HTML importer should translate mixed inline markup into KUBUILD nodes.

---

## 2. Current Architecture & Code Audit

A thorough audit of the KUBUILD codebase revealed three critical constraints across the renderer, code generator, and component definitions:

### 2.1. Inline Canvas Editor (`EditableText`)
- **Location:** `packages/renderer/src/nodes/editable-text.tsx`
- **Behavior:**
  - Uses `escapeHtml(value ?? '')` when setting DOM markup via `dangerouslySetInnerHTML`.
  - Content editing relies on browser `contentEditable="true"`, syncing updates back through `element.innerText` / `textContent`.
  - Caret positioning is calculated across text nodes using `document.createTreeWalker(element, NodeFilter.SHOW_TEXT)`.
- **Implication:**
  - If a node prop contains raw HTML tags (e.g., `Hello <b>world</b>`), `EditableText` will escape them, displaying literal tag strings (`<b>world</b>`) on the canvas.
  - If unescaped HTML were allowed into the DOM, inline editing would produce inconsistent DOM node structures that break `TreeWalker(SHOW_TEXT)` caret tracking and corrupt text synchronisation.

### 2.2. HTML Code Generator & Static Export
- **Location:** `packages/renderer/src/code-generator.ts`
- **Behavior:**
  - For `paragraph`, `heading`, and `text` node types, `code-generator.ts` explicitly escapes props:
    ```typescript
    case 'paragraph': {
      const text = props.text ?? props.value ?? props.content ?? '';
      const cls = buildClass('kb-paragraph', nodeClass);
      return `${indent}<p class="${cls}"${idAttr}>${escapeHtml(text)}</p>`;
    }
    ```
- **Implication:**
  - Any raw HTML string in `props.text` results in double escaping (`&lt;a href="..."&gt;`) in the generated production HTML.

### 2.3. Component Definitions & AST Structure
- **Location:** `packages/components/src/definitions/typography/paragraph.ts`
- **Behavior:**
  - `paragraphDefinition.acceptsChildren` is explicitly `false`.
  - `headingDefinition.acceptsChildren` is explicitly `false`.
  - Only layout components (`container`, `flex`, `grid`, `section`, `columns`) and interactive containers accept child nodes (`acceptsChildren: true`).
- **Implication:**
  - In the current schema, a `paragraph` cannot have child nodes (`children: [textNode, linkNode]`). Storing child nodes under `paragraph` violates component definitions and triggers schema validation errors.

---

## 3. Evaluation of Options

We evaluated three potential architectural approaches:

### Option A: Sanitized Inline HTML String in `props.text` or `props.html`
Store the sanitized inline markup as an HTML string directly in the node's props (e.g., `props.text: "Hello <b>world</b> <a href=\"#\">link</a>"` or a new `props.html`).

- **Pros:**
  - Preserves exact source formatting and DOM hierarchy 1:1.
  - Keeps node count minimal (one `paragraph` node per source `<p>`).
- **Cons:**
  - **Breaks `EditableText`:** Renders escaped tags as literal text or breaks caret synchronization during inline editing.
  - **Breaks `code-generator.ts`:** Requires changing generator logic to conditionally unescape or re-sanitize HTML.
  - **Bypasses Structured Node Tree:** Embedded links cannot be selected, inspected, styled, or bound to dynamic traits/actions in KUBUILD's visual inspector.
  - **Requires Schema Modifications:** Demands expanding `paragraph` prop schema to support rich HTML strings, necessitating migration paths.

### Option B: Splitting Inline Markup into Multiple Nodes (`flex` / `container`)
Convert `<p>` elements containing mixed markup into an inline-layout wrapper (`container` or `flex` with `flexWrap: wrap`, `alignItems: baseline`) containing atomic `text` and `link` child nodes.

- **Pros:**
  - **100% Schema Compliant:** Operates strictly within the current schema without modifying component definitions.
  - **Preserves Interactive Links:** Hyperlinks become first-class `link` nodes with full inspectability, href attributes, and hover styles.
  - **Compatible with `EditableText` and Code Generator:** Atomic text and link nodes are individually editable and properly escaped on export.
- **Cons:**
  - **Node Tree Inflation:** Dense paragraphs with many formatted words yield a high node count.
  - **Discontinuous Canvas Editing:** Clicking and typing across words segmented into separate nodes creates disjointed caret navigation.
  - **Layout Subtle Differences:** Inline flex wrappers can occasionally differ slightly from native inline browser text flow around punctuation or line breaks.

### Option C: Flattening to Plain Text
Extract all nested text recursively via `getTextContent()`, strip all tags (`<b>`, `<i>`, `<a>`), and collapse into a single plaintext string for `props.text`.

- **Pros:**
  - **Cleanest & Simplest:** Minimal node count and smallest JSON payload.
  - **Flawless Canvas Editing:** Zero friction with `EditableText` and native caret behavior.
  - **Zero Schema or Pipeline Changes:** Fully supported today across all packages.
- **Cons:**
  - **Data & Feature Loss:** Destroys inline typographic emphasis (`<b>`, `<i>`).
  - **Critical Link Loss:** Drops hyperlinks and call-to-actions, breaking website navigation and SEO.

---

## 4. Decision: Hybrid Strategy

We adopt a **Pragmatic Hybrid Strategy** balanced across Phase H3 (MVP) and Phase H7 (Post-MVP):

### 4.1. Phase H3 (MVP) Implementation Rules

During element mapping (STORA-608 & STORA-610):

1. **Simple `<p>` / `<h1-h6>` (Plain Text or Void of Interactive Tags):**
   - If the element contains only text, or only cosmetic styling tags (`<b>`, `<strong>`, `<i>`, `<em>`, `<u>`, `<span>`, `small`, `mark`, `abbr`):
     - Extract the combined text content using whitespace collapsing (`collapseWhitespace(getTextContent(element))`).
     - Map directly to a single `paragraph` (or `heading`) node with `props.text`.
     - Cosmetic formatting is flattened to preserve editor ergonomics and prevent node tree explosion.

2. **`<p>` / `<h1-h6>` Containing Interactive Elements (`<a>` links or `<button>`):**
   - **Critical Principle: Links must never be silently discarded.**
   - If the element contains one or more `<a>` elements (or button triggers):
     - Convert the parent `<p>` into an inline-layout `container` (or `flex` node).
     - Set inline layout styles:
       - `display: 'flex'`
       - `flexDirection: 'row'`
       - `flexWrap: 'wrap'`
       - `alignItems: 'baseline'`
       - `columnGap: '0.25em'`
       - Inherit typography styles from the paragraph (e.g. `fontSize`, `color`, `lineHeight`, `margin`).
     - Convert child segments sequentially:
       - Text fragments $\rightarrow$ `text` nodes (`type: 'text'`, `props: { text, as: 'span' }`).
       - `<a>` elements $\rightarrow$ `link` nodes (`type: 'link'`, `props: { href, target, rel, text }`, with responsive link styles).
     - Whitespace between segments is preserved so words do not stick together.

3. **Standalone `<a>` / `<button>` Elements:**
   - Standalone block or structural links continue to map directly to `link` or `button` nodes according to STORA-608 and STORA-610 rules.

### 4.2. Phase H7 (Post-MVP STORA-650) Roadmap

For dense editorial content, blogs, and complex articles where rich inline formatting (`<b>`, `<i>`, `code`, inline links) must be retained verbatim without splitting:
- **Dedicated `rich-text` Component:**
  - Introduce `type: 'rich-text'` in `@kubuild/components` and `@kubuild/schema`.
  - Backed by an integrated rich-text engine (ProseMirror / Lexical or TipTap) with a floating formatting toolbar.
  - `props.content`: Structured JSON (ProseMirror doc) or sanitized HTML fragment.
- **`html-embed` Fallback Option:**
  - Provide an import configuration option (`richTextStrategy: 'hybrid' | 'embed'`) enabling users to import long-form article sections as sanitized `html-embed` nodes.

---

## 5. Consequences

### Positive Consequences
- **Zero Schema Breaking Changes:** No alterations required in `@kubuild/schema` or `@kubuild/components` for the MVP release.
- **No Lost Links:** All navigation links, anchors, and external URLs are preserved and fully functional.
- **Canvas Editor Stability:** `EditableText` remains rock-solid without caret jumping or HTML tag escaping artifacts.
- **Export Consistency:** `code-generator.ts` continues to safely escape plain text and properly render nested `link` nodes.

### Negative Consequences & Trade-offs
- Inline stylistic formatting (`<b>`, `<i>`) inside simple paragraphs is flattened in MVP. Users can re-apply styles to entire blocks or split nodes if needed.
- Paragraphs containing links result in a container holding multiple child nodes (`container` $\rightarrow$ `text`, `link`, `text`), which separates inline editing across individual node boundaries in the canvas.

---

## 6. Action Items

1. **STORA-609 (This Spike & ADR):**
   - Document decision in `docs/adr-001-rich-inline-text.md`.
   - Update `docs/todo-html-import.md` marking STORA-609 as `Done`.
2. **STORA-610 (HTML $\rightarrow$ Node Mapping Execution):**
   - Implement the hybrid link detection and inline container conversion logic in `paragraphRule` / `linkRule`.
   - Ensure inter-node whitespace is preserved when splitting text segments.
3. **STORA-650 (Future Roadmap Spike):**
   - Create post-MVP ticket for dedicated `rich-text` component with ProseMirror/Lexical integration.
