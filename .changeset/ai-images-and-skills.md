---
"@kubuild/ai": minor
---

Image attachments and Agent Skills.

**Images**

- New `AiImageBlock` content block (`{ type: 'image', url, mimeType? }`) for chat and agent messages, and an `images` field on plan, full-page, section and refactor requests. `url` must be a hosted http(s) URL.
- OpenAI and Anthropic adapters send images to the model as vision input. Every adapter also lists the image URLs in the prompt text, so models without vision (Gemini, custom) can still use them as an image `src`.
- Plan and generate collect images from the request and the conversation history; `streamPage` passes them to every section call. Plan/generate send only the 4 most recent images.
- The handler rejects non-http(s) URLs (no `data:` URLs) with `INVALID_IMAGES`, and caps images at `MAX_IMAGES_PER_MESSAGE` (4) per message and `MAX_REQUEST_IMAGES` (20) per request. New export `validateRequestImages()`.
- `useAiChat().sendMessage` and `useAiAgent().run` accept `images`.

**Agent Skills** ([agentskills.io](https://agentskills.io/specification))

- New `skills?: AiSkill[]` engine/agent option. Only each skill's `name` and `description` are always in the prompt.
- The agent sees the skill catalog and gets `load_skill` / `read_skill_file` tools (lookups into the loaded skills, never filesystem reads). Sections it inserts are generated with the skills it loaded.
- Chat, plan, generate, section and refactor make one short router call that picks at most 2 skills for the request and adds them to the system prompt. `streamPage` picks once for the plan and all sections. A failed pick means no skills, not a failed request.
- `parseSkill()` parses and validates a `SKILL.md` (plus `SkillParseError`, `isValidSkillName`, `formatSkillCatalog`, `formatActiveSkills`, `appendActiveSkills`).
- New Node-only entry `@kubuild/ai/skills-loader` with `loadSkillsFromDirectory(rootDir)`, which loads a folder of skills with their `references/` and `assets/` text files. `scripts/` is never read or run. The server entry stays edge-safe.
