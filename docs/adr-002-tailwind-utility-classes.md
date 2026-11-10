# ADR-002: Tailwind Utility Class Support in HTML Import

- **Status:** Accepted
- **Date:** 2026-11-11
- **Deciders:** KUBUILD Core Team
- **Consulted:** `@kubuild/html-import`, `@kubuild/schema`
- **Related Tickets:** STORA-622, STORA-606, STORA-623, STORA-632

---

## 1. Context and Problem Statement

A large share of AI-generated landing pages is styled entirely with Tailwind utility classes and loads Tailwind through the Play CDN:

```html
<script src="https://cdn.tailwindcss.com"></script>
<script>tailwind.config = { theme: { extend: { colors: { primary: '#10b981' } } } }</script>
...
<h1 class="text-5xl md:text-6xl font-extrabold mb-6">...</h1>
```

There is no stylesheet in the page: the CSS is generated at runtime by the CDN script, which the sanitizer removes (STORA-603). Before this decision the real-world fixture `ai-tailwind.html` imported with essentially no styles, so every heading, button, and grid lost its layout and typography.

The document format stores portable style objects (`ResponsiveStyles`), never Tailwind classes (ARCHITECTURE: Tailwind only styles the builder chrome). So whatever we do, the output must be plain CSS values per breakpoint/state.

---

## 2. Spike: Current Architecture

### 2.1. Option (b) already exists
`HtmlImportOptions.stylesheets` accepts CSS text. A host that compiled the page with the Tailwind CLI can pass the generated CSS today, and the cascade (`src/cascade.ts`) resolves `.md\:grid-cols-3` inside `@media (min-width: 768px)` and `.hover\:bg-x:hover` like any other rule. No code change is needed for this path.

### 2.2. Why (b) is not enough on its own
- Compiling requires the `tailwindcss` package (and PostCSS/Node file access) on the host. Browser hosts (the editor's import dialog, paste-to-canvas) cannot run it cheaply, and running the CDN script itself means executing untrusted code from the page.
- Most users pasting AI output do not have a build step at all; they only have the HTML.

### 2.3. Cascade integration points
- Class rules already flow through specificity, source order, `!important`, and inline-style precedence.
- `mapMediaQueryToBreakpoints` (`src/responsive.ts`, STORA-632) maps a mobile-first `(min-width: N)` query to every KUBUILD breakpoint it covers by more than 50%.
- `extractPseudoState` + `buildResponsiveStyles` map `:hover`/`:focus`/`:active`/`:focus-visible`/`:disabled` to `styles.states`.

So if Tailwind classes are turned into ordinary `ParsedCssRule`s, all of the hard parts (responsive delta, states, cascade precedence) are reused unchanged.

---

## 3. Evaluation of Options

### Option A: Built-in class mapper (Tailwind classes → CSS rules)
Hand-written mapper for the common utility subset with the default Tailwind v3 theme scale.

- **Pros:**
  - Works in Node and the browser with zero host setup and no new dependency.
  - Never executes page code; values are generated from a fixed table.
  - Output goes through the existing cascade and CSS safety checks.
- **Cons:**
  - Covers a subset only; uncommon utilities, plugins, and most config extensions are not mapped.
  - Values follow Tailwind v3 defaults; a page relying on v4-specific scale changes may drift slightly.

### Option B: Host passes compiled CSS
- **Pros:** Exact fidelity, including plugins and full config.
- **Cons:** Requires a Tailwind build on the host; unavailable for the common paste/upload flow. Already supported, so it adds nothing new.

### Option C: Depend on the `tailwindcss` package
- **Cons:** Heavy runtime dependency (PostCSS, JIT engine) in a package that must stay small and DOM-free; still needs to evaluate `tailwind.config`, which is untrusted JS. Rejected.

---

## 4. Decision: Option A, coexisting with Option B

We implement a built-in mapper (`packages/html-import/src/tailwind.ts`) and keep `options.stylesheets` as the exact-fidelity path.

### 4.1. Integration
- `parseHtml` records Tailwind signals with `detectTailwind` **before** sanitization: a Play CDN / `@tailwindcss/browser` script, an inline `tailwind.config = ...` script, or `<style type="text/tailwindcss">`.
- `collectAndParseStylesheets` calls `buildTailwindRules` after all page and host stylesheets. Each class used in the sanitized tree becomes a rule with selector `[class~="<class>"]` (class specificity), appended last like the CDN's utilities layer. Rules are ordered by variant (base, `sm`, `md`, `lg`, `xl`, `2xl`) and then by an approximation of Tailwind's utility order, so `p-6 px-4` and `border border-gray-300` resolve like Tailwind.
- Responsive prefixes become `(min-width: 640/768/1024/1280/1536px)` (and `max-*` becomes `max-width`), mapped through the existing `mapMediaQueryToBreakpoints`. `sm:` is reported once as `CSS_MEDIA_APPROXIMATED` (640px is not a KUBUILD edge) and lands on tablet + desktop.
- `hover:`, `focus:`, `active:`, `focus-visible:`, `disabled:` become pseudo-classes and land in `styles.states`.
- Classes already defined by page or host CSS are left to that CSS (so Option B and hand-written component classes win, with no double mapping).

### 4.2. Detection (`HtmlImportOptions.tailwind`)
- `'auto'` (default): map when a Tailwind script/style was detected, or when at least 5 distinct classes carry a Tailwind signature (`md:`/`hover:`-style variants, palette shades such as `bg-gray-50`). Bootstrap, Webflow, and plain-CSS fixtures do not trigger it.
- `true`: always map. `false`: never map.

### 4.3. Supported utility families
Spacing (`p*`, `m*`, negative margins, `gap*`, `space-x/y`), sizing (`w`, `h`, `size`, `min/max-w/h`, fractions, `screen`), layout (`display`, `position`, inset, `z`, `overflow`, `container`, `order`), flexbox (direction, wrap, `flex-1`, grow/shrink, basis, `items`, `justify`, `self`, `content`, `place-*`), grid (`grid-cols/rows-N`, `col/row-span`, `col-start`, `grid-flow`), typography (sizes with paired line-heights, weights, families, align, color, `leading`, `tracking`, transform, decoration, `italic`, whitespace, `truncate`), colors (full v3 palette with 50–950 shades, `white`/`black`/`transparent`/`current`, `/NN` opacity), backgrounds (color, gradients via `bg-gradient-to-*` + `from/via/to`, size/position/repeat), borders (width, side widths, style, color), radius (all, sides, corners), shadows, opacity, transitions/duration/ease, and simple `scale`/`translate`/`rotate`.

### 4.4. Security rules
- No Tailwind runtime and no code execution. `tailwind.config` is read only when it is a static object literal (strings, numbers, booleans, objects, arrays). Functions, spreads, references, calls, or `__proto__` keys make the whole config unsupported, and it is reported. Only `theme.colors`, `theme.fontFamily`, and their `theme.extend` versions are applied; other keys are reported.
- Arbitrary values (`p-[13px]`, `bg-[#123456]`) are accepted only from a strict character allowlist (no quotes, braces, colons, `url(`, `var(`, `expression`), and must fit the property type (length or color).
- Every generated declaration goes through `isDangerousDeclaration` (the stylesheet pipeline's check), and the class is dropped and reported if any value fails.

### 4.5. Reporting
Unmapped classes (unknown utility, unsupported variant such as `dark:`/`group-hover:`, stacked responsive + state variants, unsafe value) are reported **once per class per import** as `CSS_UNSUPPORTED_SELECTOR` (severity `info`, `location.selector = .<class>`, `details: { source: 'tailwind', className, reason }`). We reuse the existing code instead of adding a new one, so the public diagnostic code list stays stable; `details.source` tells Tailwind entries apart. Config problems are reported as `CSS_UNSUPPORTED_PROPERTY` with `details.source = 'tailwind'`.

---

## 5. Consequences

### Positive Consequences
- The `ai-tailwind.html` fixture now imports with typography, colors, spacing, flex/grid layout, responsive overrides, and hover states, and its `div`s map to `flex`/`grid` and its CTA to `button`.
- The document stays portable: no class names, `--tw-*` variables, or Tailwind runtime remain (gradient variables are resolved by the cascade's custom-property support).
- Option B keeps working and takes precedence for any class it defines.

### Negative Consequences & Trade-offs
- Subset coverage: `ring-*`, `divide-*`, filters/backdrop, `animate-*`, `group-*`/`peer-*`, `dark:`, `before:`/`after:`, `first:`/`last:`, arbitrary properties, and plugin utilities are reported, not mapped.
- Transforms are not composed: `scale-105` and `-translate-y-1` on the same element override each other instead of combining.
- Responsive + state stacks (`md:hover:*`) are not supported because the cascade has no per-breakpoint state layer.
- KUBUILD breakpoints are coarser than Tailwind screens: `sm:` behaves like `md:`, and `xl:`/`2xl:` fold into desktop.
- The mapper follows Tailwind v3 defaults. `tailwind.config` theme extensions other than colors and fonts are ignored.

---

## 6. Action Items

- [x] `src/tailwind.ts` mapper, detection, static config reader (STORA-622).
- [x] Integration in `parseHtml` (detection) and `collectAndParseStylesheets` (rules).
- [x] Unit tests (`tests/tailwind.test.ts`) and updated `ai-tailwind.html` snapshot.
- [ ] Follow-up (optional): composed transforms, `ring-*`/`divide-*`, and per-breakpoint states once the schema supports them.
