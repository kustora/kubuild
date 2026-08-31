# KUBUILD — Tasks & Jira Epics: Advanced Action & Form Input System

**Product:** KUBUILD  
**Codename:** BUILDER-01  
**Document Type:** Sprint & Backlog Tasks (Jira Format)  
**Feature Focus:** Action Pipelines, Event Triggers, Form State Management, Multi-Field Validation Engine, API & Webhook Handlers, UI Feedback (Toasts, Modals), and Visual Action Builder  
**Key Convention:** `STORA-30X` s/d `STORA-35X`  
**Status:** Ready for Sprint Planning  

---

## Ringkasan Epic & Alokasi Package

| Epic Key | Epic Name | Package Target | Jumlah Task |
| :--- | :--- | :--- | :--- |
| **EPIC-30** | Action & Form Schema Extensions | `@kubuild/schema` | 5 Tasks |
| **EPIC-31** | Core Evaluation & Action Pipeline Engine | `@kubuild/core` | 6 Tasks |
| **EPIC-32** | Form Runtime Context & Action Runners | `@kubuild/renderer` | 6 Tasks |
| **EPIC-33** | Form Input Components & Rich Traits | `@kubuild/components` | 6 Tasks |
| **EPIC-34** | Visual Action Builder & Form Inspector UI | `@kubuild/editor` | 7 Tasks |
| **EPIC-35** | Form Templates & Playground Verification | `apps/stora-playground`, `docs` | 4 Tasks |

---

# Epic 30 — Action & Form Schema Extensions (`@kubuild/schema`)

### STORA-300
- **Epic:** Action & Form Schema Extensions
- **Task Key:** STORA-300
- **Type:** Story
- **Summary:** Definisikan Schema Zod untuk Action Pipeline & Step Types
- **Description:** Buat tipe dan schema Zod untuk `ActionPipelineSchema`, `ActionStepSchema`, dan `ActionTriggerType` (`click`, `submit`, `change`, `blur`, `focus`, `load`). Step types meliputi `api_request`, `navigate`, `set_state`, `reset_form`, `show_toast`, `open_modal`, `close_modal`, `copy_clipboard`, `custom_event`.
- **Priority:** Highest
- **Package:** `@kubuild/schema`
- **Dependencies:** None
- **Acceptance Criteria:**
  - File `packages/schema/src/actions.ts` mengekspor schema validasi Zod lengkap dan TypeScript types untuk Action Pipelines & Steps.
  - Unit tests memverifikasi parsing payload valid dan penolakan payload berbahaya/invalid.

### STORA-301
- **Epic:** Action & Form Schema Extensions
- **Task Key:** STORA-301
- **Type:** Story
- **Summary:** Definisikan Schema Zod untuk Validation Rules & Form Field Binding
- **Description:** Buat schema Zod `ValidationRuleSchema` (mendukung `required`, `email`, `url`, `min_length`, `max_length`, `numeric_min`, `numeric_max`, `pattern`, `match_field`) dan `FormFieldBindingSchema` (field `name`, `label`, `defaultValue`, `rules`, `validateOn`).
- **Priority:** Highest
- **Package:** `@kubuild/schema`
- **Dependencies:** None
- **Acceptance Criteria:**
  - File `packages/schema/src/form.ts` mengekspor schema Zod dan types untuk validasi form field.
  - Menghasilkan tipe TypeScript inferensial yang siap dipakai di `@kubuild/core` dan `@kubuild/renderer`.

### STORA-302
- **Epic:** Action & Form Schema Extensions
- **Task Key:** STORA-302
- **Type:** Story
- **Summary:** Integrasikan Action Pipeline & Form Config ke dalam `NodeSchema`
- **Description:** Tambahkan field opsional `actions?: ActionPipeline[]` dan `formConfig?: FormConfig` pada `NodeSchema` tanpa memutus backward compatibility dengan `ActionBindingSchema` yang sudah ada.
- **Priority:** High
- **Package:** `@kubuild/schema`
- **Dependencies:** STORA-300, STORA-301
- **Acceptance Criteria:**
  - `NodeSchema` dapat memvalidasi dokumen yang memuat node dengan multi-step `actions` dan konfigurasi `formConfig`.
  - Dokumen legacy v1.0.0 tetap valid dan dapat di-parse dengan sempurna.

### STORA-303
- **Epic:** Action & Form Schema Extensions
- **Task Key:** STORA-303
- **Type:** Story
- **Summary:** Buat Type Guards & Utility Sanitasi Action Data
- **Description:** Implementasikan fungsi type guard `isActionPipeline`, `isActionStep`, `isFormFieldBinding`, serta sanitizer untuk membersihkan nilai injection atau URL berbahaya pada payload action.
- **Priority:** Medium
- **Package:** `@kubuild/schema`
- **Dependencies:** STORA-300, STORA-301
- **Acceptance Criteria:**
  - Type guard aman dan lulus pengujian unit test.

### STORA-304
- **Epic:** Action & Form Schema Extensions
- **Task Key:** STORA-304
- **Type:** Task
- **Summary:** Unit Tests & JSON Schema Export untuk Action & Form
- **Description:** Buat rangkaian test komprehensif di `packages/schema/tests/actions.test.ts` dan perbarui generator JSON Schema agar tool eksternal dapat memvalidasi dokumen yang memiliki action pipelines.
- **Priority:** Medium
- **Package:** `@kubuild/schema`
- **Dependencies:** STORA-300, STORA-301, STORA-302
- **Acceptance Criteria:**
  - Coverage 100% pada modul schema actions dan form.

---

# Epic 31 — Core Evaluation & Action Pipeline Engine (`@kubuild/core`)

### STORA-310
- **Epic:** Core Evaluation & Action Pipeline Engine
- **Task Key:** STORA-310
- **Type:** Story
- **Summary:** Implementasikan Template & Expression Variable Interpolator
- **Description:** Bangun utility aman untuk melakukan resolusi template string seperti `{{form.email}}`, `{{variables.token}}`, dan `{{response.data.id}}` ke dalam objek target tanpa menggunakan `eval()` atau `Function()`.
- **Priority:** Highest
- **Package:** `@kubuild/core`
- **Dependencies:** STORA-300
- **Acceptance Criteria:**
  - Mendukung akses nested property (e.g. `{{form.user.profile.name}}`).
  - Mengembalikan fallback string kosong jika key tidak ditemukan tanpa melempar runtime exception.

### STORA-311
- **Epic:** Core Evaluation & Action Pipeline Engine
- **Task Key:** STORA-311
- **Type:** Story
- **Summary:** Bangun Evaluator Aturan Validasi Form (`ValidationEngine`)
- **Description:** Implementasikan engine validasi sinkron & asinkron yang mengevaluasi nilai field terhadap array `ValidationRule` (Required, Email pattern, Min/Max Length, Regex, Numeric bounds, Match Field).
- **Priority:** Highest
- **Package:** `@kubuild/core`
- **Dependencies:** STORA-301
- **Acceptance Criteria:**
  - Fungsi `validateFieldValue(value, rules, allFormValues)` mengembalikan pesan error pertama yang gagal atau `null` jika valid.
  - Fungsi `validateForm(values, fieldConfigs)` mengembalikan map `Record<string, string>` berisi error semua field.

### STORA-312
- **Epic:** Core Evaluation & Action Pipeline Engine
- **Task Key:** STORA-312
- **Type:** Story
- **Summary:** Bangun Action Pipeline Execution Engine (`ActionPipelineExecutor`)
- **Description:** Buat engine eksekusi pipeline yang mendukung eksekusi berurutan (sequential), timeout, cancellation, evaluasi kondisi (`condition`), dan percabangan `onSuccess` / `onError`.
- **Priority:** Highest
- **Package:** `@kubuild/core`
- **Dependencies:** STORA-300, STORA-310
- **Acceptance Criteria:**
  - Step berikutnya menerima context respon dari step sebelumnya.
  - Kegagalan step (throw error) memicu eksekusi branch `onError` jika didefinisikan.

### STORA-313
- **Epic:** Core Evaluation & Action Pipeline Engine
- **Task Key:** STORA-313
- **Type:** Story
- **Summary:** Implementasikan Conditional Logic Resolver
- **Description:** Buat evaluator kondisi untuk operator: `equals`, `not_equals`, `contains`, `is_truthy`, `is_falsy`, `gt`, `lt`, `regex`.
- **Priority:** High
- **Package:** `@kubuild/core`
- **Dependencies:** STORA-300
- **Acceptance Criteria:**
  - Menghasilkan boolean hasil evaluasi kondisi secara akurat untuk berbagai tipe data (string, number, boolean, array).

### STORA-314
- **Epic:** Core Evaluation & Action Pipeline Engine
- **Task Key:** STORA-314
- **Type:** Story
- **Summary:** State Store & Context Manager untuk Form & Runtime Variables
- **Description:** Sediakan class / helper untuk mengelola runtime state document yang reaktif, mendukung subscribe/unsubscribe listener saat variable berubah.
- **Priority:** High
- **Package:** `@kubuild/core`
- **Dependencies:** None
- **Acceptance Criteria:**
  - Memungkinkan penyimpanan dan update state lokal yang terisolasi per halaman atau form.

### STORA-315
- **Epic:** Core Evaluation & Action Pipeline Engine
- **Task Key:** STORA-315
- **Type:** Task
- **Summary:** Unit Tests untuk Evaluator & Pipeline Engine
- **Description:** Buat unit tests untuk menguji skenario pipeline kompleks: request API berhasil -> eksekusi toast & navigate; request API gagal -> eksekusi error toast; validasi form multi-field.
- **Priority:** Medium
- **Package:** `@kubuild/core`
- **Dependencies:** STORA-310, STORA-311, STORA-312
- **Acceptance Criteria:**
  - Semua skenario pipeline dan validasi lulus tes dengan status hijau.

---

# Epic 32 — Form Runtime Context & Action Runners (`@kubuild/renderer`)

### STORA-320
- **Epic:** Form Runtime Context & Action Runners
- **Task Key:** STORA-320
- **Type:** Story
- **Summary:** Implementasikan `FormRuntimeContext` & React Context Provider
- **Description:** Bangun React Context untuk membungkus form node yang mengelola `values`, `errors`, `touched`, `isSubmitting`, `isValid`, serta menyediakan callback `setFieldValue`, `setFieldTouched`, `handleFormSubmit`, dan `resetForm`.
- **Priority:** Highest
- **Package:** `@kubuild/renderer`
- **Dependencies:** STORA-311, STORA-312
- **Acceptance Criteria:**
  - Setiap input di dalam container `<form>` dapat membaca dan mengupdate state form secara reaktif.

### STORA-321
- **Epic:** Form Runtime Context & Action Runners
- **Task Key:** STORA-321
- **Type:** Story
- **Summary:** Implementasikan Built-in Action Runner: `api_request`
- **Description:** Implementasikan handler `api_request` yang melakukan HTTP call (`fetch`) dengan parameter method (GET/POST/PUT/DELETE), headers, body payload (JSON / FormData / URL-encoded), query params, dan timeout handling.
- **Priority:** Highest
- **Package:** `@kubuild/renderer`
- **Dependencies:** STORA-312
- **Acceptance Criteria:**
  - Berhasil mengirimkan request ke endpoint eksternal, menginterpolasi data form ke dalam payload/URL, dan mengembalikan status serta response body.

### STORA-322
- **Epic:** Form Runtime Context & Action Runners
- **Task Key:** STORA-322
- **Type:** Story
- **Summary:** Implementasikan Built-in Action Runners: UI Feedback (`show_toast`, `open_modal`, `close_modal`)
- **Description:** Buat UI toast container bawaan yang responsif dan handler untuk memunculkan notifikasi toast (`success`, `error`, `info`, `warning`) serta kontrol buka/tutup modal berdasarkan target `modalNodeId`.
- **Priority:** High
- **Package:** `@kubuild/renderer`
- **Dependencies:** STORA-312
- **Acceptance Criteria:**
  - Toast muncul di pojok layar dengan animasi halus dan auto-dismiss.
  - Action `open_modal` mengubah visibility state modal terkait.

### STORA-323
- **Epic:** Form Runtime Context & Action Runners
- **Task Key:** STORA-323
- **Type:** Story
- **Summary:** Implementasikan Built-in Action Runners: Navigation & Utilities (`navigate`, `copy_clipboard`, `reset_form`)
- **Description:** Implementasikan runner untuk:
  - `navigate`: URL redirect, smooth scroll to anchor `#id`, open new tab.
  - `copy_clipboard`: Menyalin string atau nilai variabel ke clipboard user dengan notifikasi fallback.
  - `reset_form`: Mengembalikan nilai semua input dalam form ke default.
- **Priority:** High
- **Package:** `@kubuild/renderer`
- **Dependencies:** STORA-312
- **Acceptance Criteria:**
  - Navigasi anchor dan URL eksternal berfungsi dengan baik.

### STORA-324
- **Epic:** Form Runtime Context & Action Runners
- **Task Key:** STORA-324
- **Type:** Story
- **Summary:** Integrasikan Action Dispatcher ke dalam Renderer Nodes
- **Description:** Update komponen renderer dasar (Button, Link, Form, Input) agar memicu `executeActionPipeline` saat event trigger terjadi (`onClick`, `onSubmit`, `onChange`, `onBlur`).
- **Priority:** Highest
- **Package:** `@kubuild/renderer`
- **Dependencies:** STORA-320, STORA-321, STORA-322
- **Acceptance Criteria:**
  - Mengklik tombol submit otomatis memvalidasi seluruh field form terlebih dahulu; jika valid, menjalankan pipeline aksi.

### STORA-325
- **Epic:** Form Runtime Context & Action Runners
- **Task Key:** STORA-325
- **Type:** Task
- **Summary:** Error Boundary & Safe Execution Handler
- **Description:** Pastikan kegagalan jaringan atau parsing respon tidak menyebabkan React canvas crash, melainkan menampilkan status error di console diagnostic / onDiagnostic callback.
- **Priority:** Medium
- **Package:** `@kubuild/renderer`
- **Dependencies:** STORA-320
- **Acceptance Criteria:**
  - Zero unhandled crash saat API offline atau mengembalikan status 500.

---

# Epic 33 — Form Input Components & Rich Traits (`@kubuild/components`)

### STORA-330
- **Epic:** Form Input Components & Rich Traits
- **Task Key:** STORA-330
- **Type:** Story
- **Summary:** Perbarui Komponen Semantik `form` dengan Form Trait & Action Binding
- **Description:** Tambahkan definisi traits untuk komponen `form`: action URL, method, prevent default, auto-scroll to error, dan konfigurasi reset on submit.
- **Priority:** Highest
- **Package:** `@kubuild/components`
- **Dependencies:** STORA-301
- **Acceptance Criteria:**
  - Komponen `form` mengekspos trait group `Form` yang lengkap di registry.

### STORA-331
- **Epic:** Form Input Components & Rich Traits
- **Task Key:** STORA-331
- **Type:** Story
- **Summary:** Implementasikan Definisi & Traits `input-text`, `input-number`, `input-password`
- **Description:** Buat definisi trait untuk input teks: `name` (binding key), `placeholder`, `defaultValue`, `required`, `pattern`, `minLength`, `maxLength`, prefix icon, suffix icon, dan helper text.
- **Priority:** Highest
- **Package:** `@kubuild/components`
- **Dependencies:** STORA-301
- **Acceptance Criteria:**
  - Input dapat diatur tipe, batasan panjang, dan pesan errornya secara visual.

### STORA-332
- **Epic:** Form Input Components & Rich Traits
- **Task Key:** STORA-332
- **Type:** Story
- **Summary:** Implementasikan Definisi & Traits `textarea` & `select`
- **Description:** Sediakan komponen `textarea` (rows, resize, auto-grow, max char count) dan `select` (options list: label & value, placeholder, default selected).
- **Priority:** High
- **Package:** `@kubuild/components`
- **Dependencies:** STORA-301
- **Acceptance Criteria:**
  - Opsi dropdown dapat diedit via inspector trait list.

### STORA-333
- **Epic:** Form Input Components & Rich Traits
- **Task Key:** STORA-333
- **Type:** Story
- **Summary:** Implementasikan Definisi & Traits `checkbox`, `switch`, `radio-group`
- **Description:** Sediakan komponen kontrol boolean (`checkbox`, `switch`) dan pilihan tunggal (`radio-group` dengan `radio-item` child).
- **Priority:** High
- **Package:** `@kubuild/components`
- **Dependencies:** STORA-301
- **Acceptance Criteria:**
  - Checkbox dan radio terikat dengan benar ke nilai form runtime boolean atau string.

### STORA-334
- **Epic:** Form Input Components & Rich Traits
- **Task Key:** STORA-334
- **Type:** Story
- **Summary:** Implementasikan Komponen `file-upload` & `button-submit`
- **Description:**
  - `file-upload`: Menerima tipe file (accept), max size, multiple upload, dan preview tampilan.
  - `button-submit`: Menampilkan loading spinner otomatis saat form sedang dalam status `isSubmitting`.
- **Priority:** High
- **Package:** `@kubuild/components`
- **Dependencies:** STORA-301
- **Acceptance Criteria:**
  - Tombol submit beralih ke state loading dan ter-disable saat proses pengiriman.

### STORA-335
- **Epic:** Form Input Components & Rich Traits
- **Task Key:** STORA-335
- **Type:** Task
- **Summary:** Unit Tests Komponen Form di Component Registry
- **Description:** Verifikasi bahwa semua komponen form terdaftar dengan benar di `ComponentRegistry`, memiliki icon yang representatif, dan default styles yang menarik.
- **Priority:** Medium
- **Package:** `@kubuild/components`
- **Dependencies:** STORA-330 s/d STORA-334
- **Acceptance Criteria:**
  - 100% komponen form lolos registry validation test.

---

# Epic 34 — Visual Action Builder & Form Inspector UI (`@kubuild/editor`)

### STORA-340
- **Epic:** Visual Action Builder & Form Inspector UI
- **Task Key:** STORA-340
- **Type:** Story
- **Summary:** Bangun Komponen Visual Action Builder Modal / Flyout
- **Description:** Buat dialog modal atau panel khusus untuk mengonfigurasi interaktivitas elemen:
  - Trigger Selector (`On Click`, `On Submit`, `On Change`, dll.).
  - Action Timeline (daftar langkah aksi yang tersusun rapi).
  - Tombol ➕ Add Action Step.
- **Priority:** Highest
- **Package:** `@kubuild/editor`
- **Dependencies:** STORA-300, STORA-302
- **Acceptance Criteria:**
  - User dapat membuka Action Builder dari tombol di inspector panel elemen mana pun.

### STORA-341
- **Epic:** Visual Action Builder & Form Inspector UI
- **Task Key:** STORA-341
- **Type:** Story
- **Summary:** Bangun Form Konfigurasi Parameter untuk Setiap Action Step
- **Description:** Buat form dinamis yang berubah sesuai tipe step yang dipilih:
  - `api_request`: Method dropdown, URL input dengan chip variable, Headers key-value editor, Body payload editor.
  - `show_toast`: Type selector (success/error/info/warning), Message input, Duration slider.
  - `navigate`: Target URL, Anchor ID picker, Open in new tab toggle.
  - `open_modal` / `close_modal`: Target modal selector dari daftar node modal di dokumen.
- **Priority:** Highest
- **Package:** `@kubuild/editor`
- **Dependencies:** STORA-340
- **Acceptance Criteria:**
  - Setiap step memiliki form input yang bersih, intuitif, dan langsung memperbarui props node.

### STORA-342
- **Epic:** Visual Action Builder & Form Inspector UI
- **Task Key:** STORA-342
- **Type:** Story
- **Summary:** Implementasikan Visual Branching Editor (`On Success` & `On Error`)
- **Description:** Tambahkan blok UI di dalam card step `api_request` untuk menambahkan sub-steps yang dijalankan saat respon sukses atau gagal.
- **Priority:** High
- **Package:** `@kubuild/editor`
- **Dependencies:** STORA-341
- **Acceptance Criteria:**
  - Tampilan visual hierarki cabang sukses/gagal yang mudah dipahami oleh non-programmer.

### STORA-343
- **Epic:** Visual Action Builder & Form Inspector UI
- **Task Key:** STORA-343
- **Type:** Story
- **Summary:** Implementasikan Variable Chip / Autocomplete Picker
- **Description:** Sediakan dropdown autocomplete saat user mengetik `{{` di text input payload action (menampilkan opsi: `form.<field>`, `variables.<key>`, `response.<field>`).
- **Priority:** High
- **Package:** `@kubuild/editor`
- **Dependencies:** STORA-341
- **Acceptance Criteria:**
  - Memilih chip variabel otomatis menyisipkan template string yang valid.

### STORA-344
- **Epic:** Visual Action Builder & Form Inspector UI
- **Task Key:** STORA-344
- **Type:** Story
- **Summary:** Bangun Form Validation Rules Inspector Panel
- **Description:** Tambahkan bagian khusus di Traits Inspector untuk mengelola aturan validasi field input:
  - List of active rules dengan tombol hapus.
  - Tombol **+ Add Rule** (Required, Email, Regex, Min Length, Max Length).
  - Input kustom untuk *Error Message*.
- **Priority:** Highest
- **Package:** `@kubuild/editor`
- **Dependencies:** STORA-301
- **Acceptance Criteria:**
  - Menambah/mengedit aturan validasi langsung tersimpan ke metadata `formConfig.rules` pada node.

### STORA-345
- **Epic:** Visual Action Builder & Form Inspector UI
- **Task Key:** STORA-345
- **Type:** Story
- **Summary:** Live Form Testing & Action Debugger di Preview Mode
- **Description:** Buat panel debugger opsional saat preview aktif yang menampilkan nilai form state (`values`, `errors`, `isSubmitting`) secara real-time dan log eksekusi action.
- **Priority:** Medium
- **Package:** `@kubuild/editor`
- **Dependencies:** STORA-320, STORA-324
- **Acceptance Criteria:**
  - Developer/user dapat memantau apakah payload yang dikirim sudah sesuai tanpa perlu membuka DevTools browser.

### STORA-346
- **Epic:** Visual Action Builder & Form Inspector UI
- **Task Key:** STORA-346
- **Type:** Task
- **Summary:** Optimasi UX & Polish Visual Action Builder
- **Description:** Berikan styling modern dengan palet warna dark/light yang konsisten, transisi halus, badge status aksi, dan icon penjelas untuk setiap jenis aksi.
- **Priority:** Medium
- **Package:** `@kubuild/editor`
- **Dependencies:** STORA-340 s/d STORA-344
- **Acceptance Criteria:**
  - UI responsif, rapi, dan mudah dinavigasi.

---

# Epic 35 — Form Templates & Playground Verification (`apps/stora-playground`)

### STORA-350
- **Epic:** Form Templates & Playground Verification
- **Task Key:** STORA-350
- **Type:** Story
- **Summary:** Buat Template Starter Form di Block Manager
- **Description:** Tambahkan blok siap pakai di Block Manager:
  - **Contact Us Form**: Name, Email, Subject, Message, Submit button dengan API request + Toast.
  - **Newsletter Subscribe Form**: Inline email input + Subscribe button.
  - **Lead Generation Form**: Multi-field form dengan validasi nomor telepon & dropdown minat.
- **Priority:** High
- **Package:** `@kubuild/components`, `@kubuild/editor`
- **Dependencies:** STORA-330 s/d STORA-334
- **Acceptance Criteria:**
  - User dapat drag & drop template form lengkap langsung ke canvas builder.

### STORA-351
- **Epic:** Form Templates & Playground Verification
- **Task Key:** STORA-351
- **Type:** Story
- **Summary:** Integrasi Mock API Endpoint di Stora Playground
- **Description:** Sediakan mock handler di playground untuk mensimulasikan endpoint pengiriman form `/api/mock/submit-lead` dengan response sukses (200) atau simulasi error (400/500).
- **Priority:** High
- **Package:** `apps/stora-playground`
- **Dependencies:** STORA-321
- **Acceptance Criteria:**
  - User dapat mencoba submit form di playground dan melihat toast sukses/error sesuai konfigurasi action pipeline.

### STORA-352
- **Epic:** Form Templates & Playground Verification
- **Task Key:** STORA-352
- **Type:** Task
- **Summary:** Dokumentasi API & Panduan Penggunaan Advance Action Form
- **Description:** Buat panduan dokumentasi di `docs/src/content/docs/` (Bahasa Indonesia & English) mengenai:
  - Konfigurasi form binding & validation rules.
  - Cara membuat multi-step action pipeline dengan branching.
  - Contoh integrasi Webhook (Zapier/Make/Slack).
- **Priority:** Medium
- **Package:** `docs`
- **Dependencies:** STORA-340, STORA-350
- **Acceptance Criteria:**
  - Dokumentasi terbit dan dapat diakses di portal docs Astro.

### STORA-353
- **Epic:** Form Templates & Playground Verification
- **Task Key:** STORA-353
- **Type:** Task
- **Summary:** End-to-End Regression & Performance Test
- **Description:** Jalankan tes E2E untuk memvalidasi pembuatan form, pengisian data di canvas, eksekusi submit, pembacaan error validasi, dan export dokumen `.stora`.
- **Priority:** High
- **Package:** Whole Workspace
- **Dependencies:** STORA-350, STORA-351
- **Acceptance Criteria:**
  - Semua automated tests di workspace (`pnpm test`) lulus 100%.
