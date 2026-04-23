export type SchemaRelationKind = 'one-to-one' | 'one-to-many' | 'many-to-many';
export type SchemaRelationEndingMode = 'edge' | 'offset-edge' | 'port';
export type SchemaRelationFieldPortSide = 'left' | 'right';
export const SCHEMA_COLOR_TOKENS = ['default', 'slate', 'blue', 'green', 'amber', 'rose', 'violet'] as const;
export type SchemaColorToken = (typeof SCHEMA_COLOR_TOKENS)[number];

export interface SchemaField {
  id: string;
  name: string;
  type: string;
  nullable: boolean;
  isPrimary: boolean;
  isUnique: boolean;
  isIndexed: boolean;
  isAutoIncrement: boolean;
  colorToken: SchemaColorToken | null;
}

export interface SchemaMetaItem {
  id: string;
  key: string;
  value: string;
}

export interface SchemaEntityStyle {
  titleColor: string;
  blockColor: string;
  accentColor: string;
  colorToken: SchemaColorToken;
}

export interface SchemaEntitySectionState {
  fieldsCollapsed: boolean;
  metaCollapsed: boolean;
}

export interface SchemaEntity {
  id: string;
  name: string;
  fields: SchemaField[];
  metadata: SchemaMetaItem[];
  position: { x: number; y: number };
  size: { w: number; h: number };
  style: SchemaEntityStyle;
  collapsed: boolean;
  sections: SchemaEntitySectionState;
}

export interface SchemaRelationStyle {
  color: string;
}

export interface SchemaPoint {
  x: number;
  y: number;
}

export interface SchemaRelation {
  id: string;
  fromEntityId: string;
  toEntityId: string;
  fromFieldId: string | null;
  toFieldId: string | null;
  fromPortSide: SchemaRelationFieldPortSide | null;
  toPortSide: SchemaRelationFieldPortSide | null;
  bendPoints: SchemaPoint[];
  endingMode: SchemaRelationEndingMode;
  kind: SchemaRelationKind;
  label: string;
  style: SchemaRelationStyle;
}

export interface SchemaCanvasState {
  gridSize: number;
  snapToGrid: boolean;
  background: 'dots' | 'grid' | 'plain';
}

export interface VisualSchemaModel {
  version: 2;
  entities: SchemaEntity[];
  relations: SchemaRelation[];
  canvas: SchemaCanvasState;
}

export interface VisualSchemaViewState {
  collapsedAll: boolean;
  zoom: number;
  pan: { x: number; y: number };
}

export interface DatabaseSchemaEditorValue {
  title: string;
  bodyText: string;
  schema: VisualSchemaModel;
  view: VisualSchemaViewState;
}

export interface DatabaseSchemaAttrs {
  title?: unknown;
  body?: unknown;
  schema?: unknown;
  view?: unknown;
}

export const DEFAULT_ENTITY_STYLE: SchemaEntityStyle = {
  titleColor: '#2f4f9b',
  blockColor: '#ffffff',
  accentColor: '#5f6bd8',
  colorToken: 'blue',
};

export const DEFAULT_SCHEMA_CANVAS: SchemaCanvasState = {
  gridSize: 16,
  snapToGrid: false,
  background: 'dots',
};

export const DEFAULT_SCHEMA_VIEW: VisualSchemaViewState = {
  collapsedAll: false,
  zoom: 1,
  pan: { x: 0, y: 0 },
};
