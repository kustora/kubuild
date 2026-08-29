import { describe, it, expect } from 'vitest';
import {
  idTrait,
  hrefTrait,
  targetTrait,
  srcTrait,
  altTrait,
  fieldNameTrait,
  placeholderTrait,
  requiredTrait,
  disabledTrait,
  sortTraits,
  collectTraitNames,
  TRAIT_GROUP_ORDER,
  TRAIT_GROUP_LABELS,
} from '../src/traits';
import {
  createDefaultComponentRegistry,
  imageDefinition,
  linkDefinition,
  inputDefinition,
  buttonDefinition,
  formDefinition,
} from '../src/index';

describe('Trait Metadata (STORA-210)', () => {
  describe('Trait Factories', () => {
    it('creates idTrait with correct defaults', () => {
      const trait = idTrait();
      expect(trait.name).toBe('id');
      expect(trait.type).toBe('string');
      expect(trait.attribute).toBe('id');
      expect(trait.group).toBe('identity');
      expect(trait.label).toBe('Element ID');
    });

    it('creates hrefTrait with correct defaults', () => {
      const trait = hrefTrait();
      expect(trait.name).toBe('href');
      expect(trait.type).toBe('string');
      expect(trait.defaultValue).toBe('#');
      expect(trait.attribute).toBe('href');
      expect(trait.group).toBe('link');
    });

    it('allows trait overrides', () => {
      const trait = hrefTrait({ defaultValue: 'https://example.com', required: true });
      expect(trait.defaultValue).toBe('https://example.com');
      expect(trait.required).toBe(true);
      expect(trait.name).toBe('href');
      expect(trait.group).toBe('link');
    });

    it('creates srcTrait with required flag', () => {
      const trait = srcTrait();
      expect(trait.name).toBe('src');
      expect(trait.required).toBe(true);
      expect(trait.group).toBe('media');
    });

    it('creates altTrait with required flag', () => {
      const trait = altTrait();
      expect(trait.name).toBe('alt');
      expect(trait.required).toBe(true);
      expect(trait.group).toBe('accessibility');
    });

    it('creates select-type traits with options', () => {
      const trait = targetTrait();
      expect(trait.type).toBe('select');
      expect(trait.options).toBeDefined();
      expect(trait.options?.length).toBeGreaterThan(0);
      expect(trait.options?.[0]).toHaveProperty('label');
      expect(trait.options?.[0]).toHaveProperty('value');
    });

    it('creates boolean traits with default values', () => {
      const required = requiredTrait();
      const disabled = disabledTrait();

      expect(required.type).toBe('boolean');
      expect(required.defaultValue).toBe(false);
      expect(disabled.type).toBe('boolean');
      expect(disabled.defaultValue).toBe(false);
    });

    it('creates form field traits', () => {
      const name = fieldNameTrait();
      const placeholder = placeholderTrait();

      expect(name.name).toBe('name');
      expect(name.group).toBe('form');
      expect(name.required).toBe(true);

      expect(placeholder.name).toBe('placeholder');
      expect(placeholder.group).toBe('form');
    });
  });

  describe('Component Trait Definitions', () => {
    it('image has required functional traits', () => {
      expect(imageDefinition.traits).toBeDefined();
      const traits = imageDefinition.traits!;

      const srcTrait = traits.find((t) => t.name === 'src');
      const altTrait = traits.find((t) => t.name === 'alt');
      const idTrait = traits.find((t) => t.name === 'id');

      expect(srcTrait).toBeDefined();
      expect(srcTrait?.required).toBe(true);
      expect(altTrait).toBeDefined();
      expect(altTrait?.required).toBe(true);
      expect(idTrait).toBeDefined();
    });

    it('link has navigation traits', () => {
      expect(linkDefinition.traits).toBeDefined();
      const traits = linkDefinition.traits!;

      const hrefTrait = traits.find((t) => t.name === 'href');
      const targetTrait = traits.find((t) => t.name === 'target');
      const relTrait = traits.find((t) => t.name === 'rel');

      expect(hrefTrait).toBeDefined();
      expect(hrefTrait?.group).toBe('link');
      expect(targetTrait).toBeDefined();
      expect(targetTrait?.type).toBe('select');
      expect(relTrait).toBeDefined();
    });

    it('input has form control traits', () => {
      expect(inputDefinition.traits).toBeDefined();
      const traits = inputDefinition.traits!;

      const nameTrait = traits.find((t) => t.name === 'name');
      const placeholderTrait = traits.find((t) => t.name === 'placeholder');
      const requiredTrait = traits.find((t) => t.name === 'required');
      const disabledTrait = traits.find((t) => t.name === 'disabled');

      expect(nameTrait).toBeDefined();
      expect(nameTrait?.required).toBe(true);
      expect(placeholderTrait).toBeDefined();
      expect(requiredTrait).toBeDefined();
      expect(requiredTrait?.type).toBe('boolean');
      expect(disabledTrait).toBeDefined();
    });

    it('button has both button and link traits', () => {
      expect(buttonDefinition.traits).toBeDefined();
      const traits = buttonDefinition.traits!;

      const buttonTypeTrait = traits.find((t) => t.name === 'buttonType');
      const hrefTrait = traits.find((t) => t.name === 'href');
      const disabledTrait = traits.find((t) => t.name === 'disabled');

      expect(buttonTypeTrait).toBeDefined();
      expect(buttonTypeTrait?.type).toBe('select');
      expect(hrefTrait).toBeDefined();
      expect(disabledTrait).toBeDefined();
    });

    it('form has form-specific traits', () => {
      expect(formDefinition.traits).toBeDefined();
      const traits = formDefinition.traits!;

      const actionTrait = traits.find((t) => t.name === 'action');
      const methodTrait = traits.find((t) => t.name === 'method');
      const autoCompleteTrait = traits.find((t) => t.name === 'autoComplete');

      expect(actionTrait).toBeDefined();
      expect(methodTrait).toBeDefined();
      expect(methodTrait?.type).toBe('select');
      expect(autoCompleteTrait).toBeDefined();
    });
  });

  describe('All Components Have Traits', () => {
    it('all registered components have traits metadata', () => {
      const registry = createDefaultComponentRegistry();
      const allTypes = registry.list().map((def) => def.type);

      // Layout components can have minimal traits (just id)
      // but content/form/media components should have richer traits
      const contentTypes = [
        'heading',
        'text',
        'paragraph',
        'link',
        'image',
        'video',
        'button',
        'input',
        'textarea',
        'select',
        'checkbox',
        'radio',
        'form',
      ];

      for (const type of contentTypes) {
        const def = registry.get(type);
        expect(def?.traits, `${type} should have traits`).toBeDefined();
        expect(def?.traits?.length, `${type} should have at least one trait`).toBeGreaterThan(0);
      }
    });

    it('no component has duplicate trait names', () => {
      const registry = createDefaultComponentRegistry();

      for (const def of registry.list()) {
        if (!def.traits) continue;

        const names = def.traits.map((t) => t.name);
        const uniqueNames = new Set(names);

        expect(
          uniqueNames.size,
          `${def.type} has duplicate trait names: ${names.join(', ')}`,
        ).toBe(names.length);
      }
    });
  });

  describe('Trait Groups', () => {
    it('TRAIT_GROUP_ORDER has correct groups', () => {
      expect(TRAIT_GROUP_ORDER).toEqual([
        'identity',
        'link',
        'media',
        'form',
        'behavior',
        'semantic',
        'accessibility',
      ]);
    });

    it('TRAIT_GROUP_LABELS covers all groups', () => {
      for (const group of TRAIT_GROUP_ORDER) {
        expect(TRAIT_GROUP_LABELS[group]).toBeDefined();
        expect(typeof TRAIT_GROUP_LABELS[group]).toBe('string');
      }
    });

    it('sortTraits orders by group rank', () => {
      const traits = [
        { name: 'ariaLabel', group: 'accessibility' as const, type: 'string' as const, label: 'Aria' },
        { name: 'id', group: 'identity' as const, type: 'string' as const, label: 'ID' },
        { name: 'href', group: 'link' as const, type: 'string' as const, label: 'Link' },
        { name: 'required', group: 'form' as const, type: 'boolean' as const, label: 'Required' },
      ];

      const sorted = sortTraits(traits);

      expect(sorted[0].name).toBe('id'); // identity first
      expect(sorted[1].name).toBe('href'); // link second
      expect(sorted[2].name).toBe('required'); // form third
      expect(sorted[3].name).toBe('ariaLabel'); // accessibility last
    });

    it('sortTraits handles ungrouped traits', () => {
      const traits = [
        { name: 'id', group: 'identity' as const, type: 'string' as const, label: 'ID' },
        { name: 'custom', type: 'string' as const, label: 'Custom' }, // no group
      ];

      const sorted = sortTraits(traits);

      expect(sorted[0].name).toBe('id'); // grouped first
      expect(sorted[1].name).toBe('custom'); // ungrouped last
    });
  });

  describe('Utility Functions', () => {
    it('collectTraitNames gathers all unique trait names', () => {
      const traitsList = [
        [idTrait(), hrefTrait()],
        [hrefTrait(), srcTrait()],
        [altTrait(), idTrait()],
      ];

      const names = collectTraitNames(traitsList);

      expect(names).toContain('id');
      expect(names).toContain('href');
      expect(names).toContain('src');
      expect(names).toContain('alt');
      expect(names.length).toBe(4); // unique only
    });

    it('collectTraitNames handles empty lists', () => {
      const names = collectTraitNames([]);
      expect(names).toEqual([]);
    });
  });

  describe('Trait Attributes Map to HTML', () => {
    it('traits have correct attribute mappings', () => {
      expect(idTrait().attribute).toBe('id');
      expect(hrefTrait().attribute).toBe('href');
      expect(srcTrait().attribute).toBe('src');
      expect(altTrait().attribute).toBe('alt');
      expect(fieldNameTrait().attribute).toBe('name');
      expect(placeholderTrait().attribute).toBe('placeholder');
      expect(requiredTrait().attribute).toBe('required');
      expect(disabledTrait().attribute).toBe('disabled');
    });

    it('aria traits use kebab-case attributes', () => {
      const ariaLabel = idTrait({ name: 'ariaLabel', attribute: 'aria-label' });
      expect(ariaLabel.attribute).toBe('aria-label');
    });
  });

  describe('Trait Data Types', () => {
    it('supports string traits', () => {
      const trait = idTrait();
      expect(trait.type).toBe('string');
    });

    it('supports boolean traits', () => {
      const trait = requiredTrait();
      expect(trait.type).toBe('boolean');
    });

    it('supports number traits', () => {
      const trait = { name: 'rows', type: 'number' as const, defaultValue: 4, label: 'Rows' };
      expect(trait.type).toBe('number');
      expect(trait.defaultValue).toBe(4);
    });

    it('supports select traits with options', () => {
      const trait = targetTrait();
      expect(trait.type).toBe('select');
      expect(Array.isArray(trait.options)).toBe(true);
    });
  });
});
