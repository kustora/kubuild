# Security Policy

We take the security of **KUBUILD** and the applications built on top of it seriously. This document outlines our security policies, supported versions, threat model, and instructions for reporting vulnerabilities.

---

## 🛡️ Supported Versions

We provide security patches for the following versions of KUBUILD packages (`@kubuild/*`):

| Version | Supported          | Status                               |
| ------- | ------------------ | ------------------------------------ |
| 0.1.x   | :white_check_mark: | Currently supported (active release) |
| < 0.1.0 | :x:                | End of life                          |

We recommend always keeping your dependencies up to date with the latest minor and patch versions.

---

## 🚨 Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues or discussions.**

Instead, please use one of the following private disclosure channels:

1. **GitHub Private Vulnerability Advisory (Preferred):**
   - Navigate to [kustora/kubuild Security Advisories](https://github.com/kustora/kubuild/security/advisories/new)
   - Click **"Report a vulnerability"** to open a draft advisory.

2. **Email:**
   - Send details to `contact@kustora.id` or `riziqliliulilalbab@gmail.com`.
   - Use the subject line: `[SECURITY] Vulnerability in KUBUILD (<package_name>)`.

### What to Include in Your Report

To help us triage and resolve the issue quickly, please include:

- **Package(s) affected**: (e.g., `@kubuild/core`, `@kubuild/schema`, `@kubuild/editor`, `@kubuild/renderer`, `@kubuild/ai`, `@kubuild/react`)
- **Version(s) affected**: (e.g., `0.1.2`)
- **Vulnerability type**: (e.g., XSS, Prototype Pollution, Denial of Service / Zip Bomb, SSRF, Deserialization Bypass)
- **Step-by-step reproduction**: Detailed steps or minimal reproduction code.
- **Proof-of-Concept (PoC)**: Minimal `.stora` document, JSON payload, or AI provider mock response demonstrating the exploit.
- **Impact assessment**: What an attacker could achieve by exploiting this issue.

### Response Timelines

- **Initial Acknowledgement**: Within **48 hours** of report receipt.
- **Triage & Validation**: Within **5 business days**, confirming severity and affected packages.
- **Remediation & Patch**: Target fix released within **14 to 30 days** depending on severity and complexity.
- **Public Disclosure**: Coordinated disclosure after a patched version is published to npm.

---

## 🔒 Security Architecture & Threat Model

KUBUILD is designed with a strict **"Never Trust Untrusted Input"** posture. External documents (`.stora` archives), community templates, and AI-generated outputs are treated as untrusted data across all boundary layers.

```
                    ┌──────────────────────────────┐
                    │ Untrusted External Inputs    │
                    │ (.stora, AI completions,     │
                    │  community templates, URLs)  │
                    └──────────────┬───────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │ 1. Structural & Sanitization │
                    │    - File size limits        │
                    │    - Zip bomb ratio checks   │
                    │    - Asset extension filter  │
                    └──────────────┬───────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │ 2. Schema Validation (Zod)   │
                    │    - PageDocumentSchema      │
                    │    - Node type & prop shapes │
                    └──────────────┬───────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │ 3. Document Security Limits  │
                    │    (validateDocumentSecurity)│
                    │    - Tree depth limit (32)   │
                    │    - Node count limit (5000) │
                    │    - Prototype pollution ban │
                    │    - URL scheme whitelist    │
                    └──────────────┬───────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │ 4. Command Engine & State    │
                    │    - Immutable updates       │
                    │    - Transaction history     │
                    └──────────────┬───────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │ 5. Pure Renderer Execution   │
                    │    - Zero arbitrary JS eval  │
                    │    - Sanitized props         │
                    └──────────────────────────────┘
```

### 1. Document Limits & Resource Exhaustion Defense

To prevent client browser crashes and Denial of Service (DoS), `@kubuild/core` enforces defaults through `validateDocumentSecurity`:

- **Maximum Node Count**: `5,000` nodes per document tree.
- **Maximum Tree Nesting Depth**: `32` levels deep.
- **Maximum String Length**: `100,000` characters per string property.
- **Maximum Children per Node**: `1,000` direct children.
- **Maximum Serialized Size**: `10 MB` payload limit.
- **Decompression Bomb Protection**: Maximum zip expansion ratio capped at `100:1`.

### 2. Prototype Pollution Defense

All document traversal, hydration, and command state operations reject dangerous object keys:
`__proto__`, `constructor`, `prototype`, `__defineGetter__`, `__defineSetter__`, `__lookupGetter__`, `__lookupSetter__`.

### 3. Cross-Site Scripting (XSS) & URL Sanitization

- **URL Scheme Whitelist**: Links, images, and action targets only allow safe protocols:
  `http:`, `https:`, `mailto:`, `tel:`, `#`, relative paths, and `data:image/*`.
- **Blocked Protocols**: `javascript:`, `vbscript:`, `data:text/html`, and unsafe inline execution vectors are rejected during validation.
- **No `eval` Policy**: KUBUILD core and renderers never execute raw JavaScript strings or dynamic code from document JSON.

### 4. Untrusted AI Output Handling

Outputs generated by AI providers (via `@kubuild/ai` or `@kubuild/editor` AI assistants) are never written directly into the document tree. They pass through the exact same normalization, schema validation, and `validateDocumentSecurity` pipeline as imported `.stora` files before dispatching via the command engine.

### 5. Secret & Credential Isolation

- Sensitive credentials (e.g., API keys, tracking tokens, payment webhook secrets) **must never be persisted** inside `.stora` document trees.
- Secrets are retained host-side and referenced strictly by opaque identifiers (e.g. `credentialId`).

---

## 💡 Best Practices for Host Integrators

If you are embedding `@kubuild/renderer` or `@kubuild/editor` into your own host application:

1. **Content Security Policy (CSP)**: Implement a robust CSP on pages rendering user-generated documents (e.g., restricting `script-src` and disallowing `unsafe-eval`).
2. **Custom Component Sanitization**: If registering custom component definitions (`registerComponent`), ensure custom renderers sanitize any user-controlled HTML or attributes.
3. **AI Integration**: Always proxy AI provider requests through your authenticated backend server rather than exposing provider API keys on the client bundle.
4. **Asset Storage**: Store user-uploaded assets in isolated domains or object storage with appropriate `Content-Type` headers and `nosniff` flags.

---

## 🏆 Attribution & Recognition

We value the security research community. If you report a valid vulnerability following coordinated disclosure guidelines:

- We will acknowledge your contribution in our release notes and GitHub Security Advisory (unless you prefer to remain anonymous).
- We will coordinate public disclosure dates to give users sufficient time to patch.
