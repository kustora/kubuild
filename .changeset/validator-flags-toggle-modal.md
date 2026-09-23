---
"@kubuild/schema": minor
"@kubuild/core": minor
"@kubuild/renderer": patch
"@kubuild/editor": patch
---

- `@kubuild/schema`: add `toggle_modal` to `ActionStepTypeSchema`, with a `ToggleModalStepPayloadSchema` in `StepPayloadSchemas` (`modalId` / `modalNodeId` / `targetNodeId` / `nodeId`, one required) and in the exported JSON Schemas. The renderer already shipped a `toggle_modal` runner, but documents using it failed schema validation.
- `@kubuild/core`: `validateDocument` now honours `checkAssetReferences`, `checkVariableBindings` and `checkActionBindings` (all default `true`, so existing behaviour is unchanged). New `knownAssetIds` option checks that asset references resolve: an unknown `assetId` is an `INVALID_ASSET_REFERENCE` error, or an `UNRESOLVED_ASSET_REFERENCE` warning when the reference has a `fallbackUrl`.
- `@kubuild/editor`: action builder summarises `toggle_modal` steps.
- Remove `eslint-disable` comments for the unregistered `react-hooks/exhaustive-deps` rule, which made `lint` fail.
