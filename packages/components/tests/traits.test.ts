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
  preventDefaultTrait,
  scrollToFirstErrorTrait,
  resetOnSubmitTrait,
  patternTrait,
  minLengthTrait,
  maxLengthTrait,
  prefixIconTrait,
  suffixIconTrait,
  helperTextTrait,
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

// ---------------------------------------------------------------------------
// STORA-330 — Form Behavior Trait Factories & Definition
// ---------------------------------------------------------------------------
describe('Form Behavior Traits (STORA-330)', () => {
  describe('Trait Factories', () => {
    it('creates preventDefaultTrait with boolean type and true default', () => {
      const trait = preventDefaultTrait();
      expect(trait.name).toBe('preventDefault');
      expect(trait.type).toBe('boolean');
      expect(trait.defaultValue).toBe(true);
      expect(trait.group).toBe('form');
    });

    it('creates scrollToFirstErrorTrait with boolean type and true default', () => {
      const trait = scrollToFirstErrorTrait();
      expect(trait.name).toBe('scrollToFirstError');
      expect(trait.type).toBe('boolean');
      expect(trait.defaultValue).toBe(true);
      expect(trait.group).toBe('form');
    });

    it('creates resetOnSubmitTrait with boolean type and false default', () => {
      const trait = resetOnSubmitTrait();
      expect(trait.name).toBe('resetOnSubmit');
      expect(trait.type).toBe('boolean');
      expect(trait.defaultValue).toBe(false);
      expect(trait.group).toBe('form');
    });

    it('allows overrides on form behavior traits', () => {
      const trait = resetOnSubmitTrait({ defaultValue: true, required: true });
      expect(trait.defaultValue).toBe(true);
      expect(trait.required).toBe(true);
      expect(trait.name).toBe('resetOnSubmit');
    });
  });

  describe('Form Definition Exposes Complete Form Trait Group', () => {
    it('form definition includes all STORA-330 behavior traits', () => {
      const traits = formDefinition.traits!;
      expect(traits.find((t) => t.name === 'preventDefault')).toBeDefined();
      expect(traits.find((t) => t.name === 'scrollToFirstError')).toBeDefined();
      expect(traits.find((t) => t.name === 'resetOnSubmit')).toBeDefined();
    });

    it('form definition exposes a complete Form trait group in the registry', () => {
      const traits = formDefinition.traits!;
      const formGroupTraits = traits.filter((t) => t.group === 'form');

      // Must include: name, action, method, autoComplete, preventDefault,
      // scrollToFirstError, resetOnSubmit
      const expectedNames = [
        'name',
        'action',
        'method',
        'autoComplete',
        'preventDefault',
        'scrollToFirstError',
        'resetOnSubmit',
      ];
      for (const expected of expectedNames) {
        expect(
          formGroupTraits.find((t) => t.name === expected),
          `Form trait group should include "${expected}"`,
        ).toBeDefined();
      }
    });

    it('form defaultProps include behavior trait defaults', () => {
      expect(formDefinition.defaultProps?.preventDefault).toBe(true);
      expect(formDefinition.defaultProps?.scrollToFirstError).toBe(true);
      expect(formDefinition.defaultProps?.resetOnSubmit).toBe(false);
    });

    it('form propFields include behavior trait entries', () => {
      const fields = formDefinition.propFields!;
      expect(fields.find((f) => f.name === 'preventDefault')).toBeDefined();
      expect(fields.find((f) => f.name === 'scrollToFirstError')).toBeDefined();
      expect(fields.find((f) => f.name === 'resetOnSubmit')).toBeDefined();
    });

    it('form validateProps accepts valid behavior booleans', () => {
      const result = formDefinition.validateProps!({
        preventDefault: true,
        scrollToFirstError: false,
        resetOnSubmit: true,
      });
      expect(result).toBe(true);
    });

    it('form validateProps rejects invalid behavior prop types', () => {
      const result = formDefinition.validateProps!({
        preventDefault: 'yes',
        scrollToFirstError: 42,
        resetOnSubmit: 'no',
      });
      expect(Array.isArray(result)).toBe(true);
      expect((result as string[]).length).toBe(3);
    });
  });
});

// ---------------------------------------------------------------------------
// STORA-331 — Rich Input Trait Factories & Definition
// ---------------------------------------------------------------------------
describe('Rich Input Traits (STORA-331)', () => {
  describe('Trait Factories', () => {
    it('creates patternTrait with string type', () => {
      const trait = patternTrait();
      expect(trait.name).toBe('pattern');
      expect(trait.type).toBe('string');
      expect(trait.attribute).toBe('pattern');
      expect(trait.group).toBe('form');
    });

    it('creates minLengthTrait with number type', () => {
      const trait = minLengthTrait();
      expect(trait.name).toBe('minLength');
      expect(trait.type).toBe('number');
      expect(trait.attribute).toBe('minlength');
      expect(trait.group).toBe('form');
    });

    it('creates maxLengthTrait with number type', () => {
      const trait = maxLengthTrait();
      expect(trait.name).toBe('maxLength');
      expect(trait.type).toBe('number');
      expect(trait.attribute).toBe('maxlength');
      expect(trait.group).toBe('form');
    });

    it('creates prefixIconTrait with string type', () => {
      const trait = prefixIconTrait();
      expect(trait.name).toBe('prefixIcon');
      expect(trait.type).toBe('string');
      expect(trait.group).toBe('form');
      expect(trait.attribute).toBeUndefined(); // no direct HTML attribute
    });

    it('creates suffixIconTrait with string type', () => {
      const trait = suffixIconTrait();
      expect(trait.name).toBe('suffixIcon');
      expect(trait.type).toBe('string');
      expect(trait.group).toBe('form');
      expect(trait.attribute).toBeUndefined();
    });

    it('creates helperTextTrait with string type', () => {
      const trait = helperTextTrait();
      expect(trait.name).toBe('helperText');
      expect(trait.type).toBe('string');
      expect(trait.group).toBe('form');
    });

    it('allows overrides on input traits', () => {
      const trait = patternTrait({ defaultValue: '[A-Z]+', required: true });
      expect(trait.defaultValue).toBe('[A-Z]+');
      expect(trait.required).toBe(true);
      expect(trait.name).toBe('pattern');
    });
  });

  describe('Input Definition Includes Rich Traits', () => {
    it('input definition includes all STORA-331 traits', () => {
      const traits = inputDefinition.traits!;
      expect(traits.find((t) => t.name === 'pattern')).toBeDefined();
      expect(traits.find((t) => t.name === 'minLength')).toBeDefined();
      expect(traits.find((t) => t.name === 'maxLength')).toBeDefined();
      expect(traits.find((t) => t.name === 'prefixIcon')).toBeDefined();
      expect(traits.find((t) => t.name === 'suffixIcon')).toBeDefined();
      expect(traits.find((t) => t.name === 'helperText')).toBeDefined();
    });

    it('input definition still includes original traits', () => {
      const traits = inputDefinition.traits!;
      expect(traits.find((t) => t.name === 'type')).toBeDefined();
      expect(traits.find((t) => t.name === 'name')).toBeDefined();
      expect(traits.find((t) => t.name === 'placeholder')).toBeDefined();
      expect(traits.find((t) => t.name === 'defaultValue')).toBeDefined();
      expect(traits.find((t) => t.name === 'required')).toBeDefined();
      expect(traits.find((t) => t.name === 'disabled')).toBeDefined();
      expect(traits.find((t) => t.name === 'readOnly')).toBeDefined();
    });

    it('input propFields include rich trait entries', () => {
      const fields = inputDefinition.propFields!;
      expect(fields.find((f) => f.name === 'pattern')).toBeDefined();
      expect(fields.find((f) => f.name === 'minLength')).toBeDefined();
      expect(fields.find((f) => f.name === 'maxLength')).toBeDefined();
      expect(fields.find((f) => f.name === 'prefixIcon')).toBeDefined();
      expect(fields.find((f) => f.name === 'suffixIcon')).toBeDefined();
      expect(fields.find((f) => f.name === 'helperText')).toBeDefined();
    });

    it('input validateProps accepts valid rich trait values', () => {
      const result = inputDefinition.validateProps!({
        name: 'email',
        type: 'email',
        pattern: '^[a-z]+$',
        minLength: 3,
        maxLength: 100,
        prefixIcon: 'mail',
        suffixIcon: 'check',
        helperText: 'Enter your email address',
      });
      expect(result).toBe(true);
    });

    it('input validateProps rejects invalid pattern type', () => {
      const result = inputDefinition.validateProps!({
        pattern: 123,
      });
      expect(Array.isArray(result)).toBe(true);
      expect((result as string[])[0]).toContain('pattern');
    });

    it('input validateProps rejects invalid minLength (negative)', () => {
      const result = inputDefinition.validateProps!({
        minLength: -1,
      });
      expect(Array.isArray(result)).toBe(true);
      expect((result as string[])[0]).toContain('minLength');
    });

    it('input validateProps rejects non-integer maxLength', () => {
      const result = inputDefinition.validateProps!({
        maxLength: 3.5,
      });
      expect(Array.isArray(result)).toBe(true);
      expect((result as string[])[0]).toContain('maxLength');
    });

    it('input validateProps rejects invalid prefixIcon type', () => {
      const result = inputDefinition.validateProps!({
        prefixIcon: 42,
      });
      expect(Array.isArray(result)).toBe(true);
      expect((result as string[])[0]).toContain('prefixIcon');
    });

    it('input validateProps rejects invalid suffixIcon type', () => {
      const result = inputDefinition.validateProps!({
        suffixIcon: true,
      });
      expect(Array.isArray(result)).toBe(true);
      expect((result as string[])[0]).toContain('suffixIcon');
    });

    it('input validateProps rejects invalid helperText type', () => {
      const result = inputDefinition.validateProps!({
        helperText: 99,
      });
      expect(Array.isArray(result)).toBe(true);
      expect((result as string[])[0]).toContain('helperText');
    });
  });

  describe('Input supports configuring type, length constraints, and error messages visually', () => {
    it('input type can be set to text, number, or password', () => {
      const traits = inputDefinition.traits!;
      const typeTrait = traits.find((t) => t.name === 'type');
      expect(typeTrait).toBeDefined();
      expect(typeTrait?.type).toBe('select');

      const options = typeTrait?.options?.map((o) => o.value);
      expect(options).toContain('text');
      expect(options).toContain('number');
      expect(options).toContain('password');
    });

    it('input exposes minLength and maxLength as number traits', () => {
      const traits = inputDefinition.traits!;
      const min = traits.find((t) => t.name === 'minLength');
      const max = traits.find((t) => t.name === 'maxLength');
      expect(min?.type).toBe('number');
      expect(max?.type).toBe('number');
    });

    it('input exposes helperText as a visual error/hint mechanism', () => {
      const traits = inputDefinition.traits!;
      const helper = traits.find((t) => t.name === 'helperText');
      expect(helper).toBeDefined();
      expect(helper?.type).toBe('string');
      expect(helper?.group).toBe('form');
    });
  });
});
