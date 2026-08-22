/**
 * Standard JSON Schema Draft-07 representation of stora.page Document v1
 * Aligned 1:1 with TypeScript PageDocument type definition.
 */
export const PAGE_DOCUMENT_JSON_SCHEMA_V1 = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://schema.stora.page/v1/page.json',
  title: 'StoraPageDocument',
  description: 'Portable Web Page Document v1 schema definition for KUBUILD',
  type: 'object',
  required: ['schema', 'version', 'document'],
  additionalProperties: false,
  properties: {
    schema: {
      type: 'string',
      const: 'stora.page',
      description: 'Identifies the document type format',
    },
    version: {
      type: 'string',
      pattern: '^\\d+(\\.\\d+)*$',
      description: 'Schema version of the document',
      default: '1.0.0',
    },
    metadata: {
      $ref: '#/definitions/documentMetadata',
    },
    document: {
      $ref: '#/definitions/rootPageNode',
    },
  },
  definitions: {
    styleValue: {
      type: ['string', 'number', 'boolean', 'null'],
      description: 'A CSS property or design token value',
    },
    styleDefinition: {
      type: 'object',
      additionalProperties: {
        $ref: '#/definitions/styleValue',
      },
      description: 'Key-value map of style properties',
    },
    responsiveStyles: {
      type: 'object',
      properties: {
        base: { $ref: '#/definitions/styleDefinition' },
        desktop: { $ref: '#/definitions/styleDefinition' },
        tablet: { $ref: '#/definitions/styleDefinition' },
        mobile: { $ref: '#/definitions/styleDefinition' },
      },
      additionalProperties: {
        $ref: '#/definitions/styleDefinition',
      },
    },
    assetReference: {
      type: 'object',
      required: ['type', 'assetId'],
      properties: {
        type: {
          type: 'string',
          const: 'asset',
        },
        assetId: {
          type: 'string',
          minLength: 1,
        },
        filename: {
          type: 'string',
        },
        mimeType: {
          type: 'string',
        },
        fallbackUrl: {
          type: 'string',
          format: 'uri',
        },
      },
      additionalProperties: false,
    },
    variableBinding: {
      type: 'object',
      required: ['type', 'key'],
      properties: {
        type: {
          type: 'string',
          const: 'variable',
        },
        key: {
          type: 'string',
          minLength: 1,
        },
        fallback: {},
      },
      additionalProperties: false,
    },
    actionBinding: {
      type: 'object',
      required: ['type'],
      properties: {
        type: {
          type: 'string',
          minLength: 1,
        },
        payload: {
          type: 'object',
        },
      },
      additionalProperties: false,
    },
    node: {
      type: 'object',
      required: ['id', 'type'],
      properties: {
        id: {
          type: 'string',
          minLength: 1,
          description: 'Unique deterministic node identifier',
        },
        type: {
          type: 'string',
          minLength: 1,
          description: 'Component type identifier',
        },
        props: {
          type: 'object',
          description: 'Component props payload and bindings',
          default: {},
        },
        styles: {
          $ref: '#/definitions/responsiveStyles',
        },
        children: {
          type: 'array',
          items: {
            $ref: '#/definitions/node',
          },
          default: [],
        },
      },
      additionalProperties: false,
    },
    rootPageNode: {
      allOf: [
        { $ref: '#/definitions/node' },
        {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              const: 'page',
              description: 'The root node type must be "page"',
            },
          },
        },
      ],
    },
    documentMetadata: {
      type: 'object',
      required: ['title'],
      properties: {
        title: {
          type: 'string',
          minLength: 1,
          default: 'Untitled Page',
        },
        description: {
          type: 'string',
          default: '',
        },
        author: {
          type: 'string',
          default: '',
        },
        createdAt: {
          type: 'string',
          format: 'date-time',
        },
        updatedAt: {
          type: 'string',
          format: 'date-time',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          default: [],
        },
        category: {
          type: 'string',
          default: 'general',
        },
        version: {
          type: 'string',
          default: '1.0.0',
        },
        custom: {
          type: 'object',
        },
      },
      additionalProperties: false,
    },
  },
} as const;

export function getPageDocumentJsonSchema() {
  return PAGE_DOCUMENT_JSON_SCHEMA_V1;
}
