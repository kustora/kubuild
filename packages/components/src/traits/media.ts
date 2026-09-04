import { ComponentTraitDefinition, withOverrides } from './types';

/** `src` — the source URL for media (image, video). */
export function srcTrait(overrides?: Partial<ComponentTraitDefinition>): ComponentTraitDefinition {
  return withOverrides(
    {
      name: 'src',
      label: 'Source URL',
      type: 'string',
      attribute: 'src',
      group: 'media',
      required: true,
      description: 'The source URL of the media resource.',
    },
    overrides,
  );
}

/** `alt` — alternative text for media, required for accessibility. */
export function altTrait(overrides?: Partial<ComponentTraitDefinition>): ComponentTraitDefinition {
  return withOverrides(
    {
      name: 'alt',
      label: 'Alt Text',
      type: 'string',
      attribute: 'alt',
      group: 'accessibility',
      required: true,
      description: 'Alternative text describing the media for screen readers and fallback.',
    },
    overrides,
  );
}

/** `poster` — a preview image shown before a video plays. */
export function posterTrait(overrides?: Partial<ComponentTraitDefinition>): ComponentTraitDefinition {
  return withOverrides(
    {
      name: 'poster',
      label: 'Poster Image URL',
      type: 'string',
      attribute: 'poster',
      group: 'media',
      description: 'A preview image shown before the video starts playing.',
    },
    overrides,
  );
}

/** `controls` — whether native media controls are shown. */
export function controlsTrait(overrides?: Partial<ComponentTraitDefinition>): ComponentTraitDefinition {
  return withOverrides(
    {
      name: 'controls',
      label: 'Show Controls',
      type: 'boolean',
      defaultValue: true,
      attribute: 'controls',
      group: 'media',
      description: 'Whether to show the native play/pause/volume controls.',
    },
    overrides,
  );
}

/** `autoplay` — whether media starts playing automatically. */
export function autoplayTrait(overrides?: Partial<ComponentTraitDefinition>): ComponentTraitDefinition {
  return withOverrides(
    {
      name: 'autoplay',
      label: 'Autoplay',
      type: 'boolean',
      defaultValue: false,
      attribute: 'autoplay',
      group: 'media',
      description: 'Whether the media starts playing automatically on load.',
    },
    overrides,
  );
}

/** `loop` — whether media restarts from the beginning when it ends. */
export function loopTrait(overrides?: Partial<ComponentTraitDefinition>): ComponentTraitDefinition {
  return withOverrides(
    {
      name: 'loop',
      label: 'Loop',
      type: 'boolean',
      defaultValue: false,
      attribute: 'loop',
      group: 'media',
      description: 'Whether the media restarts automatically when it reaches the end.',
    },
    overrides,
  );
}

/** `muted` — whether media starts with sound muted. */
export function mutedTrait(overrides?: Partial<ComponentTraitDefinition>): ComponentTraitDefinition {
  return withOverrides(
    {
      name: 'muted',
      label: 'Muted',
      type: 'boolean',
      defaultValue: false,
      attribute: 'muted',
      group: 'media',
      description: 'Whether the media starts with the audio muted.',
    },
    overrides,
  );
}

/** `loading` — native lazy/eager loading hint for images (STORA-213). */
export function loadingTrait(overrides?: Partial<ComponentTraitDefinition>): ComponentTraitDefinition {
  return withOverrides(
    {
      name: 'loading',
      label: 'Loading Mode',
      type: 'select',
      defaultValue: 'lazy',
      attribute: 'loading',
      group: 'media',
      options: [
        { label: 'Lazy (load when near viewport)', value: 'lazy' },
        { label: 'Eager (load immediately)', value: 'eager' },
      ],
      description: 'Native loading hint: lazy defers offscreen images, eager loads immediately.',
    },
    overrides,
  );
}

