# PRD — KUBUILD: AI Provider Embed & In-Editor Assistant

**Product:** KUBUILD  
**Codename:** BUILDER-01  
**Document Type:** Product Requirements Document (PRD Extension)  
**Feature Focus:** AI Provider Embedding (`@kubuild/ai`), In-Editor Chat Panel, Prompt-to-Page Generation with Progressive Streaming, Selection-Aware Ask & Enhance  
**Target Packages:** `@kubuild/ai`, `@kubuild/editor`, `@kubuild/react`  
**Status:** Approved / Ready for Implementation

---

## 1. Executive Summary & Vision

### 1.1 Problem Statement

1. Engine AI (`@kubuild/ai`) sudah lengkap — engine orkestrasi (`KubuildAiEngine`), 4 adapter provider (OpenAI, Anthropic, Gemini, custom/HTTP-generic), client SSE (`KubuildAiClient`), dan React hooks (`useAiGenerator`, `useAiChat`) — tapi belum tersambung ke UI editor sama sekali. Belum ada chat panel, belum ada jalur "generate lalu render", belum ada aksi berbasis selection.
2. User builder harus bisa membuat halaman lengkap hanya dari satu prompt teks tanpa kehilangan kemampuan edit manual yang sudah ada (drag-drop, inspector, style manager) — AI adalah assist, bukan pengganti jalur manual.
3. User yang sedang menyeleksi satu komponen di canvas ingin langsung bertanya ke AI tentang komponen itu, atau meminta AI memperbaiki/menyempurnakannya (*enhance*), tanpa harus menjelaskan ulang konteks komponen secara manual di setiap prompt.
4. Semua output AI adalah data tidak tepercaya (sama seperti file `.stora` yang diimpor) — harus lewat validasi dan command engine yang sama, tidak boleh menulis langsung ke document.

### 1.2 Product Vision

Menjadikan KUBUILD builder yang bisa "membangun dirinya sendiri lewat percakapan" tanpa mengorbankan prinsip inti: Document tetap satu-satunya source of truth, command engine tetap satu-satunya jalur mutasi, dan manual editing tetap selalu tersedia sebagai jalur utama tanpa AI.

### 1.3 Target Personas

1. **Page Creator** — non-technical user yang ingin memulai dari prompt kosong ("buatkan landing page untuk SaaS analytics") lalu menyempurnakan hasilnya secara visual.
2. **Power Editor** — user yang sudah punya halaman, menyeleksi satu section/komponen, dan memakai AI untuk mempercepat iterasi ("buat CTA ini lebih menonjol").
3. **Host App Developer** (Stora.page, dsb.) — developer yang menyuplai provider/API key/endpoint AI miliknya sendiri lewat config, tanpa `kubuild` pernah hardcode provider apa pun.

---

## 2. Arsitektur Integrasi AI

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      KUBUILD AI EMBED ARCHITECTURE                          │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. AI ENGINE & PROVIDER LAYER (@kubuild/ai) — sudah ada                     │
│    - KubuildAiEngine: generatePage / generateSection / refactorNode / chat  │
│    - Adapters: OpenAI, Anthropic, Gemini, Custom/Ollama (raw fetch)         │
│    - Normalizer: parse -> repair -> Zod validate -> security validate       │
│    - KubuildAiClient (SSE) + useAiGenerator/useAiChat hooks                 │
├─────────────────────────────────────────────────────────────────────────────┤
│ 2. INTEGRATION FOUNDATION (@kubuild/editor, @kubuild/react) — NEW           │
│    - AiEditorConfig: provider config, feature flags, default panel mode     │
│    - Bridge selectedNodeId + currentDocument dari EditorState ke AI context │
├─────────────────────────────────────────────────────────────────────────────┤
│ 3. IN-EDITOR CHAT PANEL (@kubuild/editor) — NEW                             │
│    - Panel docked/floating/hidden, mengikuti pola navigatorMode            │
│    - Message bubbles, active-context chip, toolbar toggle                   │
├─────────────────────────────────────────────────────────────────────────────┤
│ 4. PROMPT-TO-PAGE GENERATION (@kubuild/editor) — NEW                        │
│    - streamPage events -> insertNode per section lewat command engine      │
│    - Progressive preview, validasi/sanitasi sebelum dispatch, 1 undo entry  │
├─────────────────────────────────────────────────────────────────────────────┤
│ 5. SELECTION-AWARE ASK & ENHANCE (@kubuild/editor) — NEW                    │
│    - "Ask AI about this component" dari inspector/canvas                    │
│    - refactorNode -> diff preview (before/after) -> Apply/Discard           │
├─────────────────────────────────────────────────────────────────────────────┤
│ 6. STREAMING, SAFETY & PERSISTENCE HARDENING (@kubuild/ai) — NEW            │
│    - Token-level chat streaming, auth/rate-limit hook, chat history         │
│      storage adapter, security limit reuse dari .stora import              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Spesifikasi Detail Fitur

### 3.1 `AiEditorConfig` — config baru di `KubuildEditorProps`

```typescript
interface AiEditorConfig {
  /** Adapter provider AI, atau endpoint HTTP menuju createAiHandler milik consumer */
  provider: AiProviderAdapter | { endpoint: string; headers?: Record<string, string> };
  /** Feature flag per kapabilitas — default semua false bila config tidak diberikan */
  features?: {
    chat?: boolean;
    generate?: boolean;
    enhance?: boolean;
  };
  /** Mode panel default saat editor pertama kali dibuka */
  defaultPanelMode?: 'docked' | 'floating' | 'hidden';
  /** Prefix system prompt tambahan spesifik host (branding, tone, dsb.) */
  systemPromptPrefix?: string;
}
```

Konsisten dengan pola `registry` / `context` / `config` yang sudah ada di `KubuildEditorProps` — AI selalu opt-in, tidak pernah aktif secara default tanpa config eksplisit dari host.

### 3.2 Flow A — Prompt-to-Page Generation

```
User buka AI Chat Panel
  -> ketik "buatkan landing page untuk SaaS analytics"
  -> useAiGenerator.streamPage() jalan (plan section -> generate per section)
  -> tiap event `section` divalidasi (schema + security) lalu di-dispatch sebagai insertNode
  -> canvas preview update progresif, section demi section, memakai renderer yang sama
     dengan preview manual
  -> seluruh sesi generate tergabung jadi satu history entry
     (satu klik Undo = kosongkan semua hasil generate)
  -> user lanjut edit manual (drag, inspector, style) di atas hasil generate seperti biasa
```

### 3.3 Flow B — Selection-Aware Ask

```
User select node di canvas (selectedNodeId sudah ada di EditorState)
  -> buka AI Chat Panel, tanya "kenapa button ini gak menonjol?"
  -> AiChatRequest menyertakan selectedNodeId + snapshot props/styles ringkas node itu
  -> jawaban AI tampil di chat sebagai teks — TIDAK mengubah document
```

### 3.4 Flow C — Enhance Selected Component

```
User select node -> klik "Enhance with AI" (atau ketik instruksi di chat)
  -> useAiGenerator.refactorNode(node, instruksi) dipanggil
  -> hasil kandidat node divalidasi (schema + security, identity id/type dipertahankan)
  -> ditampilkan sebagai diff before/after di chat, dengan tombol Apply / Discard
  -> Apply -> dispatch ke command engine (updateNodeProps/updateNodeStyle atau
     replace-subtree) -> masuk history, bisa di-undo
  -> Discard -> tidak ada perubahan apa pun ke document atau history
```

### 3.5 Document Safety Pipeline

Semua output AI (generate, section, refactor) wajib melewati jalur yang sama dengan import `.stora` sebelum masuk document:

```
Raw LLM JSON -> extractJsonFromResponse -> normalizeNodeTree/normalizeStyles
             -> PageDocumentSchema / Node schema (Zod) validate
             -> validateDocumentSecurity (depth/count/size limit, no javascript: URI)
             -> Command Engine (insertNode/updateProps/updateStyle) -> Document -> History
```

Tidak ada jalur mutasi baru di luar command engine (`@kubuild/core`) — prinsip yang sama dengan invariant "Document is the source of truth".

### 3.6 Streaming & Chat Hardening — gap yang ditemukan di `@kubuild/ai`

- `chat()` saat ini single request/response, bukan token-level streaming — perlu ditingkatkan agar UX chat terasa realtime seperti `streamPage`.
- `AiChatResponse.suggestedAction` didefinisikan di tipe tapi tidak pernah diisi engine — perlu diputuskan: implementasi atau hapus dari tipe publik.
- `createAiHandler` tidak punya auth/rate-limit bawaan — perlu hook (`beforeRequest`) agar host bisa menolak request sebelum mencapai provider LLM.
- Chat history saat ini murni React state (`useAiChat`), hilang saat reload — perlu storage adapter opsional.
- Ada `console.log` debug tertinggal di `server/engine.ts` yang perlu digate ke opsi `debug`/`logger` yang sudah ada di constructor.

---

## 4. Kebutuhan Non-Fungsional (NFR)

1. **Document Integrity** — tidak ada mutasi document dari fitur AI yang terjadi di luar command engine `@kubuild/core`; setiap aksi AI yang mengubah document harus bisa di-undo.
2. **Opt-in by Default** — tanpa `AiEditorConfig` diberikan, `KubuildEditor` berjalan normal tanpa elemen AI apa pun terlihat (toolbar toggle, panel) — zero visual/behavioral impact ke consumer yang belum pakai AI.
3. **Dependency Direction** — hanya `@kubuild/editor` dan `@kubuild/react` yang boleh bergantung ke `@kubuild/ai`; `@kubuild/core` tidak pernah mengimpor `@kubuild/ai`, dan `@kubuild/ai` tidak pernah mengimpor `@kubuild/editor`/`@kubuild/react`.
4. **Provider-Agnostic & Host-Owned Secrets** — `kubuild` tidak pernah hardcode provider/API key; untuk provider berbayar, API key direkomendasikan diproxy lewat `createAiHandler` di backend host, tidak diletakkan di client-side config.
5. **Graceful Degradation** — kegagalan provider/network/validasi tidak boleh membuat editor crash; ditampilkan sebagai error state di chat atau diagnostic (`onDiagnostic`), bukan silent fail atau silent-inserted node.

---

## 5. Roadmap Rilis

- **Phase 1 (Sprint 1)** — Integration Foundation: dependency wiring, `AiEditorConfig`, bridge `selectedNodeId`/document ke AI context (EPIC-50).
- **Phase 2 (Sprint 2)** — In-Editor Chat Panel + Prompt-to-Page Generation: panel UI, streaming section-by-section insert, validasi/sanitasi, batch undo (EPIC-51, EPIC-52).
- **Phase 3 (Sprint 3)** — Selection-Aware Ask & Enhance: ask action, refactor wiring, diff preview, apply lewat command engine (EPIC-53).
- **Phase 4 (Sprint 4)** — Streaming & Chat Hardening, Safety/Rate-Limit/Persistence, Testing & Docs (EPIC-54, EPIC-55, EPIC-56).

Detail task per epic: lihat `docs/TASKS_AI_PROVIDER_EMBED.md`.
