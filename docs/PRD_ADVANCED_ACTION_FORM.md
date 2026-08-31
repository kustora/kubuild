# PRD — KUBUILD: Advanced Action & Form Input System

**Product:** KUBUILD  
**Codename:** BUILDER-01  
**Document Type:** Product Requirements Document (PRD Extension)  
**Feature Focus:** Advanced Action Pipeline, Event Triggers, Form State Management, Multi-field Validation Engine, API/Webhook Request Handlers, UI Feedback (Toast/Modal), and Visual Action Builder UI  
**Target Packages:** `@kubuild/schema`, `@kubuild/core`, `@kubuild/components`, `@kubuild/renderer`, `@kubuild/editor`  
**Status:** Approved / Ready for Implementation  

---

## 1. Executive Summary & Vision

### 1.1 Problem Statement
Saat ini builder KUBUILD / Stora memiliki dukungan dasar untuk aksi sederhana via `ActionBinding` (`{ type, payload }`) dan elemen HTML dasar. Namun untuk kebutuhan landing page interaktif, lead generation, dan aplikasi web modern, terdapat beberapa batasan fundamental:
1. **Aksi Bersifat Statis & Tunggal**: Belum ada dukungan *chaining* (multi-step actions), percabangan kondisi (*conditional branching*), atau penanganan sukses/gagal (*onSuccess / onError*).
2. **Form State & Binding Terpisah**: Input elemen belum memiliki context runtime bersama untuk agregasi data form, dirty state, dan loading state saat submit.
3. **Validasi Belum Terstandarisasi**: Tidak ada mekanisme visual untuk mendefinisikan aturan validasi (Required, Email, Regex, Min/Max Length, Match Field) dengan pesan error kustom yang reaktif.
4. **Integrasi Eksternal Terbatas**: Pengiriman data form ke REST API, webhook (e.g. Zapier, Make, custom backend), WhatsApp direct message, atau manipulasi modal/toast masih memerlukan custom code manual.

### 1.2 Product Vision
Membangun **Advanced Action & Form Input System** kelas enterprise yang portabel, sepenuhnya berbasis schema serializable (JSON AST / `.stora`), aman dari script injection, dan memiliki visual editor yang intuitif mirip Webflow / Bubble / Retool namun tetap ringan dan terintegrasi dengan React AST engine KUBUILD.

---

## 2. Arsitektur Sistem

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                   KUBUILD ADVANCED ACTION & FORM SYSTEM                     │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. DATA CONTRACT & SCHEMA (@kubuild/schema)                                 │
│    - ActionPipelineSchema (Triggers: click, submit, change, blur, load)     │
│    - ActionStepSchema (api_request, navigate, set_state, toast, modal, ...) │
│    - ValidationRuleSchema (required, email, pattern, min/max, custom)       │
│    - FormBindingConfigSchema (field name, initial values, clear on submit)  │
├─────────────────────────────────────────────────────────────────────────────┤
│ 2. CORE EVALUATION & RUNTIME ENGINE (@kubuild/core)                         │
│    - ActionPipelineExecutor (Async queue, sequential & parallel execution)   │
│    - Expression & Variable Interpolator (e.g. {{form.email}}, {{auth.jwt}}) │
│    - ValidationEngine (Rule evaluator with localized error messages)        │
│    - Conditional Logic Resolver (operators: equals, contains, gt, lt, regex)│
├─────────────────────────────────────────────────────────────────────────────┤
│ 3. RUNTIME & INTERACTIVE RENDERER (@kubuild/renderer)                       │
│    - FormRuntimeContext (values, errors, touched, isSubmitting, isValid)    │
│    - Built-in Action Handlers (Fetch API, Toaster, Modal Dialog, Router)    │
│    - Reactive Field Validation on Blur / on Change / on Submit              │
├─────────────────────────────────────────────────────────────────────────────┤
│ 4. FORM PRIMITIVES & COMPONENT LIBRARY (@kubuild/components)                │
│    - Form Container, TextInput, Textarea, Select/Dropdown, Checkbox/Switch  │
│    - RadioGroup, DatePicker, FileUpload, NumberStepper, SubmitButton        │
│    - Trait definitions with form binding & validation metadata              │
├─────────────────────────────────────────────────────────────────────────────┤
│ 5. VISUAL ACTION & FORM BUILDER UI (@kubuild/editor)                        │
│    - Visual Action Pipeline Builder Modal / Inspector Drawer                │
│    - Step Timeline Editor (Step 1 -> Step 2 -> Success/Error branches)      │
│    - Trait Validation Rule Manager (Add/Remove/Reorder Rules)                │
│    - Live Form Sandbox & Payload Inspector in Canvas Preview                │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Spesifikasi Detail Fitur & Kebutuhan Fungsional

### 3.1 Schema & Data Contract (`@kubuild/schema`)

#### A. Action Step & Pipeline Definition
```typescript
export type ActionTrigger = 'click' | 'submit' | 'change' | 'blur' | 'focus' | 'load';

export type ActionStepType =
  | 'api_request'       // HTTP Request (GET, POST, PUT, DELETE, PATCH)
  | 'navigate'          // Page redirect / External URL / Scroll to Anchor (#id)
  | 'set_state'         // Update runtime state / document variable
  | 'reset_form'        // Reset form inputs to default values
  | 'show_toast'        // Toast alert (success, error, warning, info)
  | 'open_modal'        // Open modal dialog by target Node ID
  | 'close_modal'       // Close modal dialog by target Node ID
  | 'copy_clipboard'    // Copy static text or variable to clipboard
  | 'custom_event'      // Dispatch window / DOM custom event
  | 'custom_script';    // Safe expression / callback execution

export interface ActionStepCondition {
  field: string;        // Path to variable (e.g. "form.agreeTerms", "response.status")
  operator: 'equals' | 'not_equals' | 'contains' | 'is_truthy' | 'is_falsy' | 'gt' | 'lt' | 'regex';
  value?: unknown;
}

export interface ActionStep {
  id: string;
  type: ActionStepType;
  label?: string;
  payload: Record<string, unknown>;
  condition?: ActionStepCondition;
  onSuccess?: ActionStep[];
  onError?: ActionStep[];
}

export interface ActionPipeline {
  id: string;
  trigger: ActionTrigger;
  debounceMs?: number;
  preventDuplicate?: boolean; // Prevent multiple clicks during execution
  steps: ActionStep[];
}
```

#### B. Validation Rule Schema
```typescript
export type ValidationRuleType =
  | 'required'
  | 'email'
  | 'url'
  | 'min_length'
  | 'max_length'
  | 'numeric_min'
  | 'numeric_max'
  | 'pattern'
  | 'match_field'      // e.g. confirm_password matches password
  | 'custom_regex';

export interface ValidationRule {
  type: ValidationRuleType;
  value?: unknown;
  message: string;
}

export interface FormFieldBinding {
  name: string;
  label?: string;
  defaultValue?: unknown;
  rules?: ValidationRule[];
  validateOn?: 'blur' | 'change' | 'submit';
}
```

---

### 3.2 Core Evaluation & Action Engine (`@kubuild/core`)

1. **Template & Expression Interpolation**:
   - Mendukung format `{{form.<field_name>}}`, `{{variables.<var_name>}}`, dan `{{response.<field>}}`.
   - Mengganti nilai dinamis secara rekursif pada payload sebelum aksi dieksekusi.
2. **Validation Evaluator**:
   - Menjalankan daftar `ValidationRule` terhadap nilai input.
   - Mengembalikan daftar error spesifik per field.
3. **Pipeline Execution Engine**:
   - Menjalankan step secara berurutan (*sequential*).
   - Menangani *branching*: jika step `api_request` menghasilkan HTTP 2xx, jalankan `onSuccess`; jika 4xx/5xx/network error, jalankan `onError`.
   - Mengisolasi context eksekusi: output step sebelumnya (`response`, `status`, `data`) dapat diakses oleh step berikutnya via `{{response.data...}}`.

---

### 3.3 Runtime & Form Context (`@kubuild/renderer`)

1. **`FormRuntimeContext`**:
   - `values: Record<string, unknown>` — Nilai aktif setiap field input.
   - `errors: Record<string, string>` — Pesan error validasi per field.
   - `touched: Record<string, boolean>` — Status interaksi user pada tiap input.
   - `isSubmitting: boolean` — Status loading form saat proses submit/API call berlangsung.
   - `setFieldValue(name, value)` & `setFieldTouched(name, isTouched)` & `resetForm()`.
2. **Built-in Action Handlers**:
   - **`api_request`**: Melakukan `fetch` dengan metode HTTP, headers kustom, serialization JSON/FormData, dan timeout handling.
   - **`show_toast`**: Merender toast UI terapung (success/error/info) dengan durasi auto-dismiss.
   - **`open_modal` / `close_modal`**: Mengontrol visibility state komponen modal target.
   - **`navigate`**: Mendukung smooth scroll ke anchor `#section-id`, URL eksternal, atau client-side router.

---

### 3.4 Form Components Library (`@kubuild/components`)

Komponen form semantik dengan dukungan trait binding:
- **`form`**: Form container dengan submit handler & auto-scroll ke error pertama.
- **`input` / `input-password` / `input-number`**: Input fleksibel dengan prefix/suffix icon, placeholder, mask, dan helper text.
- **`textarea`**: Area input multi-line dengan auto-grow & character counter.
- **`select` / `dropdown`**: Dropdown pilihan tunggal atau multi-select dengan opsi statis maupun dynamic variable source.
- **`checkbox` & `switch`**: Kontrol boolean interaktif.
- **`radio-group` & `radio-item`**: Grup opsi radio dengan layout horizontal atau vertikal.
- **`file-upload`**: Input upload file dengan preview thumbnail dan direct dataURL / API upload handler.
- **`button-submit`**: Tombol submit cerdas dengan auto loading spinner saat `isSubmitting`.

---

### 3.5 Visual Action Builder & Inspector UI (`@kubuild/editor`)

1. **Action Pipeline Modal / Panel**:
   - **Trigger Picker**: Tab/Dropdown untuk memilih event trigger (`On Click`, `On Submit`, `On Change`, dll.).
   - **Visual Step Pipeline (Flow / Timeline)**:
     - Card per step dengan drag-and-drop reorder.
     - Form konfigurasi parameter spesifik untuk tiap tipe aksi (API URL, Headers, Method, Toast Message, Target Modal ID).
     - Sub-pipeline visual untuk blok **On Success** dan **On Error**.
   - **Variable Autocomplete**: Saran autocomplete variabel (e.g. ketik `{{` langsung memunculkan daftar field form dan state yang tersedia).
2. **Form Trait Inspector**:
   - Manajemen Nama Field (`name`).
   - Visual Rule Manager (+ Add Rule: Required, Email, Min Length, Regex, Custom Error Message).
   - Opsi *Validation Trigger* (`On Blur`, `On Change`, `On Submit`).
3. **Interactive Debugger in Canvas**:
   - Kemampuan untuk menguji form dan action langsung di mode preview canvas.
   - Log console/inspector untuk melihat payload form yang dihasilkan saat tombol submit ditekan.

---

## 4. Keamanan, Sanitasi & Performa

1. **Safe Expression Interpolation**: Interpolasi variabel dibatasi hanya pada pembacaan key JSON yang aman tanpa menggunakan `eval()` atau `new Function()`.
2. **XSS Protection**: Nilai input disanitasi sebelum di-render kembali ke DOM.
3. **Debounce & Double-Submit Protection**: Submit button secara otomatis mencegah pengiriman ganda saat permintaan pertama masih berlangsung (*in-flight*).
4. **Offline & SSR Safe**: Action pipeline engine terisolasi dan tidak menyebabkan error saat di-render di lingkungan server (SSR/SSG).

---

## 5. Kriteria Keberhasilan (Success Metrics)

- User dapat merancang form kontak lengkap dengan validasi visual tanpa menulis kode sama sekali.
- Tombol form dapat mengirimkan data ke REST API/Webhook eksternal dan menampilkan toast sukses/error sesuai respon server.
- Seluruh konfigurasi action dan validasi 100% tersimpan secara portabel di dalam dokumen `.stora`.
