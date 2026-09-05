# KUBUILD — Tasks & Jira Epics: AI Provider Embed & In-Editor Assistant

**Product:** KUBUILD  
**Codename:** BUILDER-01  
**Document Type:** Sprint & Backlog Tasks (Jira Format)  
**Feature Focus:** AI Provider Embedding (`@kubuild/ai`), In-Editor Chat Panel, Prompt-to-Page Generation, Selection-Aware Ask & Enhance, Streaming/Safety Hardening  
**Key Convention:** `STORA-500` s/d `STORA-524`  
**Status:** Ready for Sprint Planning

Referensi produk: `docs/PRD_AI_PROVIDER_EMBED.md`. `@kubuild/ai` (engine, adapters, client, react hooks) sudah ada sebagai package terpisah — epic-epic di bawah fokus mengintegrasikannya ke `@kubuild/editor`/`@kubuild/react` lewat command engine yang sudah ada, plus membereskan gap yang ditemukan di package tersebut.

---

## Ringkasan Epic & Alokasi Package

| Epic Key | Epic Name | Package Target | Jumlah Task |
| :--- | :--- | :--- | :--- |
| **EPIC-50** | AI Provider Integration Foundation | `@kubuild/editor`, `@kubuild/react` | 3 Tasks |
| **EPIC-51** | In-Editor AI Chat Panel | `@kubuild/editor` | 4 Tasks |
| **EPIC-52** | Prompt-to-Page Generation | `@kubuild/editor` | 4 Tasks |
| **EPIC-53** | Selection-Aware Ask & Enhance | `@kubuild/editor` | 4 Tasks |
| **EPIC-54** | Streaming & Chat Hardening | `@kubuild/ai` | 4 Tasks |
| **EPIC-55** | Safety, Rate-Limiting & Persistence | `@kubuild/ai` | 3 Tasks |
| **EPIC-56** | Testing & Reference Docs | `apps/stora-playground`, `docs` | 3 Tasks |

---

# Epic 50 — AI Provider Integration Foundation (`@kubuild/editor`, `@kubuild/react`)

### STORA-500
- **Epic:** AI Provider Integration Foundation
- **Task Key:** STORA-500
- **Type:** Task
- **Summary:** Tambahkan dependency `@kubuild/ai` ke `@kubuild/editor` dan `@kubuild/react`
- **Description:** Daftarkan `@kubuild/ai` (`./react` dan `./client` entry) sebagai dependency package `editor`, lalu re-export lewat `@kubuild/react`. Arah dependency baru (`editor -> ai`) tidak boleh melanggar aturan `no-restricted-imports` yang membatasi `core`; `@kubuild/ai` sendiri tetap hanya bergantung ke `core`/`schema`.
- **Priority:** Highest
- **Package:** `@kubuild/editor`, `@kubuild/react`
- **Dependencies:** None
- **Acceptance Criteria:**
  - `pnpm --filter @kubuild/editor build` sukses dengan `@kubuild/ai` sebagai dependency baru.
  - ESLint `no-restricted-imports` tetap lulus untuk `packages/core/**` (tidak ada import baru ke arah luar dari core).
  - `@kubuild/react` mengekspor ulang hooks `useAiGenerator`/`useAiChat` tanpa consumer perlu install `@kubuild/ai` terpisah.

### STORA-501
- **Epic:** AI Provider Integration Foundation
- **Task Key:** STORA-501
- **Type:** Story
- **Summary:** Definisikan `AiEditorConfig` mengikuti pola `EditorConfig` yang sudah ada
- **Description:** Tambahkan tipe config (provider adapter/endpoint, feature flag aktif/nonaktif per fitur AI, default panel mode) sebagai prop opsional baru di `KubuildEditorProps`, konsisten dengan pola `registry`/`context`/`config` yang sudah ada. Host (consumer) yang menyuplai provider/API key — editor tidak hardcode provider apa pun.
- **Priority:** Highest
- **Package:** `@kubuild/editor`
- **Dependencies:** STORA-500
- **Acceptance Criteria:**
  - `KubuildEditor` berjalan normal tanpa error saat prop AI config tidak diberikan (fitur AI default nonaktif/hidden).
  - Config AI mendukung setidaknya: aktif/nonaktif fitur chat, aktif/nonaktif fitur generate, dan default panel mode.
  - Tipe `AiEditorConfig` diekspor dari `@kubuild/editor` dan `@kubuild/react`.

### STORA-502
- **Epic:** AI Provider Integration Foundation
- **Task Key:** STORA-502
- **Type:** Task
- **Summary:** Sambungkan `selectedNodeId` dan snapshot document dari editor store ke context AI
- **Description:** Setiap request `useAiChat`/`useAiGenerator` yang dipicu dari dalam editor menyertakan `selectedNodeId` aktif dan document aktif (`AiChatRequest.currentDocument`/`selectedNodeId` sudah didukung tipe-nya di `@kubuild/ai`), tanpa menyalin logic store secara terpisah.
- **Priority:** High
- **Package:** `@kubuild/editor`
- **Dependencies:** STORA-500, STORA-501
- **Acceptance Criteria:**
  - Mengganti selection di canvas otomatis mengubah context yang dikirim ke chat berikutnya.
  - Snapshot document yang dikirim tidak menyertakan data sample/preview-only dari `variableCatalog`.
  - Unit test memverifikasi payload request berubah sesuai `selectedNodeId` saat ini.

---

# Epic 51 — In-Editor AI Chat Panel (`@kubuild/editor`)

### STORA-503
- **Epic:** In-Editor AI Chat Panel
- **Task Key:** STORA-503
- **Type:** Story
- **Summary:** Bangun AI Chat Panel dengan mode `docked | floating | hidden`
- **Description:** Panel baru mengikuti pola panel existing (`navigatorMode`, `tableSpreadsheetMode` di `EditorState`) — state `aiChatMode` baru di store, docked di sisi kanan/kiri atau floating di atas canvas seperti `TableSpreadsheetEditor`.
- **Priority:** Highest
- **Package:** `@kubuild/editor`
- **Dependencies:** STORA-501
- **Acceptance Criteria:**
  - Panel dapat di-toggle antara docked, floating, dan hidden tanpa reload editor.
  - Layout panel lain (inspector, layers, sidebar) tidak rusak saat AI Chat Panel docked bersamaan.
  - State panel tidak ikut ke dalam `PageDocument` (UI-only, sama seperti panel lain).

### STORA-504
- **Epic:** In-Editor AI Chat Panel
- **Task Key:** STORA-504
- **Type:** Task
- **Summary:** Tambah toggle "AI Chat" di toolbar dan `EditorToolbarConfig`
- **Description:** Tombol toolbar baru untuk membuka/menutup AI Chat Panel, dengan flag `showAiChatToggle` di `EditorToolbarConfig` mengikuti pola `showNavigatorToggle` yang sudah ada.
- **Priority:** Medium
- **Package:** `@kubuild/editor`
- **Dependencies:** STORA-503
- **Acceptance Criteria:**
  - Toggle hilang dari toolbar bila `showAiChatToggle: false` atau fitur AI nonaktif di `AiEditorConfig`.
  - Toggle mencerminkan state panel aktif (highlight saat panel terbuka).

### STORA-505
- **Epic:** In-Editor AI Chat Panel
- **Task Key:** STORA-505
- **Type:** Story
- **Summary:** UI riwayat pesan chat (bubble user/assistant, loading, error)
- **Description:** Render `messages` dari `useAiChat` sebagai bubble chat, termasuk state loading (indikator mengetik) dan error state (retry action) sesuai `cancel()`/error handling yang sudah ada di hook.
- **Priority:** High
- **Package:** `@kubuild/editor`
- **Dependencies:** STORA-503
- **Acceptance Criteria:**
  - Pesan user dan assistant terbedakan secara visual dan urut secara kronologis.
  - Error dari `useAiChat` (network/provider) tampil sebagai pesan error dengan opsi retry, bukan silent fail.
  - Loading state hilang otomatis begitu respons/stream selesai atau di-cancel.

### STORA-506
- **Epic:** In-Editor AI Chat Panel
- **Task Key:** STORA-506
- **Type:** Task
- **Summary:** Indikator context aktif di chat input ("membahas: #button-1")
- **Description:** Saat ada `selectedNodeId`, chat input menampilkan chip/badge node yang sedang jadi context, dengan opsi user melepas context tersebut sebelum mengirim pesan.
- **Priority:** Medium
- **Package:** `@kubuild/editor`
- **Dependencies:** STORA-502, STORA-505
- **Acceptance Criteria:**
  - Chip context hilang otomatis saat selection di canvas dikosongkan.
  - User dapat mengirim pesan tanpa context node (general question) meski ada selection aktif.

---

# Epic 52 — Prompt-to-Page Generation (`@kubuild/editor`)

### STORA-507
- **Epic:** Prompt-to-Page Generation
- **Task Key:** STORA-507
- **Type:** Story
- **Summary:** Wire `streamPage` ke command engine editor
- **Description:** Tiap `AiStreamEvent` bertipe `section` dari `useAiGenerator.streamPage` di-dispatch sebagai `insertNode` (lewat `dispatch`/`insertComponent` di store, bukan mutasi document langsung) ke document aktif, section demi section sesuai urutan datang.
- **Priority:** Highest
- **Package:** `@kubuild/editor`
- **Dependencies:** STORA-502
- **Acceptance Criteria:**
  - Prompt "buatkan landing page" menghasilkan document dengan minimal page -> section -> komponen anak, tervalidasi oleh `@kubuild/core`.
  - Setiap section yang gagal validasi tidak menghentikan section lain yang sudah berhasil di-generate (partial success, dilaporkan sebagai diagnostic).
  - Event `error` dari stream tidak meninggalkan document dalam state parsial yang invalid.

### STORA-508
- **Epic:** Prompt-to-Page Generation
- **Task Key:** STORA-508
- **Type:** Story
- **Summary:** Progressive preview saat generate berjalan
- **Description:** Canvas menampilkan placeholder loading untuk section yang sedang di-generate dan langsung merender section begitu event-nya masuk, memakai renderer yang sama dengan preview manual (bukan preview terpisah).
- **Priority:** High
- **Package:** `@kubuild/editor`
- **Dependencies:** STORA-507
- **Acceptance Criteria:**
  - User melihat halaman terbentuk bertahap, bukan menunggu semua section selesai baru muncul.
  - Placeholder loading hilang tanpa flicker begitu section asli ter-render.

### STORA-509
- **Epic:** Prompt-to-Page Generation
- **Task Key:** STORA-509
- **Type:** Task
- **Summary:** Validasi & sanitasi output AI sebelum dispatch ke document
- **Description:** Sebelum tiap node/section hasil AI di-dispatch, jalankan jalur yang sama dengan import `.stora`: schema validation (`PageDocumentSchema`/`normalizeAndValidate*` yang sudah ada di `@kubuild/ai`) plus `validateDocumentSecurity` dari `@kubuild/core`. Tidak ada node hasil AI yang masuk document tanpa lolos validasi ini.
- **Priority:** Highest
- **Package:** `@kubuild/editor`
- **Dependencies:** STORA-507
- **Acceptance Criteria:**
  - Node dengan prop/style yang tidak lolos schema ditolak dan dilaporkan sebagai diagnostic ke host (`onDiagnostic`), bukan silent-inserted.
  - Security limit yang sama dengan import (depth, jumlah node, dsb.) berlaku juga untuk output generate AI.
  - Test mereproduksi payload AI malformed (missing id, flat style vs breakpoint object) dan memverifikasi normalizer membetulkannya atau menolaknya dengan jelas.

### STORA-510
- **Epic:** Prompt-to-Page Generation
- **Task Key:** STORA-510
- **Type:** Task
- **Summary:** Generate sebagai satu batch history entry yang bisa di-undo sekali klik
- **Description:** Seluruh section yang masuk dari satu sesi `streamPage` tergabung jadi satu grup di `DocumentHistoryManager`, sehingga satu kali `undo()` mengembalikan document ke kondisi sebelum generate, bukan meng-undo section satu per satu.
- **Priority:** High
- **Package:** `@kubuild/editor`
- **Dependencies:** STORA-507
- **Acceptance Criteria:**
  - Setelah generate multi-section, satu kali klik Undo mengosongkan seluruh hasil generate.
  - `canUndo`/`canRedo` tetap konsisten dengan aksi manual yang dilakukan setelah generate.

---

# Epic 53 — Selection-Aware Ask & Enhance (`@kubuild/editor`)

### STORA-511
- **Epic:** Selection-Aware Ask & Enhance
- **Task Key:** STORA-511
- **Type:** Task
- **Summary:** Aksi "Ask AI about this component" dari inspector/canvas
- **Description:** Tombol/menu di `InspectorPanel` atau floating badge canvas yang membuka AI Chat Panel dengan context node terpilih sudah ter-attach (lihat STORA-506), tanpa user perlu mengetik ulang identitas node.
- **Priority:** High
- **Package:** `@kubuild/editor`
- **Dependencies:** STORA-505, STORA-506
- **Acceptance Criteria:**
  - Klik aksi ini membuka panel (jika tertutup) dan mem-fokus chat input dengan context node sudah terpasang.
  - Aksi tidak tersedia saat tidak ada node terpilih atau fitur AI nonaktif di config.

### STORA-512
- **Epic:** Selection-Aware Ask & Enhance
- **Task Key:** STORA-512
- **Type:** Story
- **Summary:** Wire `refactorNode` untuk instruksi enhance dari node terpilih
- **Description:** Instruksi user ("buat lebih menonjol", "ubah jadi gaya minimalis") dikirim ke `useAiGenerator.refactorNode` bersama node dan context document, menghasilkan kandidat node baru tanpa langsung mengubah document.
- **Priority:** Highest
- **Package:** `@kubuild/editor`
- **Dependencies:** STORA-502, STORA-511
- **Acceptance Criteria:**
  - Hasil `refactorNode` tervalidasi lewat jalur yang sama seperti STORA-509 sebelum ditampilkan sebagai kandidat.
  - Node asli tidak berubah sampai user secara eksplisit meng-apply hasilnya (lihat STORA-514).

### STORA-513
- **Epic:** Selection-Aware Ask & Enhance
- **Task Key:** STORA-513
- **Type:** Story
- **Summary:** Diff preview before/after untuk hasil enhance di chat
- **Description:** Tampilkan perbandingan ringkas (props/styles yang berubah) antara node asli dan kandidat hasil AI langsung di dalam chat, dengan tombol **Apply** dan **Discard**.
- **Priority:** High
- **Package:** `@kubuild/editor`
- **Dependencies:** STORA-512
- **Acceptance Criteria:**
  - Diff menyoroti field yang berubah saja (bukan dump seluruh objek node).
  - Discard tidak meninggalkan jejak apa pun di document atau history.

### STORA-514
- **Epic:** Selection-Aware Ask & Enhance
- **Task Key:** STORA-514
- **Type:** Task
- **Summary:** Apply hasil enhance lewat command engine
- **Description:** Tombol Apply memanggil `updateNodeProps`/`updateNodeStyle` (atau command replace-subtree baru jika struktur berubah) di store editor — path yang sama persis dengan edit manual — sehingga tercatat di `DocumentHistoryManager`.
- **Priority:** Highest
- **Package:** `@kubuild/editor`
- **Dependencies:** STORA-513
- **Acceptance Criteria:**
  - Setelah Apply, `undo()` mengembalikan node ke kondisi sebelum enhance.
  - Apply gagal (mis. validasi prop registry gagal) menampilkan error yang sama formatnya dengan `formatCommandError` yang sudah ada, tidak crash editor.

---

# Epic 54 — Streaming & Chat Hardening (`@kubuild/ai`)

### STORA-515
- **Epic:** Streaming & Chat Hardening
- **Task Key:** STORA-515
- **Type:** Story
- **Summary:** Implementasikan token-level streaming untuk `chat()`
- **Description:** `KubuildAiEngine.chat()` saat ini single request/response. Tambahkan varian streaming (`chatStream()` atau `stream: true` pada `chat()`) yang meneruskan `stream: true` ke adapter provider (OpenAI/Anthropic/Gemini) dan meng-emit token/partial chunk lewat mekanisme SSE yang sama dengan `streamPage`.
- **Priority:** High
- **Package:** `@kubuild/ai`
- **Dependencies:** None
- **Acceptance Criteria:**
  - Response chat tampil progresif (token/partial chunk), bukan menunggu jawaban penuh.
  - Adapter yang belum mendukung streaming di level API fallback ke non-streaming tanpa error.
  - Test menutupi partial-chunk parsing di `KubuildAiClient` untuk mode chat.

### STORA-516
- **Epic:** Streaming & Chat Hardening
- **Task Key:** STORA-516
- **Type:** Task
- **Summary:** Update `useAiChat` untuk konsumsi stream dan render partial response realtime
- **Description:** Hook `useAiChat` menambah dukungan callback partial-token (mirip `AiStreamCallbacks` di `useAiGenerator`), dan AI Chat Panel (STORA-505) merender token yang masuk secara realtime ke bubble assistant yang sedang aktif.
- **Priority:** High
- **Package:** `@kubuild/ai`
- **Dependencies:** STORA-515, STORA-505
- **Acceptance Criteria:**
  - Bubble assistant ter-update per chunk tanpa re-render seluruh riwayat chat.
  - `cancel()` yang sudah ada tetap berfungsi menghentikan stream chat yang sedang berjalan.

### STORA-517
- **Epic:** Streaming & Chat Hardening
- **Task Key:** STORA-517
- **Type:** Task
- **Summary:** Putuskan nasib `AiChatResponse.suggestedAction` (implement atau hapus)
- **Description:** Field ini sudah ada di tipe tapi tidak pernah diisi oleh engine. Keputusan produk: implementasikan (mis. AI dapat menyarankan aksi "generate section baru" langsung dari chat) atau hapus dari tipe publik untuk mencegah consumer bergantung pada field yang selalu kosong.
- **Priority:** Medium
- **Package:** `@kubuild/ai`
- **Dependencies:** None
- **Acceptance Criteria:**
  - Jika diimplementasi: minimal satu jenis `suggestedAction` (mis. "insert section ini ke document") dapat di-trigger dari chat panel lewat command engine.
  - Jika dihapus: tidak ada breaking change diam-diam — dicatat di changelog `@kubuild/ai`.

### STORA-518
- **Epic:** Streaming & Chat Hardening
- **Task Key:** STORA-518
- **Type:** Task
- **Summary:** Bersihkan `console.log` debug di `server/engine.ts`
- **Description:** Beberapa `console.log` tertinggal di `KubuildAiEngine` (generatePage/streamPage/chat) tidak digate oleh opsi `debug`/`logger` yang sudah ada di constructor. Rapikan agar semua logging lewat `logger` yang dikonfigurasi, senyap secara default.
- **Priority:** Medium
- **Package:** `@kubuild/ai`
- **Dependencies:** None
- **Acceptance Criteria:**
  - Tidak ada `console.log` langsung tersisa di `packages/ai/src/server/engine.ts`.
  - Log tetap dapat diaktifkan lewat opsi `debug: true` atau `logger` custom untuk kebutuhan development.

---

# Epic 55 — Safety, Rate-Limiting & Persistence (`@kubuild/ai`)

### STORA-519
- **Epic:** Safety, Rate-Limiting & Persistence
- **Task Key:** STORA-519
- **Type:** Task
- **Summary:** Sediakan hook auth/rate-limit di `createAiHandler`
- **Description:** `createAiHandler` saat ini tidak punya auth/rate-limiting bawaan. Tambahkan opsi middleware/hook (mis. `beforeRequest`) yang dipanggil sebelum request diteruskan ke engine, supaya host dapat menyisipkan auth/rate-limit sendiri tanpa fork handler.
- **Priority:** High
- **Package:** `@kubuild/ai`
- **Dependencies:** None
- **Acceptance Criteria:**
  - Host dapat menolak request (mis. 401/429) sebelum mencapai provider LLM lewat hook ini.
  - Tanpa hook diisi, behavior handler tetap backward-compatible dengan sebelumnya.

### STORA-520
- **Epic:** Safety, Rate-Limiting & Persistence
- **Task Key:** STORA-520
- **Type:** Story
- **Summary:** Persist riwayat chat per document lewat storage adapter opsional
- **Description:** `useAiChat` saat ini murni React state, hilang saat reload. Sediakan interface storage adapter opsional (`loadHistory`/`saveHistory`) yang host dapat implementasikan (localStorage, backend Stora.page, dsb.) tanpa `@kubuild/ai` bergantung ke storage tertentu.
- **Priority:** Medium
- **Package:** `@kubuild/ai`
- **Dependencies:** STORA-505
- **Acceptance Criteria:**
  - Tanpa adapter diisi, behavior tetap seperti sekarang (in-memory saja).
  - Dengan adapter contoh (localStorage) di playground, riwayat chat bertahan setelah reload halaman.

### STORA-521
- **Epic:** Safety, Rate-Limiting & Persistence
- **Task Key:** STORA-521
- **Type:** Task
- **Summary:** Terapkan security limit yang sama dengan import `.stora` pada output generate AI
- **Description:** Reuse `validateDocumentSecurity` (depth limit, node count limit, payload size) dari `@kubuild/core` untuk memvalidasi setiap document/section hasil AI sebelum dispatch — mencegah prompt yang menghasilkan tree raksasa atau nested-loop merusak editor.
- **Priority:** Highest
- **Package:** `@kubuild/ai`
- **Dependencies:** STORA-509
- **Acceptance Criteria:**
  - Prompt yang secara sengaja diarahkan menghasilkan tree sangat dalam/lebar ditolak dengan diagnostic yang jelas, bukan membuat editor freeze.
  - Limit yang dipakai identik (bukan duplikat terpisah) dengan limit import `.stora` yang sudah ada.

---

# Epic 56 — Testing & Reference Docs (`apps/stora-playground`, `docs`)

### STORA-522
- **Epic:** Testing & Reference Docs
- **Task Key:** STORA-522
- **Type:** Test
- **Summary:** E2E: prompt kosong -> generate -> edit manual -> tetap valid
- **Description:** Test mereproduksi Flow A dari `docs/PRD_AI_PROVIDER_EMBED.md` §3.2: mulai dari blank document, generate lewat prompt, lalu lakukan edit manual (drag/insert/update style) di atas hasil generate, pastikan document tetap valid sepanjang jalur.
- **Priority:** High
- **Package:** `apps/stora-playground`
- **Dependencies:** STORA-507, STORA-509, STORA-510
- **Acceptance Criteria:**
  - Test lulus tanpa mock command engine — memakai command engine `@kubuild/core` yang sesungguhnya.
  - Document hasil akhir lulus `validateDocument`.

### STORA-523
- **Epic:** Testing & Reference Docs
- **Task Key:** STORA-523
- **Type:** Test
- **Summary:** E2E: select -> ask -> enhance -> apply -> undo
- **Description:** Test mereproduksi Flow B dan C dari `docs/PRD_AI_PROVIDER_EMBED.md` §3.3/§3.4 end-to-end: select node, tanya AI, minta enhance, apply hasilnya, lalu undo — memverifikasi node kembali ke kondisi semula persis.
- **Priority:** High
- **Package:** `apps/stora-playground`
- **Dependencies:** STORA-512, STORA-514
- **Acceptance Criteria:**
  - Setelah undo, node identik (deep-equal) dengan kondisi sebelum enhance.
  - Discard (tanpa apply) tidak meninggalkan entry apa pun di history undo/redo.

### STORA-524
- **Epic:** Testing & Reference Docs
- **Task Key:** STORA-524
- **Type:** Task
- **Summary:** Dokumentasikan integrasi AI provider untuk consumer
- **Description:** Tulis quickstart untuk consumer (mis. Stora.page): cara menyuplai provider/API key lewat `AiEditorConfig`, shape config, catatan keamanan (API key tidak boleh exposed ke client bila memakai provider berbayar langsung, disarankan lewat backend proxy `createAiHandler`).
- **Priority:** Medium
- **Package:** `docs`
- **Dependencies:** STORA-501, STORA-519
- **Acceptance Criteria:**
  - Quickstart mencakup contoh minimal: aktifkan AI chat + generate di `KubuildEditor` dengan satu provider.
  - Dokumentasi eksplisit menyatakan API key provider tidak boleh diletakkan di client-side config secara langsung untuk provider berbayar; jalur yang direkomendasikan adalah proxy lewat `createAiHandler` di server consumer.
