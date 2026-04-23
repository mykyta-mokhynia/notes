import { JSONContent } from '@tiptap/core';
import {
  DatabaseSchemaAttrs,
  DatabaseSchemaEditorValue,
  DEFAULT_ENTITY_STYLE,
  DEFAULT_SCHEMA_CANVAS,
  DEFAULT_SCHEMA_VIEW,
  SchemaEntity,
  SchemaColorToken,
  SchemaRelationFieldPortSide,
  SchemaRelationEndingMode,
  SCHEMA_COLOR_TOKENS,
  SchemaRelationKind,
  VisualSchemaModel,
  VisualSchemaViewState,
} from './database-schema-types';

const DEFAULT_TITLE = 'Название схемы';
const LEGACY_DEFAULT_BODY = 'users\n- id uuid\n- email text\n- created_at timestamptz';

function createId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeTitle(raw: unknown): string {
  return typeof raw === 'string' && raw.trim() ? raw.trim() : DEFAULT_TITLE;
}

function normalizeBody(raw: unknown): string {
  return typeof raw === 'string' && raw.trim() ? raw : LEGACY_DEFAULT_BODY;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function toNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function normalizePoint(raw: unknown): { x: number; y: number } | null {
  if (!isObject(raw)) return null;
  const x = raw['x'];
  const y = raw['y'];
  if (typeof x !== 'number' || !Number.isFinite(x) || typeof y !== 'number' || !Number.isFinite(y)) {
    return null;
  }
  return { x, y };
}

function normalizeColorToken(value: unknown, fallback: SchemaColorToken): SchemaColorToken {
  if (typeof value === 'string' && (SCHEMA_COLOR_TOKENS as readonly string[]).includes(value)) {
    return value as SchemaColorToken;
  }
  return fallback;
}

function normalizeEntity(raw: unknown, index: number): SchemaEntity {
  const safe = isObject(raw) ? raw : {};
  const rawName = typeof safe['name'] === 'string' && safe['name'].trim() ? safe['name'].trim() : `Entity ${index + 1}`;
  const rawFields = Array.isArray(safe['fields']) ? safe['fields'] : [];
  const fields = rawFields
    .filter((field) => isObject(field))
    .map((field, fieldIndex) => {
      const token = normalizeColorToken(field['colorToken'], 'default');
      return {
        id: typeof field['id'] === 'string' ? field['id'] : createId('field'),
        name: typeof field['name'] === 'string' && field['name'].trim() ? field['name'].trim() : `field_${fieldIndex + 1}`,
        type: typeof field['type'] === 'string' && field['type'].trim() ? field['type'].trim() : 'text',
        nullable: typeof field['nullable'] === 'boolean' ? field['nullable'] : true,
        isPrimary: typeof field['isPrimary'] === 'boolean' ? field['isPrimary'] : false,
        isUnique: typeof field['isUnique'] === 'boolean' ? field['isUnique'] : false,
        isIndexed: typeof field['isIndexed'] === 'boolean' ? field['isIndexed'] : false,
        isAutoIncrement: typeof field['isAutoIncrement'] === 'boolean' ? field['isAutoIncrement'] : false,
        colorToken: token === 'default' ? null : token,
      };
    });
  const metadataRaw = Array.isArray(safe['metadata']) ? safe['metadata'] : [];
  const metadata = metadataRaw
    .filter((item) => isObject(item))
    .map((item) => ({
      id: typeof item['id'] === 'string' ? item['id'] : createId('meta'),
      key: typeof item['key'] === 'string' ? item['key'] : '',
      value: typeof item['value'] === 'string' ? item['value'] : '',
    }));

  const styleRaw = isObject(safe['style']) ? safe['style'] : {};
  const sectionRaw = isObject(safe['sections']) ? safe['sections'] : {};
  return {
    id: typeof safe['id'] === 'string' ? safe['id'] : createId('entity'),
    name: rawName,
    fields,
    metadata,
    position: {
      x: toNumber(isObject(safe['position']) ? safe['position']['x'] : undefined, 80 + index * 40),
      y: toNumber(isObject(safe['position']) ? safe['position']['y'] : undefined, 80 + index * 24),
    },
    size: {
      w: Math.max(220, toNumber(isObject(safe['size']) ? safe['size']['w'] : undefined, 300)),
      h: Math.max(160, toNumber(isObject(safe['size']) ? safe['size']['h'] : undefined, 220)),
    },
    style: {
      titleColor:
        typeof styleRaw['titleColor'] === 'string' && styleRaw['titleColor'].trim()
          ? styleRaw['titleColor']
          : DEFAULT_ENTITY_STYLE.titleColor,
      blockColor:
        typeof styleRaw['blockColor'] === 'string' && styleRaw['blockColor'].trim()
          ? styleRaw['blockColor']
          : DEFAULT_ENTITY_STYLE.blockColor,
      accentColor:
        typeof styleRaw['accentColor'] === 'string' && styleRaw['accentColor'].trim()
          ? styleRaw['accentColor']
          : DEFAULT_ENTITY_STYLE.accentColor,
      colorToken: normalizeColorToken(styleRaw['colorToken'], DEFAULT_ENTITY_STYLE.colorToken),
    },
    collapsed: typeof safe['collapsed'] === 'boolean' ? safe['collapsed'] : false,
    sections: {
      fieldsCollapsed: typeof sectionRaw['fieldsCollapsed'] === 'boolean' ? sectionRaw['fieldsCollapsed'] : false,
      metaCollapsed: typeof sectionRaw['metaCollapsed'] === 'boolean' ? sectionRaw['metaCollapsed'] : false,
    },
  };
}

function buildSchemaFromLegacyText(body: string, title: string): VisualSchemaModel {
  const lines = body.split('\n').map((line) => line.trim()).filter(Boolean);
  const entity = normalizeEntity(
    {
      name: title,
      fields: lines.map((line, index) => ({
        id: createId('field'),
        name: line.replace(/^-+\s*/, ''),
        type: index === 0 ? 'primary' : 'text',
        nullable: index !== 0,
        isPrimary: index === 0,
        isUnique: false,
        isIndexed: false,
        isAutoIncrement: false,
      })),
      metadata: [],
      position: { x: 120, y: 80 },
      size: { w: 340, h: 280 },
      style: DEFAULT_ENTITY_STYLE,
      collapsed: false,
      sections: { fieldsCollapsed: false, metaCollapsed: false },
    },
    0
  );
  return {
    version: 2,
    entities: [entity],
    relations: [],
    canvas: { ...DEFAULT_SCHEMA_CANVAS },
  };
}

function normalizeSchema(raw: unknown, fallbackBody: string, fallbackTitle: string): VisualSchemaModel {
  if (!isObject(raw)) {
    return buildSchemaFromLegacyText(fallbackBody, fallbackTitle);
  }
  const entitiesRaw = Array.isArray(raw['entities']) ? raw['entities'] : [];
  const relationsRaw = Array.isArray(raw['relations']) ? raw['relations'] : [];
  const entities = entitiesRaw.map((entity, index) => normalizeEntity(entity, index));
  const entityIds = new Set(entities.map((entity) => entity.id));
  const fieldsByEntityId = new Map(entities.map((entity) => [entity.id, new Set(entity.fields.map((field) => field.id))]));
  const relations = relationsRaw
    .filter((relation) => isObject(relation))
    .map((relation) => ({
      id: typeof relation['id'] === 'string' ? relation['id'] : createId('rel'),
      fromEntityId: typeof relation['fromEntityId'] === 'string' ? relation['fromEntityId'] : '',
      toEntityId: typeof relation['toEntityId'] === 'string' ? relation['toEntityId'] : '',
      fromFieldId: typeof relation['fromFieldId'] === 'string' ? relation['fromFieldId'] : null,
      toFieldId: typeof relation['toFieldId'] === 'string' ? relation['toFieldId'] : null,
      fromPortSide:
        relation['fromPortSide'] === 'left' || relation['fromPortSide'] === 'right'
          ? (relation['fromPortSide'] as SchemaRelationFieldPortSide)
          : null,
      toPortSide:
        relation['toPortSide'] === 'left' || relation['toPortSide'] === 'right'
          ? (relation['toPortSide'] as SchemaRelationFieldPortSide)
          : null,
      bendPoints: Array.isArray(relation['bendPoints'])
        ? relation['bendPoints'].map((point) => normalizePoint(point)).filter((point): point is { x: number; y: number } => !!point)
        : [],
      endingMode:
        relation['endingMode'] === 'edge' || relation['endingMode'] === 'offset-edge' || relation['endingMode'] === 'port'
          ? (relation['endingMode'] as SchemaRelationEndingMode)
          : ('port' as SchemaRelationEndingMode),
      kind:
        relation['kind'] === 'one-to-one' || relation['kind'] === 'one-to-many' || relation['kind'] === 'many-to-many'
          ? (relation['kind'] as SchemaRelationKind)
          : ('one-to-many' as SchemaRelationKind),
      label: typeof relation['label'] === 'string' ? relation['label'] : '',
      style: {
        color:
          isObject(relation['style']) && typeof relation['style']['color'] === 'string'
            ? relation['style']['color']
            : '#8892b0',
      },
    }))
    .filter((relation) => entityIds.has(relation.fromEntityId) && entityIds.has(relation.toEntityId))
    .map((relation) => {
      const fromFieldIds = fieldsByEntityId.get(relation.fromEntityId);
      const toFieldIds = fieldsByEntityId.get(relation.toEntityId);
      return {
        ...relation,
        fromFieldId: relation.fromFieldId && fromFieldIds?.has(relation.fromFieldId) ? relation.fromFieldId : null,
        toFieldId: relation.toFieldId && toFieldIds?.has(relation.toFieldId) ? relation.toFieldId : null,
        fromPortSide:
          relation.fromFieldId && fromFieldIds?.has(relation.fromFieldId) ? relation.fromPortSide : null,
        toPortSide:
          relation.toFieldId && toFieldIds?.has(relation.toFieldId) ? relation.toPortSide : null,
      };
    });

  const canvasRaw = isObject(raw['canvas']) ? raw['canvas'] : {};
  return {
    version: 2,
    entities: entities.length ? entities : buildSchemaFromLegacyText(fallbackBody, fallbackTitle).entities,
    relations,
    canvas: {
      gridSize: Math.max(8, toNumber(canvasRaw['gridSize'], DEFAULT_SCHEMA_CANVAS.gridSize)),
      snapToGrid:
        typeof canvasRaw['snapToGrid'] === 'boolean' ? canvasRaw['snapToGrid'] : DEFAULT_SCHEMA_CANVAS.snapToGrid,
      background:
        canvasRaw['background'] === 'grid' || canvasRaw['background'] === 'plain' || canvasRaw['background'] === 'dots'
          ? canvasRaw['background']
          : DEFAULT_SCHEMA_CANVAS.background,
    },
  };
}

function normalizeView(raw: unknown): VisualSchemaViewState {
  if (!isObject(raw)) return { ...DEFAULT_SCHEMA_VIEW };
  const panRaw = isObject(raw['pan']) ? raw['pan'] : {};
  return {
    collapsedAll: typeof raw['collapsedAll'] === 'boolean' ? raw['collapsedAll'] : DEFAULT_SCHEMA_VIEW.collapsedAll,
    zoom: Math.min(2, Math.max(0.35, toNumber(raw['zoom'], DEFAULT_SCHEMA_VIEW.zoom))),
    pan: {
      x: toNumber(panRaw['x'], DEFAULT_SCHEMA_VIEW.pan.x),
      y: toNumber(panRaw['y'], DEFAULT_SCHEMA_VIEW.pan.y),
    },
  };
}

export function summarizeSchema(schema: VisualSchemaModel): string {
  const lines: string[] = [];
  for (const entity of schema.entities) {
    lines.push(entity.name);
    for (const field of entity.fields) {
      const suffix = field.type ? ` ${field.type}` : '';
      lines.push(`- ${field.name}${suffix}`);
    }
    if (entity.metadata.length) {
      for (const item of entity.metadata) {
        if (item.key.trim() || item.value.trim()) {
          lines.push(`* ${item.key}: ${item.value}`);
        }
      }
    }
  }
  if (schema.relations.length) {
    lines.push('');
    lines.push('Relations:');
    for (const relation of schema.relations) {
      lines.push(`- ${relation.fromEntityId} -> ${relation.toEntityId} (${relation.kind})`);
    }
  }
  return lines.join('\n').trim();
}

export function schemaCounts(schema: VisualSchemaModel): { entities: number; fields: number; relations: number } {
  return {
    entities: schema.entities.length,
    fields: schema.entities.reduce((sum, entity) => sum + entity.fields.length, 0),
    relations: schema.relations.length,
  };
}

export function normalizeDatabaseSchemaAttrs(attrs: DatabaseSchemaAttrs): DatabaseSchemaEditorValue {
  const title = normalizeTitle(attrs.title);
  const body = normalizeBody(typeof attrs.body === 'string' ? attrs.body : attrs.schema);
  const schema = normalizeSchema(attrs.schema, body, title);
  const view = normalizeView(attrs.view);
  return {
    title,
    bodyText: summarizeSchema(schema) || body,
    schema,
    view,
  };
}

export function createDefaultDatabaseSchemaValue(): DatabaseSchemaEditorValue {
  return normalizeDatabaseSchemaAttrs({
    title: DEFAULT_TITLE,
    body: LEGACY_DEFAULT_BODY,
  });
}

export function toDatabaseSchemaNodeAttrs(value: DatabaseSchemaEditorValue): Record<string, unknown> {
  const summary = summarizeSchema(value.schema) || value.bodyText || LEGACY_DEFAULT_BODY;
  return {
    title: value.title.trim() || DEFAULT_TITLE,
    body: summary,
    schema: value.schema,
    view: value.view,
  };
}

export function migrateDatabaseSchemaInDoc(doc: JSONContent): JSONContent {
  const convertNode = (node: JSONContent): JSONContent => {
    if (node.type === 'databaseSchema') {
      const attrs = (node.attrs ?? {}) as DatabaseSchemaAttrs;
      const normalized = normalizeDatabaseSchemaAttrs(attrs);
      return {
        ...node,
        attrs: toDatabaseSchemaNodeAttrs(normalized),
      };
    }
    const content = Array.isArray(node.content) ? node.content : undefined;
    if (!content) return node;
    return {
      ...node,
      content: content.map((child) => convertNode(child)),
    };
  };
  return convertNode(doc);
}
