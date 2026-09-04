import { describe, it, expect } from 'vitest';
import * as Root from '../src/index';
import * as Definitions from '../src/definitions/index';
import * as Traits from '../src/traits/index';
import * as Blocks from '../src/blocks/index';

describe('Subpath Exports Contract', () => {
  it('exports definitions independently', () => {
    expect(Definitions.pageDefinition).toBeDefined();
    expect(Definitions.buttonDefinition).toBeDefined();
    expect(Definitions.createDefaultComponentRegistry).toBeDefined();
    expect(Definitions.coreComponentDefinitions.length).toBe(33);
  });

  it('exports traits independently', () => {
    expect(Traits.idTrait).toBeDefined();
    expect(Traits.ariaLabelTrait).toBeDefined();
    expect(Traits.buttonTypeTrait).toBeDefined();
    expect(Traits.TRAIT_GROUP_ORDER).toBeDefined();
    expect(typeof Traits.sortTraits).toBe('function');
  });

  it('exports blocks independently', () => {
    expect(Blocks.STARTER_BLOCKS).toBeDefined();
    expect(Blocks.LAYOUT_STARTER_BLOCKS).toBeDefined();
    expect(Blocks.UI_STARTER_BLOCKS).toBeDefined();
    expect(Blocks.FORM_STARTER_BLOCKS).toBeDefined();
    expect(Blocks.STARTER_BLOCKS.length).toBe(13);
  });

  it('root re-exports all submodules for backwards compatibility', () => {
    expect(Root.pageDefinition).toBe(Definitions.pageDefinition);
    expect(Root.idTrait).toBe(Traits.idTrait);
    expect(Root.STARTER_BLOCKS).toBe(Blocks.STARTER_BLOCKS);
  });
});

