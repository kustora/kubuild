import { describe, it, expect } from 'vitest';
import {
  createDefaultComponentRegistry,
  tableDefinition,
  tableRowDefinition,
  tableCellDefinition,
} from '../src/index';

describe('STORA-191: Table component definitions', () => {
  it('registers table, table-row, and table-cell in default component registry', () => {
    const registry = createDefaultComponentRegistry();
    expect(registry.has('table')).toBe(true);
    expect(registry.has('table-row')).toBe(true);
    expect(registry.has('table-cell')).toBe(true);

    const tableDef = registry.get('table');
    expect(tableDef?.category).toBe('layout');
    expect(tableDef?.acceptsChildren).toBe(true);
    expect(tableDef?.allowedChildren).toEqual(['table-row']);

    const rowDef = registry.get('table-row');
    expect(rowDef?.acceptsChildren).toBe(true);
    expect(rowDef?.allowedChildren).toEqual(['table-cell']);

    const cellDef = registry.get('table-cell');
    expect(cellDef?.acceptsChildren).toBe(true);
  });

  it('validates table and table-row props', () => {
    expect(tableDefinition.validateProps?.({ striped: true, bordered: true, compact: false })).toBe(true);
    expect(tableDefinition.validateProps?.({})).toBe(true);
    expect(tableRowDefinition.validateProps?.({}) ?? true).toBe(true);

    const invalidStriped = tableDefinition.validateProps?.({ striped: 'yes' as unknown as boolean });
    expect(Array.isArray(invalidStriped)).toBe(true);
    expect((invalidStriped as string[])[0]).toContain('must be a boolean');
  });

  it('validates table-cell props (tag, colSpan, rowSpan, text)', () => {
    expect(tableCellDefinition.validateProps?.({ tag: 'td', colSpan: 2, rowSpan: 3, text: 'Hello' })).toBe(true);
    expect(tableCellDefinition.validateProps?.({ tag: 'th', text: 'Header' })).toBe(true);

    const invalidTag = tableCellDefinition.validateProps?.({ tag: 'div' });
    expect(Array.isArray(invalidTag)).toBe(true);
    expect((invalidTag as string[])[0]).toContain('must be either "td" or "th"');

    const invalidColSpan = tableCellDefinition.validateProps?.({ colSpan: 0 });
    expect(Array.isArray(invalidColSpan)).toBe(true);
    expect((invalidColSpan as string[])[0]).toContain('must be a positive integer');

    const invalidRowSpan = tableCellDefinition.validateProps?.({ rowSpan: -1 });
    expect(Array.isArray(invalidRowSpan)).toBe(true);
    expect((invalidRowSpan as string[])[0]).toContain('must be a positive integer');
  });

  it('enforces table hierarchy (section > table > table-row > table-cell)', () => {
    const registry = createDefaultComponentRegistry();

    expect(registry.canInsertChild('section', 'table').valid).toBe(true);
    expect(registry.canInsertChild('table', 'table-row').valid).toBe(true);
    expect(registry.canInsertChild('table', 'button').valid).toBe(false);

    expect(registry.canInsertChild('table-row', 'table-cell').valid).toBe(true);
    expect(registry.canInsertChild('table-row', 'text').valid).toBe(false);

    expect(registry.canInsertChild('table-cell', 'text').valid).toBe(true);
    expect(registry.canInsertChild('table-cell', 'button').valid).toBe(true);
    expect(registry.canInsertChild('table-cell', 'heading').valid).toBe(true);
  });
});

