import { describe, it, expect, expectTypeOf } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { z } from 'zod';
import type * as Pure from '../src/types';
import {
  AssetReferenceSchema,
  VariableBindingSchema,
  ActionBindingSchema,
  StyleValueSchema,
  StyleDefinitionSchema,
  PseudoStateStylesSchema,
  ResponsiveStylesSchema,
  AnimationConfigSchema,
  NodeSchema,
  RootPageNodeSchema,
  DocumentMetadataSchema,
  PageDocumentSchema,
  ArtboardSchema,
  ProjectDocumentSchema,
} from '../src/document';
import {
  ActionTriggerTypeSchema,
  ActionStepTypeSchema,
  ConditionOperatorSchema,
  ActionStepConditionSchema,
  ActionStepSchema,
  ActionPipelineSchema,
} from '../src/actions';
import {
  ValidationRuleTypeSchema,
  ValidateOnEventSchema,
  ValidationRuleSchema,
  FormFieldBindingSchema,
  FormConfigSchema,
} from '../src/form';
import {
  TrackingProviderTypeSchema,
  TrackingDeliverySchema,
  MetaTrackingProviderConfigSchema,
  GoogleTrackingProviderConfigSchema,
  GtmTrackingProviderConfigSchema,
  TikTokTrackingProviderConfigSchema,
  CustomTrackingProviderConfigSchema,
  TrackingConfigSchema,
} from '../src/tracking';
import { ManifestAssetItemSchema, ManifestSchema } from '../src/manifest';
import {
  SafeThumbnailObjectSchema,
  SafeThumbnailSchema,
  TemplatePackageRefSchema,
  TemplateRequirementsSchema,
  TemplateRecordSchema,
} from '../src/template';
import { ThemeSchema, ThemeTokenValueSchema } from '../src/theme';
import { validateDocument, validateNode, validateTheme, isValidPageDocument } from '../src/validate';

const ZOD_REFERENCE = /from\s+['"]zod['"]|import\(\s*['"]zod['"]\s*\)|require\(\s*['"]zod['"]\s*\)|\bz\.core\b|ZodType/;

function createBlankDocumentFixture(): Pure.PageDocument {
  return {
    schema: 'stora.page',
    version: '1.2.0',
    document: { id: 'root', type: 'page', props: {}, styles: {}, children: [{ id: 't1', type: 'text', props: { text: 'Hi' } }] },
  };
}

describe('STORA-552: @kubuild/schema/types mirrors z.infer', () => {
  it('bindings & styles', () => {
    expectTypeOf<Pure.AssetReference>().toEqualTypeOf<z.infer<typeof AssetReferenceSchema>>();
    expectTypeOf<Pure.VariableBinding>().toEqualTypeOf<z.infer<typeof VariableBindingSchema>>();
    expectTypeOf<Pure.ActionBinding>().toEqualTypeOf<z.infer<typeof ActionBindingSchema>>();
    expectTypeOf<Pure.StyleValue>().toEqualTypeOf<z.infer<typeof StyleValueSchema>>();
    expectTypeOf<Pure.StyleDefinition>().toEqualTypeOf<z.infer<typeof StyleDefinitionSchema>>();
    expectTypeOf<Pure.PseudoStateStyles>().toEqualTypeOf<z.infer<typeof PseudoStateStylesSchema>>();
    expectTypeOf<Pure.ResponsiveStyles>().toEqualTypeOf<z.infer<typeof ResponsiveStylesSchema>>();
    expectTypeOf<Pure.AnimationConfig>().toEqualTypeOf<z.infer<typeof AnimationConfigSchema>>();
  });

  it('theme', () => {
    expectTypeOf<Pure.Theme>().toEqualTypeOf<z.infer<typeof ThemeSchema>>();
    expectTypeOf<Pure.ThemeTokenValue>().toEqualTypeOf<z.infer<typeof ThemeTokenValueSchema>>();
  });

  it('forms', () => {
    expectTypeOf<Pure.ValidationRuleType>().toEqualTypeOf<z.infer<typeof ValidationRuleTypeSchema>>();
    expectTypeOf<Pure.ValidateOnEvent>().toEqualTypeOf<z.infer<typeof ValidateOnEventSchema>>();
    expectTypeOf<Pure.ValidationRule>().toEqualTypeOf<z.infer<typeof ValidationRuleSchema>>();
    expectTypeOf<Pure.FormFieldBinding>().toEqualTypeOf<z.infer<typeof FormFieldBindingSchema>>();
    expectTypeOf<Pure.FormConfig>().toEqualTypeOf<z.infer<typeof FormConfigSchema>>();
  });

  it('actions', () => {
    expectTypeOf<Pure.ActionTriggerType>().toEqualTypeOf<z.infer<typeof ActionTriggerTypeSchema>>();
    expectTypeOf<Pure.ActionStepType>().toEqualTypeOf<z.infer<typeof ActionStepTypeSchema>>();
    expectTypeOf<Pure.ConditionOperator>().toEqualTypeOf<z.infer<typeof ConditionOperatorSchema>>();
    expectTypeOf<Pure.ActionStepCondition>().toEqualTypeOf<z.infer<typeof ActionStepConditionSchema>>();
    expectTypeOf<Pure.ActionStep>().toEqualTypeOf<z.infer<typeof ActionStepSchema>>();
    expectTypeOf<Pure.ActionPipeline>().toEqualTypeOf<z.infer<typeof ActionPipelineSchema>>();
  });

  it('tracking', () => {
    expectTypeOf<Pure.TrackingProviderType>().toEqualTypeOf<z.infer<typeof TrackingProviderTypeSchema>>();
    expectTypeOf<Pure.TrackingDelivery>().toEqualTypeOf<z.infer<typeof TrackingDeliverySchema>>();
    expectTypeOf<Pure.MetaTrackingProviderConfig>().toEqualTypeOf<z.infer<typeof MetaTrackingProviderConfigSchema>>();
    expectTypeOf<Pure.GoogleTrackingProviderConfig>().toEqualTypeOf<
      z.infer<typeof GoogleTrackingProviderConfigSchema>
    >();
    expectTypeOf<Pure.GtmTrackingProviderConfig>().toEqualTypeOf<z.infer<typeof GtmTrackingProviderConfigSchema>>();
    expectTypeOf<Pure.TikTokTrackingProviderConfig>().toEqualTypeOf<
      z.infer<typeof TikTokTrackingProviderConfigSchema>
    >();
    expectTypeOf<Pure.CustomTrackingProviderConfig>().toEqualTypeOf<
      z.infer<typeof CustomTrackingProviderConfigSchema>
    >();
    expectTypeOf<Pure.TrackingConfig>().toEqualTypeOf<z.infer<typeof TrackingConfigSchema>>();
  });

  it('document', () => {
    expectTypeOf<Pure.Node>().toEqualTypeOf<z.infer<typeof NodeSchema>>();
    expectTypeOf<Pure.RootPageNode>().toEqualTypeOf<z.infer<typeof RootPageNodeSchema>>();
    expectTypeOf<Pure.DocumentMetadata>().toEqualTypeOf<z.infer<typeof DocumentMetadataSchema>>();
    expectTypeOf<Pure.PageDocument>().toEqualTypeOf<z.infer<typeof PageDocumentSchema>>();
    expectTypeOf<Pure.Artboard>().toEqualTypeOf<z.infer<typeof ArtboardSchema>>();
    expectTypeOf<Pure.ProjectDocument>().toEqualTypeOf<z.infer<typeof ProjectDocumentSchema>>();
  });

  it('manifest & templates', () => {
    expectTypeOf<Pure.ManifestAssetItem>().toEqualTypeOf<z.infer<typeof ManifestAssetItemSchema>>();
    expectTypeOf<Pure.Manifest>().toEqualTypeOf<z.infer<typeof ManifestSchema>>();
    expectTypeOf<Pure.SafeThumbnailObject>().toEqualTypeOf<z.infer<typeof SafeThumbnailObjectSchema>>();
    expectTypeOf<Pure.SafeThumbnail>().toEqualTypeOf<z.infer<typeof SafeThumbnailSchema>>();
    expectTypeOf<Pure.TemplatePackageRef>().toEqualTypeOf<z.infer<typeof TemplatePackageRefSchema>>();
    expectTypeOf<Pure.TemplateRequirements>().toEqualTypeOf<z.infer<typeof TemplateRequirementsSchema>>();
    expectTypeOf<Pure.TemplateRecord>().toEqualTypeOf<z.infer<typeof TemplateRecordSchema>>();
  });
});

describe('STORA-552: zod-free validator surface', () => {
  it('validateDocument returns a plain success result with normalized data', () => {
    const result = validateDocument(createBlankDocumentFixture());
    expect(result.success).toBe(true);
    expect(result.issues).toEqual([]);
    if (result.success) {
      expectTypeOf(result.data).toEqualTypeOf<Pure.PageDocument>();
      expect(result.data.document.type).toBe('page');
    }
    expect(isValidPageDocument(createBlankDocumentFixture())).toBe(true);
  });

  it('validateDocument returns plain issues with dotted paths on failure', () => {
    const bad = createBlankDocumentFixture() as unknown as Record<string, unknown>;
    (bad.document as Record<string, unknown>).type = 'section';
    const result = validateDocument(bad);
    expect(result.success).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.issues[0]).toEqual({
      path: expect.any(String),
      message: expect.any(String),
      code: expect.any(String),
    });
    expect(result.issues.some((issue) => issue.path === 'document.type')).toBe(true);
    // Plain JSON — no zod error instances leak to the caller.
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });

  it('validateNode / validateTheme work without zod at the call site', () => {
    expect(validateNode({ id: 'n1', type: 'text' }).success).toBe(true);
    expect(validateNode({ id: '', type: 'text' }).success).toBe(false);
    expect(validateTheme({ colors: { primary: '#fff' } }).success).toBe(true);
    expect(validateTheme({ colors: { primary: 'red; } body { color: red' } }).success).toBe(false);
  });
});

describe('STORA-552: built declarations are zod-free', () => {
  const dist = resolve(__dirname, '../dist');
  const builtFiles = ['types.d.ts', 'validate.d.ts', 'types.js', 'types.cjs', 'validate.js', 'validate.cjs'];
  const isBuilt = builtFiles.every((file) => existsSync(resolve(dist, file)));

  it.skipIf(!isBuilt)('emits the types/validate subpath entries', () => {
    for (const file of builtFiles) {
      expect(existsSync(resolve(dist, file))).toBe(true);
    }
  });

  it.skipIf(!isBuilt)('types.d.ts and validate.d.ts never reference zod', () => {
    for (const file of ['types.d.ts', 'validate.d.ts']) {
      const source = readFileSync(resolve(dist, file), 'utf8');
      expect(source).not.toMatch(ZOD_REFERENCE);
      // Only relative imports allowed, and only to the pure types module.
      const imports = [...source.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
      for (const specifier of imports) {
        expect(specifier).toBe('./types');
      }
    }
  });

  it('src/types.ts has no imports at all', () => {
    const source = readFileSync(resolve(__dirname, '../src/types.ts'), 'utf8');
    expect(source).not.toMatch(/^\s*import\s/m);
    expect(source).not.toMatch(ZOD_REFERENCE);
  });
});
