/**
 * `@kubuild/schema/types` — pure TypeScript interfaces for the portable document format
 * (STORA-552).
 *
 * This module MUST NOT import zod (or any module that does). Its emitted `.d.ts` is what
 * hosts on a different zod major (e.g. a zod v3 backend) import to type `PageDocument`,
 * `Node`, etc. without pulling zod v4's core namespace into their compilation.
 *
 * Every type here mirrors the *parsed output* (`z.infer<...>`) of the matching schema in
 * the main entry, i.e. fields with a schema default are required. The equality is
 * enforced by `tests/types.test.ts` (`expectTypeOf(...).toEqualTypeOf(...)`), so a schema
 * change that is not reflected here fails `pnpm run typecheck`.
 */

/* ----------------------------------------------------------------------------------------
 * Bindings & styles
 * -------------------------------------------------------------------------------------- */

export interface AssetReference {
  type: 'asset';
  assetId: string;
  filename?: string;
  mimeType?: string;
  fallbackUrl?: string;
}

export interface VariableBinding {
  type: 'variable';
  key: string;
  fallback?: unknown;
}

export interface ActionBinding {
  type: string;
  payload?: Record<string, unknown>;
}

export type StyleValue = string | number | boolean | null | undefined;

/**
 * Standard CSS style definition supporting Flexbox, sizing constraints, effects,
 * CSS Grid, and arbitrary CSS properties / design-token references.
 */
export interface StyleDefinition extends Record<string, StyleValue> {
  display?: string;
  flexDirection?: 'row' | 'row-reverse' | 'column' | 'column-reverse' | (string & {});
  flexWrap?: 'nowrap' | 'wrap' | 'wrap-reverse' | (string & {});
  justifyContent?:
    | 'flex-start'
    | 'flex-end'
    | 'center'
    | 'space-between'
    | 'space-around'
    | 'space-evenly'
    | 'start'
    | 'end'
    | 'left'
    | 'right'
    | (string & {});
  alignItems?:
    | 'stretch'
    | 'flex-start'
    | 'flex-end'
    | 'center'
    | 'baseline'
    | 'start'
    | 'end'
    | 'self-start'
    | 'self-end'
    | (string & {});
  alignContent?:
    | 'flex-start'
    | 'flex-end'
    | 'center'
    | 'space-between'
    | 'space-around'
    | 'space-evenly'
    | 'stretch'
    | 'start'
    | 'end'
    | (string & {});
  gap?: string | number;
  rowGap?: string | number;
  columnGap?: string | number;
  flexGrow?: number | string;
  flexShrink?: number | string;
  flexBasis?: string | number;
  alignSelf?:
    'auto' | 'flex-start' | 'flex-end' | 'center' | 'baseline' | 'stretch' | (string & {});
  width?: string | number;
  height?: string | number;
  minWidth?: string | number;
  maxWidth?: string | number;
  minHeight?: string | number;
  maxHeight?: string | number;
  objectFit?: 'fill' | 'contain' | 'cover' | 'none' | 'scale-down' | (string & {});
  objectPosition?: string;
  borderRadius?: string | number;
  borderTopLeftRadius?: string | number;
  borderTopRightRadius?: string | number;
  borderBottomRightRadius?: string | number;
  borderBottomLeftRadius?: string | number;
  backdropFilter?: string;
  filter?: string;
  boxShadow?: string;
  backgroundColor?: string;
  backgroundImage?: string;
  backgroundSize?: 'cover' | 'contain' | 'auto' | (string & {});
  backgroundPosition?: string;
  backgroundRepeat?: 'no-repeat' | 'repeat' | 'repeat-x' | 'repeat-y' | (string & {});
  backgroundAttachment?: 'scroll' | 'fixed' | 'local' | (string & {});
  gridTemplateColumns?: string;
  gridTemplateRows?: string;
  gridAutoFlow?: string;
  gridAutoColumns?: string;
  gridAutoRows?: string;
  gridColumn?: string | number;
  gridRow?: string | number;
  gridColumnStart?: string | number;
  gridColumnEnd?: string | number;
  gridRowStart?: string | number;
  gridRowEnd?: string | number;
  colSpan?: number | string;
  rowSpan?: number | string;
  justifySelf?: string;
}

export type PseudoStateStyles = Record<string, StyleDefinition>;

/** Breakpoint style layers (`base` applies to every viewport) plus pseudo-state layers. */
export interface ResponsiveStyles {
  [key: string]: unknown;
  base?: StyleDefinition;
  desktop?: StyleDefinition;
  tablet?: StyleDefinition;
  mobile?: StyleDefinition;
  states?: Record<string, StyleDefinition>;
}

export interface AnimationConfig {
  type: string;
  duration: number;
  delay: number;
  easing: string;
  once: boolean;
  hoverEffect: string;
  loopEffect: string;
}

/* ----------------------------------------------------------------------------------------
 * Theme (STORA-551)
 * -------------------------------------------------------------------------------------- */

export type ThemeTokenValue = string | number;

/** Design tokens; referenced from styles as `var(--kb-color-<key>)` etc. */
export interface Theme {
  colors?: Record<string, ThemeTokenValue>;
  fonts?: Record<string, ThemeTokenValue>;
  radii?: Record<string, ThemeTokenValue>;
  spacing?: Record<string, ThemeTokenValue>;
}

/* ----------------------------------------------------------------------------------------
 * Forms
 * -------------------------------------------------------------------------------------- */

export type ValidationRuleType =
  | 'required'
  | 'email'
  | 'url'
  | 'min_length'
  | 'max_length'
  | 'numeric_min'
  | 'numeric_max'
  | 'pattern'
  | 'match_field'
  | 'custom_regex';

export type ValidateOnEvent = 'blur' | 'change' | 'submit';

export interface ValidationRule {
  type: ValidationRuleType;
  value?: unknown;
  message: string;
}

export interface FormFieldBinding {
  name: string;
  label?: string;
  defaultValue?: unknown;
  rules: ValidationRule[];
  validateOn: ValidateOnEvent;
  transform?: 'trim' | 'lowercase' | 'uppercase' | 'number';
  disabled?: boolean;
  required?: boolean;
}

export interface FormConfig {
  formId: string;
  resetOnSubmit: boolean;
  scrollToFirstError: boolean;
  validateOn: ValidateOnEvent;
  initialValues?: Record<string, unknown>;
  rules?: ValidationRule[];
}

/* ----------------------------------------------------------------------------------------
 * Actions
 * -------------------------------------------------------------------------------------- */

export type ActionTriggerType =
  'click' | 'submit' | 'change' | 'blur' | 'focus' | 'load' | 'expire';

export type ActionStepType =
  | 'api_request'
  | 'navigate'
  | 'set_state'
  | 'reset_form'
  | 'show_toast'
  | 'open_modal'
  | 'close_modal'
  | 'toggle_modal'
  | 'copy_clipboard'
  | 'custom_event'
  | 'track_event';

export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'is_truthy'
  | 'is_falsy'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'regex';

export interface ActionStepCondition {
  field: string;
  operator: ConditionOperator;
  value?: unknown;
}

export interface ActionStep {
  id: string;
  type: ActionStepType;
  label?: string;
  payload?: Record<string, unknown>;
  condition?: ActionStepCondition;
  timeout?: number;
  continueOnError?: boolean;
  onSuccess?: ActionStep[];
  onError?: ActionStep[];
}

export interface ActionPipeline {
  id: string;
  trigger: ActionTriggerType;
  label?: string;
  debounceMs?: number;
  preventDuplicate?: boolean;
  enabled: boolean;
  steps: ActionStep[];
}

/* ----------------------------------------------------------------------------------------
 * Tracking (public ids only — secrets are host-owned)
 * -------------------------------------------------------------------------------------- */

export type TrackingProviderType = 'meta' | 'google' | 'gtm' | 'tiktok' | 'custom';

export type TrackingDelivery = 'both' | 'client_only' | 'server_only';

export interface MetaTrackingProviderConfig {
  enabled: boolean;
  credentialId?: string;
  pixelId: string;
  capiEnabled: boolean;
  testEventCode: string;
}

export interface GoogleTrackingProviderConfig {
  enabled: boolean;
  credentialId?: string;
  measurementId: string;
}

export interface GtmTrackingProviderConfig {
  enabled: boolean;
  credentialId?: string;
  containerId: string;
}

export interface TikTokTrackingProviderConfig {
  enabled: boolean;
  credentialId?: string;
  pixelId: string;
  eventsApiEnabled: boolean;
  testEventCode: string;
}

export interface CustomTrackingProviderConfig {
  enabled: boolean;
  credentialId?: string;
}

export interface TrackingConfig {
  enabled: boolean;
  debugMode: boolean;
  autoPageView: boolean;
  defaultDelivery: TrackingDelivery;
  providers: {
    meta?: MetaTrackingProviderConfig;
    google?: GoogleTrackingProviderConfig;
    gtm?: GtmTrackingProviderConfig;
    tiktok?: TikTokTrackingProviderConfig;
    custom?: CustomTrackingProviderConfig;
  };
}

/* ----------------------------------------------------------------------------------------
 * Document
 * -------------------------------------------------------------------------------------- */

export interface Node {
  id: string;
  type: string;
  props?: Record<string, unknown>;
  styles?: ResponsiveStyles;
  animation?: AnimationConfig;
  actions?: ActionPipeline[];
  formConfig?: FormConfig;
  children?: Node[];
}

export type RootPageNode = Node & { type: 'page' };

export interface DocumentMetadata {
  title: string;
  description: string;
  author: string;
  createdAt?: string;
  updatedAt?: string;
  tags: string[];
  category: string;
  version: string;
  custom?: Record<string, unknown>;
  tracking?: TrackingConfig;
}

export interface PageDocument {
  schema: 'stora.page';
  version: string;
  metadata?: DocumentMetadata;
  tracking?: TrackingConfig;
  theme?: Theme;
  document: RootPageNode;
}

export type ArtboardType = 'page' | 'component';

export interface Artboard {
  id: string;
  name: string;
  artboardType: ArtboardType;
  slug?: string;
  triggerId?: string;
  viewport?: 'desktop' | 'tablet' | 'mobile';
  width?: number;
  position?: { x: number; y: number };
  document: PageDocument;
}

export interface ProjectDocument {
  schema: 'stora.project';
  version: string;
  metadata?: DocumentMetadata;
  tracking?: TrackingConfig;
  artboards: Artboard[];
  activeArtboardId?: string;
}

/* ----------------------------------------------------------------------------------------
 * Package manifest & templates
 * -------------------------------------------------------------------------------------- */

export interface ManifestAssetItem {
  id: string;
  path: string;
  mimeType: string;
  size: number;
  checksum?: string;
}

export interface Manifest {
  schema: 'stora.page';
  schemaVersion: string;
  packageVersion: string;
  builderCompatibility: string;
  requiredComponents: string[];
  requiredCapabilities: string[];
  assets: ManifestAssetItem[];
  createdAt?: string;
}

export interface SafeThumbnailObject {
  url: string;
  alt?: string;
  width?: number;
  height?: number;
}

export type SafeThumbnail = AssetReference | SafeThumbnailObject | string;

export interface TemplatePackageRef {
  path?: string;
  url?: string;
  checksum?: string;
  format: 'stora' | 'json';
}

export interface TemplateRequirements {
  requiredComponents: string[];
  requiredCapabilities: string[];
}

export interface TemplateRecord {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  thumbnail?: SafeThumbnail;
  author: string;
  version: string;
  document?: PageDocument;
  packageReference?: TemplatePackageRef;
  requirements: TemplateRequirements;
  createdAt?: string;
  updatedAt?: string;
  custom?: Record<string, unknown>;
}

/* ----------------------------------------------------------------------------------------
 * Zod-free validation results (see `@kubuild/schema/validate`)
 * -------------------------------------------------------------------------------------- */

export interface SchemaValidationIssue {
  /** Dotted path to the offending value, e.g. `document.children.0.id` (empty for root). */
  path: string;
  message: string;
  /** Validator issue code (e.g. `invalid_type`, `custom`). */
  code: string;
}

export type SchemaValidationResult<T> =
  | { success: true; data: T; issues: [] }
  | { success: false; data?: undefined; issues: SchemaValidationIssue[] };
