import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, ViewChild, computed, effect, input, output, signal } from '@angular/core';
import {
  DatabaseSchemaEditorValue,
  DEFAULT_ENTITY_STYLE,
  SchemaColorToken,
  SchemaEntity,
  SchemaField,
  SchemaRelationFieldPortSide,
  SchemaMetaItem,
  SchemaPoint,
  SchemaRelationEndingMode,
  SchemaRelation,
  SCHEMA_COLOR_TOKENS,
  VisualSchemaModel,
} from '../database-schema-types';

interface DragState {
  entityId: string;
  pointerId: number;
  offsetX: number;
  offsetY: number;
}

interface ResizeState {
  entityId: string;
  pointerId: number;
  startWidth: number;
  startHeight: number;
  startX: number;
  startY: number;
}

interface PanState {
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
}

interface ConnectionState {
  fromEntityId: string;
  fromFieldId: string | null;
  fromPortSide: SchemaRelationFieldPortSide | null;
  pointerId: number;
  cursorX: number;
  cursorY: number;
}

type InspectorTab = 'entity' | 'relation' | 'canvas';

interface SchemaColorPreset {
  token: SchemaColorToken;
  label: string;
}

interface FieldAnchorPoint {
  x: number;
  y: number;
}

interface RelationValidationResult {
  level: 'ok' | 'warning';
  message: string;
}

interface RelationRoute {
  linePath: string;
  arrowPath: string;
  labelPoint: SchemaPoint | null;
  labelText: string;
  startpoint: SchemaPoint;
  endpoint: SchemaPoint;
}

interface BendDragState {
  relationId: string;
  bendIndex: number;
  pointerId: number;
}

type PortSide = 'left' | 'right' | 'top' | 'bottom';

interface SelectedConnectionField {
  entityId: string;
  fieldId: string;
}

interface SchemaDraftStoragePayload {
  value: DatabaseSchemaEditorValue;
}

interface SchemaDraftStorageEventDetail {
  key: string;
  hasDraft: boolean;
}

const SCHEMA_COLOR_PRESETS: SchemaColorPreset[] = [
  { token: 'default', label: 'Default' },
  { token: 'slate', label: 'Slate' },
  { token: 'blue', label: 'Blue' },
  { token: 'green', label: 'Green' },
  { token: 'amber', label: 'Amber' },
  { token: 'rose', label: 'Rose' },
  { token: 'violet', label: 'Violet' },
];

const POSTGRES_FIELD_TYPES = [
  // Numeric
  'smallint',
  'integer',
  'bigint',
  'numeric',
  'decimal',
  'real',
  'double precision',
  'smallserial',
  'serial',
  'bigserial',
  'money',
  // Character
  'character varying',
  'varchar',
  'character',
  'char',
  'text',
  // Binary
  'bytea',
  // Date/time
  'date',
  'time',
  'time with time zone',
  'timetz',
  'timestamp',
  'timestamp with time zone',
  'timestamptz',
  'interval',
  // Boolean
  'boolean',
  'bool',
  // Network
  'cidr',
  'inet',
  'macaddr',
  'macaddr8',
  // UUID
  'uuid',
  // JSON/XML
  'json',
  'jsonb',
  'xml',
  // Geometric
  'point',
  'line',
  'lseg',
  'box',
  'path',
  'polygon',
  'circle',
  // Bit string
  'bit',
  'bit varying',
  'varbit',
  // Text search
  'tsvector',
  'tsquery',
  // Range
  'int4range',
  'int8range',
  'numrange',
  'tsrange',
  'tstzrange',
  'daterange',
  // Multirange
  'int4multirange',
  'int8multirange',
  'nummultirange',
  'tsmultirange',
  'tstzmultirange',
  'datemultirange',
  // Object identifiers / internal
  'oid',
  'regclass',
  'regtype',
  'regproc',
  'regprocedure',
  'regnamespace',
  'regrole',
  'regoperator',
  'regoper',
  'regconfig',
  'regdictionary',
  'pg_lsn',
  'txid_snapshot',
] as const;

const FIELD_TYPE_QUICK_PRESETS = [
  'uuid',
  'integer',
  'bigint',
  'numeric(10,2)',
  'boolean',
  'varchar(255)',
  'text',
  'date',
  'timestamp',
  'timestamptz',
  'jsonb',
] as const;

@Component({
  selector: 'app-database-schema-editor',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (visible()) {
      <div class="schema-visual-backdrop" (pointerdown)="handleBackdropPointerDown($event)">
        <section class="schema-visual-shell" (pointerdown)="$event.stopPropagation()">
          <header class="schema-visual-toolbar">
            <div class="schema-visual-toolbar__left">
              <input
                type="text"
                class="schema-visual-toolbar__title"
                [value]="draftTitle()"
                placeholder="Schema title"
                (input)="onTitleInput($event)"
              />
              <button type="button" class="schema-visual-btn" (click)="addEntity()">+ Entity</button>
              <button type="button" class="schema-visual-btn schema-visual-btn--ghost" (click)="toggleCollapseAll()">
                {{ draftView().collapsedAll ? 'Expand all' : 'Collapse all' }}
              </button>
            </div>
            <div class="schema-visual-toolbar__right">
              <button type="button" class="schema-visual-btn schema-visual-btn--ghost" (click)="zoomOut()">-</button>
              <span class="schema-visual-toolbar__zoom">{{ zoomLabel() }}</span>
              <button type="button" class="schema-visual-btn schema-visual-btn--ghost" (click)="zoomIn()">+</button>
              <button type="button" class="schema-visual-btn schema-visual-btn--ghost" (click)="resetView()">Reset view</button>
              <button type="button" class="schema-visual-btn schema-visual-btn--ghost" (click)="toggleSnap()">
                Snap: {{ draftSchema().canvas.snapToGrid ? 'On' : 'Off' }}
              </button>
              @if (hasUnsavedChanges()) {
                <span class="schema-visual-toolbar__dirty">You have unsaved changes</span>
              }
              <button type="button" class="schema-visual-btn schema-visual-btn--ghost" (click)="requestCancel()">Cancel</button>
              <button type="button" class="schema-visual-btn schema-visual-btn--primary" (click)="emitApply()">Apply</button>
            </div>
          </header>

          <div class="schema-visual-content">
            <div class="schema-visual-canvas-wrap">
              <div
                #canvasHost
                class="schema-visual-canvas"
                [class.schema-visual-canvas--grid]="draftSchema().canvas.background === 'grid'"
                [class.schema-visual-canvas--dots]="draftSchema().canvas.background === 'dots'"
                (pointerdown)="startPan($event)"
                (wheel)="onWheel($event)"
              >
                <div
                  class="schema-visual-viewport"
                  [style.transform]="'translate(' + draftView().pan.x + 'px,' + draftView().pan.y + 'px) scale(' + draftView().zoom + ')'"
                >
                  <svg class="schema-visual-relations">
                    <g class="schema-visual-relations__lines">
                      @for (relation of draftSchema().relations; track relation.id) {
                        @if (relationRoute(relation); as edge) {
                          <g
                            class="schema-visual-relation"
                            [class.schema-visual-relation--selected]="selectedRelationId() === relation.id"
                            [class.schema-visual-relation--hovered]="hoveredRelationId() === relation.id"
                            (pointerenter)="hoveredRelationId.set(relation.id)"
                            (pointerleave)="hoveredRelationId.set(null)"
                            (pointerdown)="selectRelation(relation.id, $event)"
                          >
                            <path class="schema-visual-relation__hit" [attr.d]="edge.linePath"></path>
                            <path
                              class="schema-visual-relation__line"
                              [attr.d]="edge.linePath"
                              [attr.stroke]="relation.style.color"
                              [attr.stroke-width]="relationStrokeWidth(relation.id)"
                            ></path>
                            @if (selectedRelationId() === relation.id && edge.labelPoint; as labelPoint) {
                              <g class="schema-visual-relation-label">
                                <rect
                                  [attr.x]="labelPoint.x - relationLabelWidth(edge.labelText) / 2"
                                  [attr.y]="labelPoint.y - 10"
                                  [attr.width]="relationLabelWidth(edge.labelText)"
                                  height="20"
                                  rx="10"
                                ></rect>
                                <text [attr.x]="labelPoint.x" [attr.y]="labelPoint.y + 0.5">
                                  {{ edge.labelText }}
                                </text>
                              </g>
                            }
                            @if (selectedRelationId() === relation.id || hoveredRelationId() === relation.id) {
                              <circle
                                class="schema-visual-relation__endpoint"
                                [attr.cx]="edge.startpoint.x"
                                [attr.cy]="edge.startpoint.y"
                                [attr.r]="4 / draftView().zoom"
                                (pointerdown)="toggleRelationEndpointPort(relation.id, 'from', $event)"
                              ></circle>
                              <circle
                                class="schema-visual-relation__endpoint"
                                [attr.cx]="edge.endpoint.x"
                                [attr.cy]="edge.endpoint.y"
                                [attr.r]="4 / draftView().zoom"
                                (pointerdown)="toggleRelationEndpointPort(relation.id, 'to', $event)"
                              ></circle>
                            }
                          </g>
                        }
                      }
                      @if (connectionDraft(); as connector) {
                        @if (connectionPreviewPath(connector); as draftPath) {
                          <path class="schema-visual-relation schema-visual-relation--draft" [attr.d]="draftPath"></path>
                        }
                      }
                    </g>
                    <g class="schema-visual-relations__arrows">
                      @for (relation of draftSchema().relations; track relation.id) {
                        @if (relationRoute(relation); as edge) {
                          <path
                            class="schema-visual-relation-arrow"
                            [class.schema-visual-relation-arrow--selected]="selectedRelationId() === relation.id"
                            [class.schema-visual-relation-arrow--hovered]="hoveredRelationId() === relation.id"
                            [attr.d]="edge.arrowPath"
                            [attr.fill]="relation.style.color"
                          ></path>
                        }
                      }
                    </g>
                  </svg>

                  @for (entity of draftSchema().entities; track entity.id) {
                    <article
                      class="schema-entity"
                      [class.schema-entity--selected]="selectedEntityId() === entity.id"
                      [class.schema-entity--collapsed]="entity.collapsed || draftView().collapsedAll"
                      [style.left.px]="entity.position.x"
                      [style.top.px]="entity.position.y"
                      [style.width.px]="entity.size.w"
                      [style.height.px]="entity.size.h"
                      [style.background]="entityBodyColor(entity)"
                      (pointerup)="completeConnectionToEntity(entity.id, $event)"
                    >
                      <header
                        class="schema-entity__header"
                        [style.background]="entityHeaderColor(entity)"
                        [style.color]="entityTitleTextColor(entity)"
                        (pointerdown)="startEntityDrag(entity.id, $event)"
                      >
                        <button
                          type="button"
                          class="schema-entity__collapse"
                          (pointerdown)="$event.stopPropagation()"
                          (click)="toggleEntityCollapsed(entity.id)"
                        >
                          {{ entity.collapsed || draftView().collapsedAll ? '+' : '-' }}
                        </button>
                        <div class="schema-entity__name">
                          {{ entity.name }}
                        </div>
                      </header>

                      @if (!(entity.collapsed || draftView().collapsedAll)) {
                        <div class="schema-entity__body" (pointerdown)="selectEntity(entity.id, $event)">
                          <section class="schema-entity__section">
                            <button type="button" class="schema-entity__section-toggle" (click)="toggleFieldsCollapsed(entity.id)">
                              {{ entity.sections.fieldsCollapsed ? '▶' : '▼' }} Fields
                            </button>
                            @if (!entity.sections.fieldsCollapsed) {
                              <ul class="schema-entity__list">
                                @for (field of entity.fields; track field.id) {
                                  <li
                                    class="schema-entity__field"
                                    [class.schema-entity__field--pk]="field.isPrimary"
                                    [class.schema-entity__field--fk]="fieldIsForeignKey(entity.id, field.id)"
                                    [class.schema-entity__field--uq]="field.isUnique"
                                    [class.schema-entity__field--nn]="!field.nullable"
                                    [class.schema-entity__field--idx]="field.isIndexed"
                                    [class.schema-entity__field--ai]="field.isAutoIncrement"
                                    [class.schema-entity__field--ports-visible]="fieldPortsVisible(entity.id, field.id)"
                                    [class.schema-entity__field--connect-source]="isConnectionSourceField(entity.id, field.id)"
                                    [style.background]="fieldBadgeColor(field)"
                                    [attr.data-schema-entity-id]="entity.id"
                                    [attr.data-schema-field-id]="field.id"
                                    (click)="selectConnectionField(entity.id, field.id, $event)"
                                    (pointerup)="completeConnectionToField(entity.id, field.id, null, $event)"
                                  >
                                    @if (fieldPortsVisible(entity.id, field.id)) {
                                      <button
                                        type="button"
                                        class="schema-entity__field-port schema-entity__field-port--left"
                                        title="Connect to left port"
                                        (pointerdown)="handleFieldPortPointerDown(entity.id, field.id, 'left', $event)"
                                        (pointerup)="completeConnectionToField(entity.id, field.id, 'left', $event)"
                                        (click)="$event.stopPropagation()"
                                      ></button>
                                      <button
                                        type="button"
                                        class="schema-entity__field-port schema-entity__field-port--right"
                                        title="Connect to right port"
                                        (pointerdown)="handleFieldPortPointerDown(entity.id, field.id, 'right', $event)"
                                        (pointerup)="completeConnectionToField(entity.id, field.id, 'right', $event)"
                                        (click)="$event.stopPropagation()"
                                      ></button>
                                    }
                                    <span class="schema-entity__field-text">
                                      {{ field.name }} : {{ field.type }}
                                      @if (field.isPrimary) {
                                        <span class="schema-entity__field-pill schema-entity__field-pill--pk">PK</span>
                                      }
                                      @if (fieldIsForeignKey(entity.id, field.id)) {
                                        <span class="schema-entity__field-pill schema-entity__field-pill--fk">FK</span>
                                      }
                                      @if (field.isUnique) {
                                        <span class="schema-entity__field-pill schema-entity__field-pill--uq">UQ</span>
                                      }
                                      @if (!field.nullable) {
                                        <span class="schema-entity__field-pill schema-entity__field-pill--nn">NN</span>
                                      }
                                      @if (field.isIndexed) {
                                        <span class="schema-entity__field-pill schema-entity__field-pill--idx">IDX</span>
                                      }
                                      @if (field.isAutoIncrement) {
                                        <span class="schema-entity__field-pill schema-entity__field-pill--ai">AI</span>
                                      }
                                    </span>
                                  </li>
                                }
                              </ul>
                            }
                          </section>

                          <section class="schema-entity__section">
                            <button type="button" class="schema-entity__section-toggle" (click)="toggleMetaCollapsed(entity.id)">
                              {{ entity.sections.metaCollapsed ? '▶' : '▼' }} Meta
                            </button>
                            @if (!entity.sections.metaCollapsed) {
                              <ul class="schema-entity__list">
                                @for (meta of entity.metadata; track meta.id) {
                                  <li>{{ meta.key }}: {{ meta.value }}</li>
                                }
                                @if (!entity.metadata.length) {
                                  <li class="schema-entity__muted">No metadata</li>
                                }
                              </ul>
                            }
                          </section>
                        </div>
                      }

                      <button
                        type="button"
                        class="schema-entity__resize"
                        title="Resize block"
                        (pointerdown)="startEntityResize(entity.id, $event)"
                      ></button>
                    </article>
                  }
                </div>
              </div>
            </div>

            <aside class="schema-inspector">
              <div class="schema-inspector__tabs">
                <button type="button" [class.active]="inspectorTab() === 'entity'" (click)="inspectorTab.set('entity')">Entity</button>
                <button type="button" [class.active]="inspectorTab() === 'relation'" (click)="inspectorTab.set('relation')">Relation</button>
                <button type="button" [class.active]="inspectorTab() === 'canvas'" (click)="inspectorTab.set('canvas')">Canvas</button>
              </div>

              @if (inspectorTab() === 'entity') {
                @if (selectedEntity(); as entity) {
                  <div class="schema-inspector__panel schema-inspector__panel--entity">
                    <label>Name <input type="text" [value]="entity.name" (input)="updateEntityName(entity.id, $event)" /></label>
                    <label>
                      Table color
                      <select [value]="entity.style.colorToken || 'default'" (change)="updateEntityColorToken(entity.id, $event)">
                        @for (preset of colorPresets; track preset.token) {
                          <option [value]="preset.token">{{ preset.label }}</option>
                        }
                      </select>
                    </label>

                    <div class="schema-inspector__row">
                      <button type="button" (click)="addField(entity.id)">+ Field</button>
                      <button type="button" (click)="addMetadata(entity.id)">+ Meta</button>
                      <button type="button" class="danger" (click)="removeEntity(entity.id)">Delete entity</button>
                    </div>

                    <div class="schema-inspector__group">
                      <div class="schema-inspector__group-title">Fields</div>
                      @for (field of entity.fields; track field.id) {
                        <div class="schema-inspector__field-row">
                          <div class="schema-inspector__inline schema-inspector__inline--field-main">
                            <input
                              type="text"
                              [value]="field.name"
                              placeholder="column_name"
                              (input)="updateField(entity.id, field.id, 'name', $event)"
                            />
                            <div class="schema-inspector__type-editor">
                              <select [value]="field.type" (change)="applyFieldTypePreset(entity.id, field.id, $event)">
                                <option value="">Quick type...</option>
                                @for (type of fieldTypeQuickOptions(field.type); track type) {
                                  <option [value]="type">{{ type }}</option>
                                }
                              </select>
                              <input
                                type="text"
                                [value]="field.type"
                                [attr.list]="'schema-field-type-list-' + field.id"
                                placeholder="varchar(255), numeric(10,2), ..."
                                (input)="updateField(entity.id, field.id, 'type', $event)"
                              />
                              <datalist [id]="'schema-field-type-list-' + field.id">
                                @for (type of fieldTypeOptions(field.type); track type) {
                                  <option [value]="type">{{ type }}</option>
                                }
                              </datalist>
                            </div>
                            <select [value]="field.colorToken || 'default'" (change)="updateFieldColorToken(entity.id, field.id, $event)">
                              @for (preset of colorPresets; track preset.token) {
                                <option [value]="preset.token">{{ preset.label }}</option>
                              }
                            </select>
                          </div>
                          <div class="schema-inspector__field-flags">
                            <label><input type="checkbox" [checked]="field.isPrimary" (change)="toggleFieldPrimary(entity.id, field.id, $event)" />PK</label>
                            <label><input type="checkbox" [checked]="field.isUnique" (change)="toggleFieldUnique(entity.id, field.id, $event)" />UQ</label>
                            <label><input type="checkbox" [checked]="!field.nullable" (change)="toggleFieldNotNull(entity.id, field.id, $event)" />NN</label>
                            <label><input type="checkbox" [checked]="field.isIndexed" (change)="toggleFieldIndexed(entity.id, field.id, $event)" />IDX</label>
                            <label><input type="checkbox" [checked]="field.isAutoIncrement" (change)="toggleFieldAutoIncrement(entity.id, field.id, $event)" />AI</label>
                            <span class="schema-inspector__flag-readonly" [class.active]="fieldIsForeignKey(entity.id, field.id)">FK</span>
                            <button
                              type="button"
                              class="schema-inspector__delete-field-btn"
                              (click)="removeField(entity.id, field.id)"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      }
                    </div>

                    <div class="schema-inspector__group">
                      <div class="schema-inspector__group-title">Metadata</div>
                      @for (meta of entity.metadata; track meta.id) {
                        <div class="schema-inspector__inline">
                          <input type="text" [value]="meta.key" (input)="updateMetadata(entity.id, meta.id, 'key', $event)" />
                          <input type="text" [value]="meta.value" (input)="updateMetadata(entity.id, meta.id, 'value', $event)" />
                          <button type="button" class="danger" (click)="removeMetadata(entity.id, meta.id)">x</button>
                        </div>
                      }
                    </div>
                  </div>
                } @else {
                  <div class="schema-inspector__empty">Select a block to edit entity settings.</div>
                }
              }

              @if (inspectorTab() === 'relation') {
                @if (selectedRelation(); as relation) {
                  <div class="schema-inspector__panel schema-inspector__panel--relation">
                    <label>Label <input type="text" [value]="relation.label" (input)="updateRelationLabel(relation.id, $event)" /></label>
                    <label>
                      Source field
                      <select [value]="relation.fromFieldId || ''" (change)="updateRelationFromField(relation.id, $event)">
                        <option value="">Not selected</option>
                        @for (field of relationEntityFields(relation.fromEntityId); track field.id) {
                          <option [value]="field.id">{{ field.name }} : {{ field.type }}</option>
                        }
                      </select>
                    </label>
                    <label>
                      Target field
                      <select [value]="relation.toFieldId || ''" (change)="updateRelationToField(relation.id, $event)">
                        <option value="">Not selected</option>
                        @for (field of relationEntityFields(relation.toEntityId); track field.id) {
                          <option [value]="field.id">{{ field.name }} : {{ field.type }}</option>
                        }
                      </select>
                    </label>
                    <label>
                      Kind
                      <select [value]="relation.kind" (change)="updateRelationKind(relation.id, $event)">
                        <option value="one-to-one">one-to-one</option>
                        <option value="one-to-many">one-to-many</option>
                        <option value="many-to-many">many-to-many</option>
                      </select>
                    </label>
                    <label>
                      Ending mode
                      <select [value]="relation.endingMode" (change)="updateRelationEndingMode(relation.id, $event)">
                        <option value="port">port</option>
                        <option value="offset-edge">offset-edge</option>
                        <option value="edge">edge</option>
                      </select>
                    </label>
                    <label>Color <input type="color" [value]="relation.style.color" (input)="updateRelationColor(relation.id, $event)" /></label>
                    @if (relationValidation(relation); as validation) {
                      @if (validation.level === 'warning') {
                        <div class="schema-inspector__alert schema-inspector__alert--warning">{{ validation.message }}</div>
                      }
                    }
                    <button type="button" class="danger" (click)="removeRelation(relation.id)">Delete relation</button>
                  </div>
                } @else {
                  <div class="schema-inspector__empty">Select a relation to edit it.</div>
                }
              }

              @if (inspectorTab() === 'canvas') {
                <div class="schema-inspector__panel schema-inspector__panel--canvas">
                  <label>
                    Background
                    <select [value]="draftSchema().canvas.background" (change)="updateCanvasBackground($event)">
                      <option value="dots">dots</option>
                      <option value="grid">grid</option>
                      <option value="plain">plain</option>
                    </select>
                  </label>
                  <label>
                    Grid size
                    <input type="number" min="8" max="64" [value]="draftSchema().canvas.gridSize" (input)="updateGridSize($event)" />
                  </label>
                  <label class="schema-inspector__checkbox">
                    <input type="checkbox" [checked]="draftSchema().canvas.snapToGrid" (change)="toggleSnap()" />
                    Enable snap to grid
                  </label>
                </div>
              }
            </aside>
          </div>
        </section>
      </div>
    }
  `,
  styles: [
    `
      :host {
        position: fixed;
        inset: 0;
        z-index: 31;
      }

      .schema-visual-backdrop {
        position: fixed;
        inset: 0;
        background: var(--schema-visual-backdrop);
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 1rem;
      }

      .schema-visual-shell {
        width: min(97vw, 1680px);
        height: min(96vh, 1040px);
        border-radius: 14px;
        border: 1px solid var(--schema-visual-shell-border);
        background: var(--schema-visual-shell-bg);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        box-shadow: 0 28px 80px rgba(1, 8, 25, 0.34);
      }

      .schema-visual-toolbar {
        border-bottom: 1px solid var(--schema-visual-shell-border);
        background: var(--schema-visual-toolbar-bg);
        padding: 0.55rem 0.7rem;
        display: flex;
        justify-content: space-between;
        gap: 0.6rem;
        flex-wrap: wrap;
      }

      .schema-visual-toolbar__left,
      .schema-visual-toolbar__right {
        display: flex;
        align-items: center;
        gap: 0.45rem;
      }

      .schema-visual-toolbar__title {
        width: 18rem;
        max-width: 42vw;
        border: 1px solid var(--schema-visual-shell-border);
        border-radius: 8px;
        padding: 0.42rem 0.58rem;
        font-size: 0.83rem;
        background: var(--schema-visual-input-bg);
        color: var(--schema-visual-text);
      }

      .schema-visual-toolbar__title::placeholder {
        color: var(--schema-visual-input-placeholder);
      }

      .schema-visual-btn {
        border: 1px solid var(--schema-visual-shell-border);
        border-radius: 8px;
        background: var(--schema-visual-shell-bg);
        color: var(--schema-visual-btn-text);
        padding: 0.34rem 0.62rem;
        font-size: 0.75rem;
        cursor: pointer;
        transition: background 120ms ease, border-color 120ms ease, transform 120ms ease, box-shadow 120ms ease;
      }

      .schema-visual-btn:hover {
        background: color-mix(in srgb, var(--schema-visual-hover-bg) 76%, transparent);
        border-color: color-mix(in srgb, var(--schema-visual-focus) 36%, var(--schema-visual-shell-border));
      }

      .schema-visual-btn:active {
        transform: translateY(1px);
      }

      .schema-visual-btn--ghost {
        background: var(--schema-visual-hover-bg);
      }

      .schema-visual-btn--primary {
        background: var(--schema-visual-focus);
        border-color: var(--schema-visual-focus);
        color: #fff;
        box-shadow: 0 6px 18px color-mix(in srgb, var(--schema-visual-focus) 38%, transparent);
      }

      .schema-visual-toolbar__zoom {
        min-width: 3.5rem;
        text-align: center;
        font-size: 0.76rem;
        color: var(--schema-visual-text-muted);
      }

      .schema-visual-toolbar__dirty {
        font-size: 0.74rem;
        font-weight: 600;
        color: var(--schema-visual-danger);
        white-space: nowrap;
      }

      .schema-visual-content {
        min-height: 0;
        flex: 1 1 auto;
        display: grid;
        grid-template-columns: minmax(0, 1fr) clamp(520px, 34vw, 700px);
      }

      .schema-visual-canvas-wrap {
        min-height: 0;
        border-right: 1px solid var(--schema-visual-shell-border);
      }

      .schema-visual-canvas {
        position: relative;
        width: 100%;
        height: 100%;
        overflow: hidden;
        cursor: grab;
        background: var(--schema-visual-canvas-bg);
      }

      .schema-visual-canvas--grid {
        background-image:
          linear-gradient(var(--schema-visual-grid-line) 1px, transparent 1px),
          linear-gradient(90deg, var(--schema-visual-grid-line) 1px, transparent 1px);
        background-size: 18px 18px;
      }

      .schema-visual-canvas--dots {
        background-image: radial-gradient(var(--schema-visual-dot-fill) 1px, transparent 1px);
        background-size: 20px 20px;
      }

      .schema-visual-viewport {
        position: absolute;
        inset: 0;
        transform-origin: 0 0;
      }

      .schema-visual-relations {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        overflow: visible;
        pointer-events: none;
      }

      .schema-visual-relation {
        pointer-events: auto;
        cursor: pointer;
      }

      .schema-visual-relation__line {
        fill: none;
      }

      .schema-visual-relation__hit {
        stroke: transparent;
        stroke-width: 14;
        fill: none;
      }

      .schema-visual-relation text {
        font-size: 11px;
        fill: var(--schema-visual-relation-text);
        pointer-events: none;
        text-anchor: middle;
        dominant-baseline: middle;
      }

      .schema-visual-relation-label rect {
        fill: var(--schema-visual-toolbar-bg);
        stroke: var(--schema-visual-shell-border);
        stroke-width: 1;
        opacity: 0.96;
      }

      .schema-visual-relation__endpoint {
        fill: var(--schema-visual-focus);
        stroke: #fff;
        stroke-width: 1;
      }

      .schema-visual-relations__arrows {
        pointer-events: none;
      }

      .schema-visual-relation-arrow {
        opacity: 0.9;
      }

      .schema-visual-relation--hovered .schema-visual-relation__line,
      .schema-visual-relation-arrow--hovered {
        filter: brightness(1.08);
      }

      .schema-visual-relation--selected .schema-visual-relation__line,
      .schema-visual-relation-arrow--selected {
        filter: brightness(1.14) saturate(1.08);
      }

      .schema-visual-relation--draft {
        stroke: var(--schema-visual-focus);
        stroke-dasharray: 6 4;
        fill: none;
      }

      .schema-entity {
        position: absolute;
        border: 0;
        border-radius: 10px;
        box-shadow: var(--schema-visual-entity-shadow);
        overflow: hidden;
        display: flex;
        flex-direction: column;
        min-width: 220px;
        min-height: 160px;
      }

      .schema-entity--selected {
        box-shadow: var(--schema-visual-entity-selected-shadow);
      }

      .schema-entity__header {
        display: flex;
        align-items: center;
        gap: 0.45rem;
        color: #fff;
        padding: 0.35rem 0.45rem;
        cursor: grab;
        user-select: none;
      }

      .schema-entity__name {
        flex: 1;
        font-weight: 600;
        font-size: 0.78rem;
      }

      .schema-entity__collapse {
        width: 1.35rem;
        height: 1.35rem;
        border: 0;
        border-radius: 6px;
        cursor: pointer;
        background: rgba(255, 255, 255, 0.18);
        color: #fff;
      }

      .schema-entity__body {
        flex: 1;
        min-height: 0;
        overflow: auto;
        padding: 0.36rem 0.4rem;
        color: var(--schema-visual-text);
      }

      .schema-entity__section + .schema-entity__section {
        margin-top: 0.3rem;
      }

      .schema-entity__section-toggle {
        border: 0;
        background: transparent;
        color: var(--schema-visual-text-muted);
        font-size: 0.73rem;
        font-weight: 600;
        cursor: pointer;
        padding: 0;
      }

      .schema-entity__list {
        list-style: none;
        margin: 0.2rem 0 0;
        padding: 0;
        display: grid;
        gap: 0.16rem;
        font-size: 0.72rem;
        color: var(--schema-visual-text);
      }

      .schema-entity__list li {
        padding: 0.1rem 0.25rem;
        border-radius: 5px;
      }

      .schema-entity__field {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.25rem;
        border: 1px solid transparent;
        cursor: crosshair;
        position: relative;
      }

      .schema-entity__field--ports-visible {
        padding-left: 0.95rem;
        padding-right: 0.95rem;
      }

      .schema-entity__field--connect-source {
        box-shadow: inset 0 0 0 1px var(--schema-visual-focus);
      }

      .schema-entity__field--pk {
        border-color: rgba(59, 130, 246, 0.45);
      }

      .schema-entity__field--fk {
        border-color: rgba(249, 115, 22, 0.5);
      }

      .schema-entity__field--uq {
        border-color: rgba(16, 185, 129, 0.45);
      }

      .schema-entity__field--nn {
        border-color: rgba(168, 85, 247, 0.42);
      }

      .schema-entity__field--idx {
        border-color: rgba(14, 165, 233, 0.4);
      }

      .schema-entity__field--ai {
        border-color: rgba(245, 158, 11, 0.42);
      }

      .schema-entity__field-text {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .schema-entity__field-port {
        position: absolute;
        top: 50%;
        width: 10px;
        height: 10px;
        border-radius: 999px;
        border: 1px solid var(--schema-visual-focus);
        background: var(--schema-visual-shell-bg);
        transform: translateY(-50%);
        cursor: crosshair;
        padding: 0;
      }

      .schema-entity__field-port--left {
        left: -5px;
      }

      .schema-entity__field-port--right {
        right: -5px;
      }

      .schema-entity__field-pill {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 1.45rem;
        border-radius: 999px;
        padding: 0 0.33rem;
        margin-left: 0.2rem;
        font-size: 0.6rem;
        font-weight: 700;
      }

      .schema-entity__field-pill--pk {
        background: rgba(59, 130, 246, 0.15);
        color: #1d4ed8;
      }

      .schema-entity__field-pill--fk {
        background: rgba(249, 115, 22, 0.15);
        color: #c2410c;
      }

      .schema-entity__field-pill--uq {
        background: rgba(16, 185, 129, 0.18);
        color: #047857;
      }

      .schema-entity__field-pill--nn {
        background: rgba(168, 85, 247, 0.18);
        color: #7e22ce;
      }

      .schema-entity__field-pill--idx {
        background: rgba(14, 165, 233, 0.16);
        color: #0369a1;
      }

      .schema-entity__field-pill--ai {
        background: rgba(245, 158, 11, 0.16);
        color: #b45309;
      }

      .schema-entity__muted {
        color: var(--schema-visual-text-subtle);
      }

      .schema-entity__resize {
        position: absolute;
        width: 12px;
        height: 12px;
        right: 2px;
        bottom: 2px;
        border: 0;
        cursor: nwse-resize;
        border-radius: 2px;
        background: var(--schema-visual-resize-handle);
      }

      .schema-inspector {
        min-height: 0;
        overflow: hidden;
        background: var(--schema-visual-content-bg);
        display: flex;
        flex-direction: column;
      }

      .schema-inspector__tabs {
        position: sticky;
        top: 0;
        display: flex;
        background: var(--schema-visual-toolbar-bg);
        border-bottom: 1px solid var(--schema-visual-shell-border);
      }

      .schema-inspector__tabs button {
        flex: 1;
        border: 0;
        border-right: 1px solid var(--schema-visual-shell-border);
        background: transparent;
        color: var(--schema-visual-text-muted);
        font-size: 0.75rem;
        padding: 0.56rem 0.38rem;
        cursor: pointer;
        transition: background 120ms ease, color 120ms ease;
      }

      .schema-inspector__tabs button:last-child {
        border-right: 0;
      }

      .schema-inspector__tabs button.active {
        background: var(--schema-visual-tab-active-bg);
        color: var(--schema-visual-tab-active-text);
        font-weight: 700;
      }

      .schema-inspector__panel {
        flex: 1 1 auto;
        min-height: 0;
        overflow: auto;
        padding: 0.56rem;
        display: grid;
        gap: 0.4rem;
      }

      .schema-inspector__panel label {
        display: grid;
        gap: 0.16rem;
        font-size: 0.72rem;
        color: var(--schema-visual-text);
      }

      .schema-inspector__panel input,
      .schema-inspector__panel select {
        border: 1px solid var(--schema-visual-shell-border);
        border-radius: 7px;
        padding: 0.31rem 0.42rem;
        font-size: 0.72rem;
        background: var(--schema-visual-input-bg);
        color: var(--schema-visual-text);
      }

      .schema-inspector__panel input::placeholder {
        color: var(--schema-visual-input-placeholder);
      }

      .schema-inspector__row {
        display: flex;
        gap: 0.35rem;
        flex-wrap: wrap;
      }

      .schema-inspector__row button,
      .schema-inspector__inline button {
        border: 1px solid var(--schema-visual-shell-border);
        border-radius: 7px;
        background: var(--schema-visual-shell-bg);
        color: var(--schema-visual-btn-text);
        cursor: pointer;
        padding: 0.24rem 0.44rem;
        font-size: 0.7rem;
        transition: background 120ms ease, border-color 120ms ease, color 120ms ease;
      }

      .schema-inspector__row button:hover,
      .schema-inspector__inline button:hover {
        background: var(--schema-visual-hover-bg);
        border-color: color-mix(in srgb, var(--schema-visual-focus) 34%, var(--schema-visual-shell-border));
      }

      .schema-inspector__group {
        display: grid;
        gap: 0.25rem;
      }

      .schema-inspector__group-title {
        font-size: 0.7rem;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--schema-visual-text-subtle);
      }

      .schema-inspector__inline {
        display: grid;
        grid-template-columns: 1fr 1fr auto;
        gap: 0.24rem;
        align-items: center;
      }

      .schema-inspector__inline--field-main {
        grid-template-columns: minmax(130px, 1fr) minmax(320px, 1.5fr) minmax(120px, 0.7fr) auto;
      }

      .schema-inspector__field-row {
        display: grid;
        gap: 0.26rem;
        padding: 0.34rem;
        border: 1px solid color-mix(in srgb, var(--schema-visual-shell-border) 42%, transparent);
        border-radius: 8px;
        background: color-mix(in srgb, var(--schema-visual-content-bg) 97%, var(--schema-visual-shell-bg));
      }

      .schema-inspector__type-editor {
        display: grid;
        grid-template-columns: minmax(105px, 0.5fr) minmax(150px, 1fr);
        gap: 0.22rem;
      }

      .schema-inspector__field-flags {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.67rem;
        color: var(--schema-visual-text-muted);
      }

      .schema-inspector__field-flags label {
        display: inline-flex;
        align-items: center;
        gap: 0.24rem;
      }

      .schema-inspector__field-flags input[type='checkbox'] {
        margin: 0;
      }

      .schema-inspector__delete-field-btn {
        margin-left: auto;
        padding: 0.28rem 0.62rem;
        border: 0;
        border-radius: 999px;
        font-size: 0.66rem;
        font-weight: 600;
        line-height: 1;
        color: color-mix(in srgb, var(--schema-visual-danger) 74%, var(--schema-visual-text-muted));
        background: color-mix(in srgb, var(--schema-visual-danger) 8%, transparent);
      }

      .schema-inspector__delete-field-btn:hover {
        color: color-mix(in srgb, var(--schema-visual-danger) 84%, var(--schema-visual-text));
        background: color-mix(in srgb, var(--schema-visual-danger) 13%, transparent);
      }

      .schema-inspector__flag-readonly {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 1.75rem;
        height: 1.35rem;
        border-radius: 999px;
        padding: 0 0.42rem;
        border: 1px solid var(--schema-visual-shell-border);
        color: var(--schema-visual-text-subtle);
        background: color-mix(in srgb, var(--schema-visual-shell-bg) 85%, transparent);
      }

      .schema-inspector__flag-readonly.active {
        border-color: rgba(249, 115, 22, 0.42);
        background: rgba(249, 115, 22, 0.12);
        color: #c2410c;
      }

      .schema-inspector__checkbox {
        display: flex;
        align-items: center;
        gap: 0.35rem;
      }

      .schema-inspector__empty {
        padding: 0.75rem;
        font-size: 0.75rem;
        color: var(--schema-visual-text-muted);
      }

      .schema-inspector__alert {
        border-radius: 7px;
        padding: 0.42rem 0.5rem;
        font-size: 0.71rem;
      }

      .schema-inspector__alert--warning {
        border: 1px solid rgba(245, 158, 11, 0.55);
        background: rgba(245, 158, 11, 0.14);
        color: #92400e;
      }

      .danger {
        color: var(--schema-visual-danger);
        border-color: color-mix(in srgb, var(--schema-visual-danger) 34%, var(--schema-visual-shell-border)) !important;
      }

      .danger:hover {
        background: color-mix(in srgb, var(--schema-visual-danger) 12%, transparent) !important;
      }

      .schema-inspector__panel--entity {
        grid-template-columns: 1fr;
      }

      .schema-inspector__panel--relation {
        grid-template-columns: 1fr;
      }

      .schema-inspector__panel--relation input,
      .schema-inspector__panel--relation select {
        padding: 0.24rem 0.36rem;
        font-size: 0.68rem;
        border-radius: 6px;
      }

      .schema-inspector__panel--relation input[type='color'] {
        height: 1.55rem;
        padding: 0.12rem;
      }

      .schema-inspector__panel--relation button {
        padding: 0.2rem 0.38rem;
        font-size: 0.66rem;
        border-radius: 6px;
      }

      .schema-inspector__panel--canvas {
        align-content: start;
      }

      @media (min-width: 1440px) and (min-height: 860px) {
        .schema-inspector__panel--entity {
          grid-template-columns: 1fr 1fr;
          align-content: start;
        }

        .schema-inspector__panel--entity > .schema-inspector__row,
        .schema-inspector__panel--entity > .schema-inspector__group,
        .schema-inspector__panel--entity > .danger {
          grid-column: 1 / -1;
        }
      }
    `,
  ],
})
export class DatabaseSchemaEditorComponent {
  @ViewChild('canvasHost') private canvasHost?: ElementRef<HTMLElement>;

  readonly visible = input(false);
  readonly value = input.required<DatabaseSchemaEditorValue>();
  readonly savedValue = input<DatabaseSchemaEditorValue | null>(null);
  readonly draftStorageKey = input<string | null>(null);
  readonly apply = output<DatabaseSchemaEditorValue>();
  readonly cancel = output<void>();
  readonly unsavedChange = output<boolean>();
  readonly colorPresets = SCHEMA_COLOR_PRESETS;
  readonly postgresFieldTypes = POSTGRES_FIELD_TYPES;

  readonly draftTitle = signal('');
  readonly draftSchema = signal<VisualSchemaModel>({
    version: 2,
    entities: [],
    relations: [],
    canvas: { gridSize: 16, snapToGrid: false, background: 'dots' },
  });
  readonly draftView = signal({ collapsedAll: false, zoom: 1, pan: { x: 0, y: 0 } });
  readonly selectedEntityId = signal<string | null>(null);
  readonly selectedRelationId = signal<string | null>(null);
  readonly hoveredRelationId = signal<string | null>(null);
  readonly selectedConnectionField = signal<SelectedConnectionField | null>(null);
  readonly inspectorTab = signal<InspectorTab>('entity');
  readonly sourceSignature = signal('');
  readonly restoredLocalDraft = signal(false);
  readonly hasUnsavedChanges = computed(
    () => this.sourceSignature() !== this.serializeEditorValue(this.draftTitle(), this.draftSchema(), this.draftView())
  );

  readonly selectedEntity = computed(() =>
    this.draftSchema().entities.find((entity) => entity.id === this.selectedEntityId()) ?? null
  );
  readonly selectedRelation = computed(() =>
    this.draftSchema().relations.find((relation) => relation.id === this.selectedRelationId()) ?? null
  );

  readonly connectionDraft = signal<ConnectionState | null>(null);

  private dragState: DragState | null = null;
  private resizeState: ResizeState | null = null;
  private panState: PanState | null = null;
  private bendDragState: BendDragState | null = null;

  constructor() {
    effect(() => {
      if (!this.visible()) return;
      const source = this.value();
      const baseline = this.savedValue() ?? source;
      const restored = this.readStoredDraft();
      const initialValue = restored ?? source;
      this.restoredLocalDraft.set(!!restored);
      this.draftTitle.set(initialValue.title);
      this.draftSchema.set(JSON.parse(JSON.stringify(initialValue.schema)) as VisualSchemaModel);
      this.draftView.set(
        JSON.parse(JSON.stringify(initialValue.view)) as { collapsedAll: boolean; zoom: number; pan: { x: number; y: number } }
      );
      this.sourceSignature.set(this.serializeEditorValue(baseline.title, baseline.schema, baseline.view));
      const firstEntity = initialValue.schema.entities[0]?.id ?? null;
      this.selectedEntityId.set(firstEntity);
      this.selectedRelationId.set(null);
      this.hoveredRelationId.set(null);
      this.inspectorTab.set(firstEntity ? 'entity' : 'canvas');
      this.connectionDraft.set(null);
      this.selectedConnectionField.set(null);
    });

    effect(() => {
      if (!this.visible()) return;
      if (this.hasUnsavedChanges()) {
        this.writeStoredDraft();
      } else {
        this.clearStoredDraft();
        this.restoredLocalDraft.set(false);
      }
    });

    effect(() => {
      this.unsavedChange.emit(this.visible() ? this.hasUnsavedChanges() : false);
    });
  }

  zoomLabel(): string {
    return `${Math.round(this.draftView().zoom * 100)}%`;
  }

  fieldPortsVisible(entityId: string, fieldId: string): boolean {
    if (this.connectionDraft()) return true;
    const selected = this.selectedConnectionField();
    return selected?.entityId === entityId && selected.fieldId === fieldId;
  }

  isConnectionSourceField(entityId: string, fieldId: string): boolean {
    const draft = this.connectionDraft();
    if (draft) {
      return draft.fromEntityId === entityId && draft.fromFieldId === fieldId;
    }
    const selected = this.selectedConnectionField();
    return selected?.entityId === entityId && selected.fieldId === fieldId;
  }

  selectConnectionField(entityId: string, fieldId: string, event: MouseEvent): void {
    event.stopPropagation();
    if (this.connectionDraft()) return;
    const selected = this.selectedConnectionField();
    if (selected?.entityId === entityId && selected.fieldId === fieldId) {
      this.selectedConnectionField.set(null);
      return;
    }
    this.selectedConnectionField.set({ entityId, fieldId });
  }

  handleFieldPortPointerDown(
    entityId: string,
    fieldId: string,
    side: SchemaRelationFieldPortSide,
    event: PointerEvent
  ): void {
    event.stopPropagation();
    const draft = this.connectionDraft();
    if (draft) return;
    const selected = this.selectedConnectionField();
    const isSelected = selected?.entityId === entityId && selected.fieldId === fieldId;
    if (!isSelected) {
      this.selectedConnectionField.set({ entityId, fieldId });
      return;
    }
    this.startConnection(entityId, event, fieldId, side);
  }

  bendHandleSize(): number {
    return Math.max(6, 8 / this.draftView().zoom);
  }

  onTitleInput(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    this.draftTitle.set(target.value);
  }

  private nextId(prefix: string): string {
    return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
  }

  private normalizeColorToken(value: unknown): SchemaColorToken {
    if (typeof value === 'string' && (SCHEMA_COLOR_TOKENS as readonly string[]).includes(value)) {
      return value as SchemaColorToken;
    }
    return 'default';
  }

  private serializeEditorValue(
    title: string,
    schema: VisualSchemaModel,
    view: { collapsedAll: boolean; zoom: number; pan: { x: number; y: number } }
  ): string {
    return JSON.stringify({
      title,
      schema,
      view,
    });
  }

  private readStoredDraft(): DatabaseSchemaEditorValue | null {
    const key = this.draftStorageKey();
    if (!key) return null;
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as SchemaDraftStoragePayload | null;
      if (!parsed || typeof parsed !== 'object' || !parsed.value || typeof parsed.value !== 'object') {
        return null;
      }
      const value = parsed.value as Partial<DatabaseSchemaEditorValue>;
      const title = typeof value.title === 'string' ? value.title : '';
      const bodyText = typeof value.bodyText === 'string' ? value.bodyText : '';
      if (!value.schema || !value.view) return null;
      return {
        title,
        bodyText,
        schema: value.schema as VisualSchemaModel,
        view: value.view as { collapsedAll: boolean; zoom: number; pan: { x: number; y: number } },
      };
    } catch {
      return null;
    }
  }

  private writeStoredDraft(): void {
    const key = this.draftStorageKey();
    if (!key) return;
    const payload: SchemaDraftStoragePayload = {
      value: {
        title: this.draftTitle(),
        bodyText: this.value().bodyText,
        schema: this.draftSchema(),
        view: this.draftView(),
      },
    };
    try {
      window.localStorage.setItem(key, JSON.stringify(payload));
      this.emitDraftStorageChanged(key, true);
    } catch {
      // Ignore storage quota and availability errors.
    }
  }

  private clearStoredDraft(): void {
    const key = this.draftStorageKey();
    if (!key) return;
    try {
      window.localStorage.removeItem(key);
      this.emitDraftStorageChanged(key, false);
    } catch {
      // Ignore storage availability errors.
    }
  }

  private emitDraftStorageChanged(key: string, hasDraft: boolean): void {
    const detail: SchemaDraftStorageEventDetail = { key, hasDraft };
    window.dispatchEvent(new CustomEvent<SchemaDraftStorageEventDetail>('notes-db-schema-draft-changed', { detail }));
  }

  private focusPoint(schema: VisualSchemaModel): SchemaPoint {
    const host = this.canvasHost?.nativeElement;
    const rect = host?.getBoundingClientRect();
    if (rect) {
      const view = this.draftView();
      return {
        x: (24 - view.pan.x) / view.zoom,
        y: (24 - view.pan.y) / view.zoom,
      };
    }
    return { x: 24, y: 24 };
  }

  private gridOffsets(count: number, columns: number): Array<{ x: number; y: number }> {
    const safeCols = Math.max(1, columns);
    const offsets: Array<{ x: number; y: number }> = [];
    for (let index = 0; index < count; index += 1) {
      offsets.push({
        x: index % safeCols,
        y: Math.floor(index / safeCols),
      });
    }
    return offsets;
  }

  private layoutColumns(entityCount: number): number {
    if (entityCount <= 1) return 1;
    return Math.max(2, Math.ceil(Math.sqrt(entityCount)));
  }

  private connectedEntityIds(schema: VisualSchemaModel, rootEntityId: string): string[] {
    const adjacency = new Map<string, Set<string>>();
    for (const entity of schema.entities) {
      adjacency.set(entity.id, new Set<string>());
    }
    for (const relation of schema.relations) {
      adjacency.get(relation.fromEntityId)?.add(relation.toEntityId);
      adjacency.get(relation.toEntityId)?.add(relation.fromEntityId);
    }
    const visited = new Set<string>();
    const queue: string[] = [rootEntityId];
    while (queue.length) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);
      const neighbors = adjacency.get(current);
      if (!neighbors) continue;
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          queue.push(neighbor);
        }
      }
    }
    return [rootEntityId, ...Array.from(visited).filter((id) => id !== rootEntityId)];
  }

  private nextEntityPosition(schema: VisualSchemaModel): { x: number; y: number } {
    const anchor = this.focusPoint(schema);
    const spacingX = 360;
    const spacingY = 250;
    const columns = this.layoutColumns(schema.entities.length + 1);
    const occupied = new Set<string>();
    for (const entity of schema.entities) {
      const ix = Math.max(0, Math.round((entity.position.x - anchor.x) / spacingX));
      const iy = Math.max(0, Math.round((entity.position.y - anchor.y) / spacingY));
      occupied.add(`${ix}:${iy}`);
    }
    const offsets = this.gridOffsets(Math.max(columns * 4, schema.entities.length + 12), columns);
    const chosen = offsets.find((offset) => !occupied.has(`${offset.x}:${offset.y}`)) ?? { x: 0, y: 0 };
    return {
      x: Math.max(16, this.applySnap(anchor.x + chosen.x * spacingX)),
      y: Math.max(16, this.applySnap(anchor.y + chosen.y * spacingY)),
    };
  }

  private colorVar(token: SchemaColorToken, part: 'title' | 'title-text' | 'body' | 'accent' | 'field-bg'): string {
    return `var(--schema-palette-${token}-${part})`;
  }

  entityHeaderColor(entity: SchemaEntity): string {
    const token = this.normalizeColorToken(entity.style.colorToken);
    if (token === 'default') return entity.style.titleColor;
    return this.colorVar(token, 'title');
  }

  entityBodyColor(entity: SchemaEntity): string {
    const token = this.normalizeColorToken(entity.style.colorToken);
    if (token === 'default') return entity.style.blockColor;
    return this.colorVar(token, 'body');
  }

  fieldBadgeColor(field: SchemaField): string {
    const token = this.normalizeColorToken(field.colorToken);
    if (token === 'default') return 'transparent';
    return this.colorVar(token, 'field-bg');
  }

  entityTitleTextColor(entity: SchemaEntity): string {
    const token = this.normalizeColorToken(entity.style.colorToken);
    if (token !== 'default') {
      return this.colorVar(token, 'title-text');
    }
    const normalized = entity.style.titleColor.trim();
    const hex = normalized.startsWith('#') ? normalized.slice(1) : '';
    if (!(hex.length === 3 || hex.length === 6)) return '#ffffff';
    const expanded =
      hex.length === 3
        ? `${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`
        : hex;
    const r = Number.parseInt(expanded.slice(0, 2), 16);
    const g = Number.parseInt(expanded.slice(2, 4), 16);
    const b = Number.parseInt(expanded.slice(4, 6), 16);
    if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) return '#ffffff';
    const luminance = (r * 299 + g * 587 + b * 114) / 1000;
    return luminance > 160 ? '#111827' : '#ffffff';
  }

  addEntity(): void {
    const schema = this.draftSchema();
    const id = this.nextId('entity');
    const position = this.nextEntityPosition(schema);
    const entity: SchemaEntity = {
      id,
      name: `Entity ${schema.entities.length + 1}`,
      fields: [
        {
          id: this.nextId('field'),
          name: 'id',
          type: 'uuid',
          nullable: false,
          isPrimary: true,
          isUnique: true,
          isIndexed: true,
          isAutoIncrement: false,
          colorToken: null,
        },
      ],
      metadata: [],
      position,
      size: { w: 300, h: 230 },
      style: { ...DEFAULT_ENTITY_STYLE },
      collapsed: false,
      sections: { fieldsCollapsed: false, metaCollapsed: false },
    };
    this.draftSchema.update((current) => ({
      ...current,
      entities: [...current.entities, entity],
    }));
    this.selectedEntityId.set(id);
    this.selectedRelationId.set(null);
    this.inspectorTab.set('entity');
  }

  layoutFromFocus(): void {
    // Intentionally no-op: existing card positions are user-defined and must stay untouched.
  }

  toggleCollapseAll(): void {
    this.draftView.update((view) => ({ ...view, collapsedAll: !view.collapsedAll }));
  }

  toggleEntityCollapsed(entityId: string): void {
    this.draftSchema.update((schema) => ({
      ...schema,
      entities: schema.entities.map((entity) =>
        entity.id === entityId ? { ...entity, collapsed: !entity.collapsed } : entity
      ),
    }));
  }

  toggleFieldsCollapsed(entityId: string): void {
    this.draftSchema.update((schema) => ({
      ...schema,
      entities: schema.entities.map((entity) =>
        entity.id === entityId
          ? { ...entity, sections: { ...entity.sections, fieldsCollapsed: !entity.sections.fieldsCollapsed } }
          : entity
      ),
    }));
  }

  toggleMetaCollapsed(entityId: string): void {
    this.draftSchema.update((schema) => ({
      ...schema,
      entities: schema.entities.map((entity) =>
        entity.id === entityId ? { ...entity, sections: { ...entity.sections, metaCollapsed: !entity.sections.metaCollapsed } } : entity
      ),
    }));
  }

  private canvasPoint(event: MouseEvent | PointerEvent): { x: number; y: number } {
    const host = this.canvasHost?.nativeElement;
    const rect = host?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    const view = this.draftView();
    return {
      x: (event.clientX - rect.left - view.pan.x) / view.zoom,
      y: (event.clientY - rect.top - view.pan.y) / view.zoom,
    };
  }

  private applySnap(value: number): number {
    const schema = this.draftSchema();
    if (!schema.canvas.snapToGrid) return value;
    const grid = Math.max(8, schema.canvas.gridSize);
    return Math.round(value / grid) * grid;
  }

  startEntityDrag(entityId: string, event: PointerEvent): void {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const entity = this.draftSchema().entities.find((candidate) => candidate.id === entityId);
    if (!entity) return;
    const point = this.canvasPoint(event);
    this.dragState = {
      entityId,
      pointerId: event.pointerId,
      offsetX: point.x - entity.position.x,
      offsetY: point.y - entity.position.y,
    };
    this.selectEntity(entityId, event);
  }

  startEntityResize(entityId: string, event: PointerEvent): void {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const entity = this.draftSchema().entities.find((candidate) => candidate.id === entityId);
    if (!entity) return;
    const point = this.canvasPoint(event);
    this.resizeState = {
      entityId,
      pointerId: event.pointerId,
      startWidth: entity.size.w,
      startHeight: entity.size.h,
      startX: point.x,
      startY: point.y,
    };
    this.selectedEntityId.set(entityId);
    this.selectedRelationId.set(null);
  }

  startPan(event: PointerEvent): void {
    if (event.button !== 0) return;
    this.panState = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: this.draftView().pan.x,
      originY: this.draftView().pan.y,
    };
    this.selectedEntityId.set(null);
    this.selectedRelationId.set(null);
    this.selectedConnectionField.set(null);
  }

  private defaultFieldId(entityId: string): string | null {
    const entity = this.draftSchema().entities.find((candidate) => candidate.id === entityId);
    if (!entity) return null;
    return entity.fields.find((field) => field.isPrimary)?.id ?? entity.fields[0]?.id ?? null;
  }

  startConnection(entityId: string, event: PointerEvent, fromFieldId: string | null = null, fromPortSide: SchemaRelationFieldPortSide | null = null): void {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const point = this.canvasPoint(event);
    this.connectionDraft.set({
      fromEntityId: entityId,
      fromFieldId: fromFieldId ?? this.defaultFieldId(entityId),
      fromPortSide,
      pointerId: event.pointerId,
      cursorX: point.x,
      cursorY: point.y,
    });
  }

  private resolveDropPortSide(event: PointerEvent): SchemaRelationFieldPortSide {
    const target = event.currentTarget;
    if (target instanceof HTMLElement) {
      const bounds = target.getBoundingClientRect();
      const leftDistance = Math.abs(event.clientX - bounds.left);
      const rightDistance = Math.abs(bounds.right - event.clientX);
      return leftDistance <= rightDistance ? 'left' : 'right';
    }
    return 'left';
  }

  private autoResolveRelationFields(
    fromEntityId: string,
    toEntityId: string,
    fromFieldId: string | null,
    toFieldId: string | null
  ): { fromFieldId: string | null; toFieldId: string | null } {
    const sourceFields = this.relationEntityFields(fromEntityId);
    const targetFields = this.relationEntityFields(toEntityId);

    let resolvedTo = toFieldId;
    let resolvedFrom = fromFieldId;

    const targetPrimary = targetFields.find((field) => field.isPrimary) ?? null;
    const sourcePrimary = sourceFields.find((field) => field.isPrimary) ?? null;

    if (!resolvedTo) {
      const sourceField = resolvedFrom ? sourceFields.find((field) => field.id === resolvedFrom) ?? null : null;
      const sourceType = sourceField ? this.normalizeFieldType(sourceField.type) : null;
      if (sourceType) {
        resolvedTo =
          targetFields.find(
            (field) =>
              field.isPrimary && this.areCompatibleTypes(sourceType, this.normalizeFieldType(field.type))
          )?.id ??
          targetFields.find((field) => this.areCompatibleTypes(sourceType, this.normalizeFieldType(field.type)))?.id ??
          targetPrimary?.id ??
          targetFields[0]?.id ??
          null;
      } else {
        resolvedTo = targetPrimary?.id ?? targetFields[0]?.id ?? null;
      }
    }

    if (!resolvedFrom) {
      const targetField = resolvedTo ? targetFields.find((field) => field.id === resolvedTo) ?? null : null;
      const targetType = targetField ? this.normalizeFieldType(targetField.type) : null;
      const targetEntity = this.draftSchema().entities.find((entity) => entity.id === toEntityId);
      const targetNameToken = targetEntity?.name.trim().toLowerCase() ?? '';
      const scored = sourceFields
        .map((field) => {
          let score = 0;
          if (!field.isPrimary) score += 3;
          if (field.name.toLowerCase().includes('id')) score += 2;
          if (targetNameToken && field.name.toLowerCase().includes(targetNameToken)) score += 2;
          if (targetType && this.areCompatibleTypes(targetType, this.normalizeFieldType(field.type))) score += 4;
          return { field, score };
        })
        .sort((a, b) => b.score - a.score);
      resolvedFrom = scored[0]?.field.id ?? sourcePrimary?.id ?? sourceFields[0]?.id ?? null;
    }

    return {
      fromFieldId: resolvedFrom,
      toFieldId: resolvedTo,
    };
  }

  private createRelationFromDraft(
    draft: ConnectionState,
    targetEntityId: string,
    toFieldId: string | null,
    toPortSide: SchemaRelationFieldPortSide | null
  ): void {
    if (draft.fromEntityId === targetEntityId) return;
    const resolvedFields = this.autoResolveRelationFields(
      draft.fromEntityId,
      targetEntityId,
      draft.fromFieldId,
      toFieldId
    );
    const relationId = this.nextId('rel');
    this.draftSchema.update((schema) => ({
      ...schema,
      relations: [
        ...schema.relations,
        {
          id: relationId,
          fromEntityId: draft.fromEntityId,
          toEntityId: targetEntityId,
          fromFieldId: resolvedFields.fromFieldId,
          toFieldId: resolvedFields.toFieldId,
          fromPortSide: draft.fromPortSide,
          toPortSide,
          bendPoints: [],
          endingMode: 'port',
          kind: 'one-to-many',
          label: '',
          style: { color: '#75809a' },
        },
      ],
    }));
    this.selectedRelationId.set(relationId);
    this.selectedEntityId.set(null);
    this.inspectorTab.set('relation');
  }

  completeConnectionToField(
    targetEntityId: string,
    toFieldId: string,
    toPortSide: SchemaRelationFieldPortSide | null,
    event: PointerEvent
  ): void {
    const draft = this.connectionDraft();
    if (!draft || draft.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    const resolvedPort = toPortSide ?? this.resolveDropPortSide(event);
    this.createRelationFromDraft(draft, targetEntityId, toFieldId, resolvedPort);
    this.connectionDraft.set(null);
    this.selectedConnectionField.set(null);
  }

  completeConnectionToEntity(targetEntityId: string, event: PointerEvent): void {
    const draft = this.connectionDraft();
    if (!draft || draft.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    const fallbackFieldId = this.defaultFieldId(targetEntityId);
    this.createRelationFromDraft(draft, targetEntityId, fallbackFieldId, null);
    this.connectionDraft.set(null);
    this.selectedConnectionField.set(null);
  }

  selectEntity(entityId: string, event?: PointerEvent): void {
    if (event) event.stopPropagation();
    this.selectedEntityId.set(entityId);
    this.selectedRelationId.set(null);
    this.selectedConnectionField.set(null);
    this.inspectorTab.set('entity');
  }

  selectRelation(relationId: string, event: PointerEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.selectedRelationId.set(relationId);
    this.selectedEntityId.set(null);
    this.selectedConnectionField.set(null);
    this.inspectorTab.set('relation');
  }

  updateEntityName(entityId: string, event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    this.draftSchema.update((schema) => ({
      ...schema,
      entities: schema.entities.map((entity) =>
        entity.id === entityId
          ? {
              ...entity,
              name: target.value,
            }
          : entity
      ),
    }));
  }

  updateEntityStyle(entityId: string, key: keyof SchemaEntity['style'], event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    this.draftSchema.update((schema) => ({
      ...schema,
      entities: schema.entities.map((entity) =>
        entity.id === entityId
          ? {
              ...entity,
              style: {
                ...entity.style,
                [key]: target.value,
              },
            }
          : entity
      ),
    }));
  }

  updateEntityColorToken(entityId: string, event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) return;
    const token = this.normalizeColorToken(target.value);
    this.draftSchema.update((schema) => ({
      ...schema,
      entities: schema.entities.map((entity) =>
        entity.id === entityId
          ? {
              ...entity,
              style: {
                ...entity.style,
                colorToken: token,
              },
            }
          : entity
      ),
    }));
  }

  removeEntity(entityId: string): void {
    this.draftSchema.update((schema) => ({
      ...schema,
      entities: schema.entities.filter((entity) => entity.id !== entityId),
      relations: schema.relations.filter(
        (relation) => relation.fromEntityId !== entityId && relation.toEntityId !== entityId
      ),
    }));
    if (this.selectedEntityId() === entityId) {
      this.selectedEntityId.set(this.draftSchema().entities[0]?.id ?? null);
    }
  }

  addField(entityId: string): void {
    const nextField: SchemaField = {
      id: this.nextId('field'),
      name: 'new_field',
      type: 'text',
      nullable: true,
      isPrimary: false,
      isUnique: false,
      isIndexed: false,
      isAutoIncrement: false,
      colorToken: null,
    };
    this.draftSchema.update((schema) => ({
      ...schema,
      entities: schema.entities.map((entity) =>
        entity.id === entityId ? { ...entity, fields: [...entity.fields, nextField] } : entity
      ),
    }));
  }

  updateField(entityId: string, fieldId: string, key: 'name' | 'type', event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;
    this.draftSchema.update((schema) => ({
      ...schema,
      entities: schema.entities.map((entity) =>
        entity.id === entityId
          ? {
              ...entity,
              fields: entity.fields.map((field) =>
                field.id === fieldId
                  ? {
                      ...field,
                      [key]: target.value,
                    }
                  : field
              ),
            }
          : entity
      ),
    }));
  }

  fieldTypeOptions(currentType: string): string[] {
    const normalized = currentType.trim();
    if (normalized && !this.postgresFieldTypes.includes(normalized as (typeof POSTGRES_FIELD_TYPES)[number])) {
      return [normalized, ...this.postgresFieldTypes];
    }
    return [...this.postgresFieldTypes];
  }

  fieldTypeQuickOptions(currentType: string): string[] {
    const normalized = currentType.trim();
    if (normalized && !FIELD_TYPE_QUICK_PRESETS.includes(normalized as (typeof FIELD_TYPE_QUICK_PRESETS)[number])) {
      return [normalized, ...FIELD_TYPE_QUICK_PRESETS];
    }
    return [...FIELD_TYPE_QUICK_PRESETS];
  }

  applyFieldTypePreset(entityId: string, fieldId: string, event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) return;
    const nextType = target.value.trim();
    if (!nextType) return;
    this.draftSchema.update((schema) => ({
      ...schema,
      entities: schema.entities.map((entity) =>
        entity.id === entityId
          ? {
              ...entity,
              fields: entity.fields.map((field) =>
                field.id === fieldId
                  ? {
                      ...field,
                      type: nextType,
                    }
                  : field
              ),
            }
          : entity
      ),
    }));
  }

  updateFieldColorToken(entityId: string, fieldId: string, event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) return;
    const token = this.normalizeColorToken(target.value);
    this.draftSchema.update((schema) => ({
      ...schema,
      entities: schema.entities.map((entity) =>
        entity.id === entityId
          ? {
              ...entity,
              fields: entity.fields.map((field) =>
                field.id === fieldId
                  ? {
                      ...field,
                      colorToken: token === 'default' ? null : token,
                    }
                  : field
              ),
            }
          : entity
      ),
    }));
  }

  toggleFieldPrimary(entityId: string, fieldId: string, event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    this.draftSchema.update((schema) => ({
      ...schema,
      entities: schema.entities.map((entity) =>
        entity.id === entityId
          ? {
              ...entity,
              fields: entity.fields.map((field) =>
                field.id === fieldId
                  ? {
                      ...field,
                      isPrimary: target.checked,
                      nullable: target.checked ? false : field.nullable,
                    }
                  : field
              ),
            }
          : entity
      ),
    }));
  }

  toggleFieldUnique(entityId: string, fieldId: string, event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    this.setFieldBoolean(entityId, fieldId, 'isUnique', target.checked);
  }

  toggleFieldIndexed(entityId: string, fieldId: string, event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    this.setFieldBoolean(entityId, fieldId, 'isIndexed', target.checked);
  }

  toggleFieldAutoIncrement(entityId: string, fieldId: string, event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    const next = target.checked;
    this.draftSchema.update((schema) => ({
      ...schema,
      entities: schema.entities.map((entity) =>
        entity.id === entityId
          ? {
              ...entity,
              fields: entity.fields.map((field) =>
                field.id === fieldId
                  ? {
                      ...field,
                      isAutoIncrement: next,
                      nullable: next ? false : field.nullable,
                    }
                  : field
              ),
            }
          : entity
      ),
    }));
  }

  toggleFieldNotNull(entityId: string, fieldId: string, event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    this.setFieldBoolean(entityId, fieldId, 'nullable', !target.checked);
  }

  private setFieldBoolean(
    entityId: string,
    fieldId: string,
    key: 'nullable' | 'isUnique' | 'isIndexed',
    value: boolean
  ): void {
    this.draftSchema.update((schema) => ({
      ...schema,
      entities: schema.entities.map((entity) =>
        entity.id === entityId
          ? {
              ...entity,
              fields: entity.fields.map((field) =>
                field.id === fieldId
                  ? {
                      ...field,
                      [key]: value,
                    }
                  : field
              ),
            }
          : entity
      ),
    }));
  }

  removeField(entityId: string, fieldId: string): void {
    this.draftSchema.update((schema) => ({
      ...schema,
      entities: schema.entities.map((entity) =>
        entity.id === entityId
          ? {
              ...entity,
              fields: entity.fields.filter((field) => field.id !== fieldId),
            }
          : entity
      ),
      relations: schema.relations.map((relation) => ({
        ...relation,
        fromFieldId:
          relation.fromEntityId === entityId && relation.fromFieldId === fieldId ? null : relation.fromFieldId,
        fromPortSide:
          relation.fromEntityId === entityId && relation.fromFieldId === fieldId ? null : relation.fromPortSide,
        toFieldId: relation.toEntityId === entityId && relation.toFieldId === fieldId ? null : relation.toFieldId,
        toPortSide: relation.toEntityId === entityId && relation.toFieldId === fieldId ? null : relation.toPortSide,
      })),
    }));
  }

  addMetadata(entityId: string): void {
    const nextMeta: SchemaMetaItem = {
      id: this.nextId('meta'),
      key: 'key',
      value: 'value',
    };
    this.draftSchema.update((schema) => ({
      ...schema,
      entities: schema.entities.map((entity) =>
        entity.id === entityId ? { ...entity, metadata: [...entity.metadata, nextMeta] } : entity
      ),
    }));
  }

  updateMetadata(entityId: string, metaId: string, key: 'key' | 'value', event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    this.draftSchema.update((schema) => ({
      ...schema,
      entities: schema.entities.map((entity) =>
        entity.id === entityId
          ? {
              ...entity,
              metadata: entity.metadata.map((meta) =>
                meta.id === metaId
                  ? {
                      ...meta,
                      [key]: target.value,
                    }
                  : meta
              ),
            }
          : entity
      ),
    }));
  }

  removeMetadata(entityId: string, metaId: string): void {
    this.draftSchema.update((schema) => ({
      ...schema,
      entities: schema.entities.map((entity) =>
        entity.id === entityId
          ? {
              ...entity,
              metadata: entity.metadata.filter((meta) => meta.id !== metaId),
            }
          : entity
      ),
    }));
  }

  relationEntityFields(entityId: string): SchemaField[] {
    return this.draftSchema().entities.find((entity) => entity.id === entityId)?.fields ?? [];
  }

  fieldIsForeignKey(entityId: string, fieldId: string): boolean {
    return this.draftSchema().relations.some(
      (relation) => relation.toEntityId === entityId && relation.toFieldId === fieldId
    );
  }

  updateRelationLabel(relationId: string, event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    this.draftSchema.update((schema) => ({
      ...schema,
      relations: schema.relations.map((relation) =>
        relation.id === relationId
          ? {
              ...relation,
              label: target.value,
            }
          : relation,
      ),
    }));
  }

  updateRelationFromField(relationId: string, event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) return;
    const selected = target.value || null;
    this.draftSchema.update((schema) => ({
      ...schema,
      relations: schema.relations.map((relation) =>
        relation.id === relationId
          ? {
              ...relation,
              fromFieldId: selected,
              fromPortSide: null,
            }
          : relation
      ),
    }));
  }

  updateRelationToField(relationId: string, event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) return;
    const selected = target.value || null;
    this.draftSchema.update((schema) => ({
      ...schema,
      relations: schema.relations.map((relation) =>
        relation.id === relationId
          ? {
              ...relation,
              toFieldId: selected,
              toPortSide: null,
            }
          : relation
      ),
    }));
  }

  updateRelationKind(relationId: string, event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) return;
    this.draftSchema.update((schema) => ({
      ...schema,
      relations: schema.relations.map((relation) =>
        relation.id === relationId
          ? {
              ...relation,
              kind: target.value === 'one-to-one' || target.value === 'many-to-many' ? target.value : 'one-to-many',
            }
          : relation
      ),
    }));
  }

  updateRelationEndingMode(relationId: string, event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) return;
    const endingMode: SchemaRelationEndingMode =
      target.value === 'edge' || target.value === 'offset-edge' ? target.value : 'port';
    this.draftSchema.update((schema) => ({
      ...schema,
      relations: schema.relations.map((relation) =>
        relation.id === relationId
          ? {
              ...relation,
              endingMode,
            }
          : relation
      ),
    }));
  }

  updateRelationColor(relationId: string, event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    this.draftSchema.update((schema) => ({
      ...schema,
      relations: schema.relations.map((relation) =>
        relation.id === relationId
          ? {
              ...relation,
              style: {
                ...relation.style,
                color: target.value,
              },
            }
          : relation
      ),
    }));
  }

  toggleRelationEndpointPort(relationId: string, endpoint: 'from' | 'to', event: PointerEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.selectedRelationId.set(relationId);
    this.selectedEntityId.set(null);
    this.selectedConnectionField.set(null);
    this.inspectorTab.set('relation');
    this.draftSchema.update((schema) => ({
      ...schema,
      relations: schema.relations.map((relation) => {
        if (relation.id !== relationId) return relation;
        if (endpoint === 'from') {
          if (!relation.fromFieldId) return relation;
          const current = relation.fromPortSide ?? 'left';
          return {
            ...relation,
            fromPortSide: current === 'left' ? 'right' : 'left',
          };
        }
        if (!relation.toFieldId) return relation;
        const current = relation.toPortSide ?? 'left';
        return {
          ...relation,
          toPortSide: current === 'left' ? 'right' : 'left',
        };
      }),
    }));
  }

  relationValidation(relation: SchemaRelation): RelationValidationResult {
    const fromField = relation.fromFieldId
      ? this.relationEntityFields(relation.fromEntityId).find((field) => field.id === relation.fromFieldId) ?? null
      : null;
    const toField = relation.toFieldId
      ? this.relationEntityFields(relation.toEntityId).find((field) => field.id === relation.toFieldId) ?? null
      : null;
    if (!fromField || !toField) {
      return { level: 'warning', message: 'Select both source and target fields to complete field-level relation.' };
    }
    const left = this.normalizeFieldType(fromField.type);
    const right = this.normalizeFieldType(toField.type);
    if (left !== right && !this.areCompatibleTypes(left, right)) {
      return {
        level: 'warning',
        message: `Potential type mismatch: ${fromField.name} (${fromField.type}) -> ${toField.name} (${toField.type}).`,
      };
    }
    return { level: 'ok', message: 'Types are compatible.' };
  }

  private normalizeFieldType(type: string): string {
    const normalized = type.trim().toLowerCase();
    if (!normalized) return 'unknown';
    const base = normalized.replace(/\(.*\)$/, '').trim();
    if (/^(int|int2|int4|smallint|integer|serial|bigint|bigserial|smallserial)$/.test(base)) return 'integer';
    if (/^(numeric|decimal|float|float4|float8|double|double precision|real|money)$/.test(base)) return 'number';
    if (/^(text|varchar|char|character varying|character|citext|string)$/.test(base)) return 'text';
    if (/^(uuid)$/.test(base)) return 'uuid';
    if (/^(bool|boolean)$/.test(base)) return 'boolean';
    if (/^(date|time|timetz|timestamp|timestamptz|datetime)$/.test(base)) return 'datetime';
    if (/^(json|jsonb)$/.test(base)) return 'json';
    return normalized;
  }

  private areCompatibleTypes(left: string, right: string): boolean {
    if (left === right) return true;
    const pairs = new Set([
      'integer:number',
      'number:integer',
      'text:uuid',
      'uuid:text',
    ]);
    return pairs.has(`${left}:${right}`);
  }

  removeRelation(relationId: string): void {
    this.draftSchema.update((schema) => ({
      ...schema,
      relations: schema.relations.filter((relation) => relation.id !== relationId),
    }));
    if (this.selectedRelationId() === relationId) {
      this.selectedRelationId.set(null);
    }
    if (this.hoveredRelationId() === relationId) {
      this.hoveredRelationId.set(null);
    }
  }

  updateCanvasBackground(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) return;
    this.draftSchema.update((schema) => ({
      ...schema,
      canvas: {
        ...schema.canvas,
        background: target.value === 'grid' || target.value === 'plain' ? target.value : 'dots',
      },
    }));
  }

  updateGridSize(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    const value = Number.parseInt(target.value, 10);
    this.draftSchema.update((schema) => ({
      ...schema,
      canvas: {
        ...schema.canvas,
        gridSize: Number.isFinite(value) ? Math.min(64, Math.max(8, value)) : schema.canvas.gridSize,
      },
    }));
  }

  toggleSnap(): void {
    this.draftSchema.update((schema) => ({
      ...schema,
      canvas: {
        ...schema.canvas,
        snapToGrid: !schema.canvas.snapToGrid,
      },
    }));
  }

  zoomIn(): void {
    this.draftView.update((view) => ({ ...view, zoom: Math.min(2, Number((view.zoom + 0.1).toFixed(2))) }));
  }

  zoomOut(): void {
    this.draftView.update((view) => ({ ...view, zoom: Math.max(0.35, Number((view.zoom - 0.1).toFixed(2))) }));
  }

  resetView(): void {
    this.draftView.update((view) => ({ ...view, zoom: 1, pan: { x: 0, y: 0 } }));
  }

  onWheel(event: WheelEvent): void {
    event.preventDefault();
    if (event.deltaY < 0) {
      this.zoomIn();
      return;
    }
    this.zoomOut();
  }

  relationRoute(relation: SchemaRelation): RelationRoute | null {
    const schema = this.draftSchema();
    const sourceEntity = schema.entities.find((entity) => entity.id === relation.fromEntityId);
    const targetEntity = schema.entities.find((entity) => entity.id === relation.toEntityId);
    if (!sourceEntity || !targetEntity) return null;

    const sourceCenter = this.entityCenter(sourceEntity);
    const targetCenter = this.entityCenter(targetEntity);
    const sourceSide = this.resolveRelationPortSide(sourceEntity, relation.fromFieldId, relation.fromPortSide, targetCenter);
    const targetSide = this.resolveRelationPortSide(targetEntity, relation.toFieldId, relation.toPortSide, sourceCenter);
    const safePadding = 10;
    const targetBounds = this.expandedEntityBounds(targetEntity, safePadding);

    const start = this.portPoint(sourceEntity, relation.fromFieldId, sourceSide, safePadding);
    const endHint = this.portPoint(targetEntity, relation.toFieldId, targetSide, safePadding);

    const points = this.normalizeOrthogonalPoints(this.defaultOrthogonalPoints(start, endHint, sourceSide, targetSide));
    const terminated = this.applyEndpointRules(points, targetBounds, relation.endingMode, relation.id);
    const linePath = this.pathFromPoints(terminated.linePoints);
    const labelText = relation.label || relation.kind;
    const labelPoint = this.polylineMiddlePoint(terminated.linePoints);
    const arrowPath = this.arrowPath(terminated.arrowBase, terminated.arrowTip, relation.id);
    return {
      linePath,
      arrowPath,
      labelPoint,
      labelText,
      startpoint: terminated.linePoints[0] ?? start,
      endpoint: terminated.arrowTip,
    };
  }

  connectionPreviewPath(connector: ConnectionState): string | null {
    const sourceEntity = this.draftSchema().entities.find((entity) => entity.id === connector.fromEntityId);
    if (!sourceEntity) return null;
    const startCenter = this.entityCenter(sourceEntity);
    const cursorPoint: SchemaPoint = { x: connector.cursorX, y: connector.cursorY };
    const sourceSide = this.resolveRelationPortSide(sourceEntity, connector.fromFieldId, connector.fromPortSide, cursorPoint);
    const start = this.portPoint(sourceEntity, connector.fromFieldId, sourceSide, 8);
    return this.pathFromPoints(
      this.normalizeOrthogonalPoints(this.defaultOrthogonalPoints(start, cursorPoint, sourceSide, this.bestPortSide(cursorPoint, start)))
    );
  }

  relationStrokeWidth(relationId: string): number {
    const zoom = this.draftView().zoom;
    const active = this.selectedRelationId() === relationId || this.hoveredRelationId() === relationId;
    const screen = active ? 2.8 : 2;
    return Number((screen / zoom).toFixed(3));
  }

  relationLabelWidth(label: string): number {
    return Math.max(52, Math.min(220, 14 + label.length * 6.8));
  }

  private relationGeometryZoom(): number {
    // At very low zoom, full inverse scaling over-expands arrow math and can distort orthogonal tails.
    // Clamp compensation so routing stays stable down to the minimum zoom.
    return Math.max(this.draftView().zoom, 0.7);
  }

  private relationArrowLength(relationId: string): number {
    const zoom = this.relationGeometryZoom();
    const active = this.selectedRelationId() === relationId || this.hoveredRelationId() === relationId;
    const screen = active ? 11 : 9;
    return screen / zoom;
  }

  private relationArrowWidth(relationId: string): number {
    const zoom = this.relationGeometryZoom();
    const active = this.selectedRelationId() === relationId || this.hoveredRelationId() === relationId;
    const screen = active ? 9 : 7;
    return screen / zoom;
  }

  private applyEndpointRules(
    points: SchemaPoint[],
    targetBounds: { left: number; right: number; top: number; bottom: number },
    endingMode: SchemaRelationEndingMode,
    relationId: string
  ): { linePoints: SchemaPoint[]; arrowBase: SchemaPoint; arrowTip: SchemaPoint } {
    if (points.length < 2) {
      const fallback = points[0] ?? { x: 0, y: 0 };
      return { linePoints: [fallback], arrowBase: fallback, arrowTip: fallback };
    }
    const basePoints = [...points];
    const prev = basePoints[basePoints.length - 2];
    const rawEnd = basePoints[basePoints.length - 1];
    const impact = this.segmentIntersectionWithRect(prev, rawEnd, targetBounds) ?? rawEnd;
    const dir = this.normalizeVector({ x: impact.x - prev.x, y: impact.y - prev.y }) ?? { x: 1, y: 0 };

    const tipInset = endingMode === 'edge' ? 0 : endingMode === 'offset-edge' ? 4 : 8;
    const arrowLength = this.relationArrowLength(relationId);
    const tip = { x: impact.x - dir.x * tipInset, y: impact.y - dir.y * tipInset };
    const lineEnd = { x: tip.x - dir.x * arrowLength, y: tip.y - dir.y * arrowLength };
    basePoints[basePoints.length - 1] = lineEnd;
    this.ensureLastSegmentMinLength(basePoints, 14 / this.relationGeometryZoom(), dir);
    const arrowBase = basePoints[basePoints.length - 1];
    return { linePoints: basePoints, arrowBase, arrowTip: tip };
  }

  private ensureLastSegmentMinLength(points: SchemaPoint[], minLength: number, fallbackDirection: SchemaPoint): void {
    if (points.length < 2) return;
    const lastIndex = points.length - 1;
    const prevIndex = lastIndex - 1;
    const last = points[lastIndex];
    const prev = points[prevIndex];
    const currentLength = Math.hypot(last.x - prev.x, last.y - prev.y);
    if (currentLength >= minLength) return;
    const norm = this.normalizeVector({ x: prev.x - last.x, y: prev.y - last.y }) ?? fallbackDirection;
    points[prevIndex] = {
      x: last.x + norm.x * minLength,
      y: last.y + norm.y * minLength,
    };
  }

  private defaultOrthogonalPoints(
    start: SchemaPoint,
    end: SchemaPoint,
    sourceSide: PortSide,
    targetSide: PortSide
  ): SchemaPoint[] {
    const portStub = 24;
    const minForward = 56;

    const sourceStub = this.projectFromPort(start, sourceSide, portStub);
    const targetStub = this.projectFromPort(end, targetSide, portStub);
    const sourceSafe = this.projectFromPort(start, sourceSide, minForward);
    const targetSafe = this.projectFromPort(end, targetSide, minForward);

    const isSourceHorizontal = sourceSide === 'left' || sourceSide === 'right';
    const isTargetHorizontal = targetSide === 'left' || targetSide === 'right';

    let middle: SchemaPoint[] = [];
    if (isSourceHorizontal && isTargetHorizontal) {
      const midX = (sourceSafe.x + targetSafe.x) / 2;
      middle = [
        { x: midX, y: sourceSafe.y },
        { x: midX, y: targetSafe.y },
      ];
    } else if (!isSourceHorizontal && !isTargetHorizontal) {
      const midY = (sourceSafe.y + targetSafe.y) / 2;
      middle = [
        { x: sourceSafe.x, y: midY },
        { x: targetSafe.x, y: midY },
      ];
    } else if (isSourceHorizontal) {
      middle = [{ x: targetSafe.x, y: sourceSafe.y }];
    } else {
      middle = [{ x: sourceSafe.x, y: targetSafe.y }];
    }

    if (middle.length) {
      middle[0] = this.clampAgainstSourceBacktracking(middle[0], start, sourceSide, minForward);
      const lastIndex = middle.length - 1;
      middle[lastIndex] = this.clampAgainstTargetApproach(middle[lastIndex], end, targetSide, minForward);
    }

    const fallbackPath = this.normalizeOrthogonalPoints([start, sourceStub, sourceSafe, ...middle, targetSafe, targetStub, end]);
    const obstaclePath = this.routeAroundEntities(sourceSafe, targetSafe, 10);
    if (!obstaclePath || obstaclePath.length < 2) {
      return fallbackPath;
    }
    return this.normalizeOrthogonalPoints([start, sourceStub, ...obstaclePath, targetStub, end]);
  }

  private routeAroundEntities(
    start: SchemaPoint,
    end: SchemaPoint,
    clearance: number
  ): SchemaPoint[] | null {
    const step = 10;
    const schema = this.draftSchema();
    const blockedRects = schema.entities.map((entity) => this.expandedEntityBounds(entity, clearance));
    if (!blockedRects.length) return [start, end];

    const bounds = this.routeSearchBounds(start, end, blockedRects, step);
    type Cell = { gx: number; gy: number };
    const toCell = (point: SchemaPoint): Cell => ({
      gx: Math.round((point.x - bounds.minX) / step),
      gy: Math.round((point.y - bounds.minY) / step),
    });
    const toPoint = (cell: Cell): SchemaPoint => ({
      x: bounds.minX + cell.gx * step,
      y: bounds.minY + cell.gy * step,
    });
    const keyOf = (cell: Cell): string => `${cell.gx}:${cell.gy}`;
    const startCell = toCell(start);
    const endCell = toCell(end);
    const startKey = keyOf(startCell);
    const endKey = keyOf(endCell);

    const isCellBlocked = (cell: Cell): boolean => {
      if (cell.gx < 0 || cell.gx > bounds.width || cell.gy < 0 || cell.gy > bounds.height) return true;
      const key = keyOf(cell);
      if (key === startKey || key === endKey) return false;
      const point = toPoint(cell);
      return blockedRects.some((rect) => this.pointInsideRect(point, rect));
    };

    const neighbors = (cell: Cell): Cell[] => [
      { gx: cell.gx + 1, gy: cell.gy },
      { gx: cell.gx - 1, gy: cell.gy },
      { gx: cell.gx, gy: cell.gy + 1 },
      { gx: cell.gx, gy: cell.gy - 1 },
    ];
    const heuristic = (cell: Cell): number => Math.abs(cell.gx - endCell.gx) + Math.abs(cell.gy - endCell.gy);

    const queue: Array<{ cell: Cell; priority: number }> = [{ cell: startCell, priority: heuristic(startCell) }];
    const cameFrom = new Map<string, string>();
    const gScore = new Map<string, number>([[startKey, 0]]);
    const visited = new Set<string>();
    const maxIterations = 24000;
    let iterations = 0;

    while (queue.length && iterations < maxIterations) {
      iterations += 1;
      queue.sort((a, b) => a.priority - b.priority);
      const current = queue.shift()!.cell;
      const currentKey = keyOf(current);
      if (visited.has(currentKey)) continue;
      visited.add(currentKey);
      if (currentKey === endKey) {
        const cells: Cell[] = [current];
        let backtrack = currentKey;
        while (cameFrom.has(backtrack)) {
          backtrack = cameFrom.get(backtrack)!;
          const [gx, gy] = backtrack.split(':').map((value) => Number.parseInt(value, 10));
          cells.push({ gx, gy });
        }
        cells.reverse();
        const points = cells.map((cell) => toPoint(cell));
        points[0] = start;
        points[points.length - 1] = end;
        return this.normalizeOrthogonalPoints(points);
      }

      const currentG = gScore.get(currentKey) ?? Number.POSITIVE_INFINITY;
      for (const next of neighbors(current)) {
        if (isCellBlocked(next)) continue;
        const nextKey = keyOf(next);
        const tentative = currentG + 1;
        const known = gScore.get(nextKey);
        if (known !== undefined && tentative >= known) continue;
        cameFrom.set(nextKey, currentKey);
        gScore.set(nextKey, tentative);
        queue.push({ cell: next, priority: tentative + heuristic(next) });
      }
    }

    return null;
  }

  private routeSearchBounds(
    start: SchemaPoint,
    end: SchemaPoint,
    rects: Array<{ left: number; right: number; top: number; bottom: number }>,
    step: number
  ): { minX: number; minY: number; width: number; height: number } {
    const margin = 120;
    const allX = [start.x, end.x, ...rects.flatMap((rect) => [rect.left, rect.right])];
    const allY = [start.y, end.y, ...rects.flatMap((rect) => [rect.top, rect.bottom])];
    const minX = Math.floor((Math.min(...allX) - margin) / step) * step;
    const minY = Math.floor((Math.min(...allY) - margin) / step) * step;
    const maxX = Math.ceil((Math.max(...allX) + margin) / step) * step;
    const maxY = Math.ceil((Math.max(...allY) + margin) / step) * step;
    return {
      minX,
      minY,
      width: Math.max(1, Math.round((maxX - minX) / step)),
      height: Math.max(1, Math.round((maxY - minY) / step)),
    };
  }

  private pointInsideRect(point: SchemaPoint, rect: { left: number; right: number; top: number; bottom: number }): boolean {
    return point.x > rect.left && point.x < rect.right && point.y > rect.top && point.y < rect.bottom;
  }

  private projectFromPort(point: SchemaPoint, side: PortSide, distance: number): SchemaPoint {
    switch (side) {
      case 'right':
        return { x: point.x + distance, y: point.y };
      case 'left':
        return { x: point.x - distance, y: point.y };
      case 'top':
        return { x: point.x, y: point.y - distance };
      default:
        return { x: point.x, y: point.y + distance };
    }
  }

  private clampAgainstSourceBacktracking(
    point: SchemaPoint,
    source: SchemaPoint,
    side: PortSide,
    minForward: number
  ): SchemaPoint {
    switch (side) {
      case 'right':
        return { ...point, x: Math.max(point.x, source.x + minForward) };
      case 'left':
        return { ...point, x: Math.min(point.x, source.x - minForward) };
      case 'bottom':
        return { ...point, y: Math.max(point.y, source.y + minForward) };
      case 'top':
        return { ...point, y: Math.min(point.y, source.y - minForward) };
      default:
        return point;
    }
  }

  private clampAgainstTargetApproach(
    point: SchemaPoint,
    target: SchemaPoint,
    side: PortSide,
    minForward: number
  ): SchemaPoint {
    switch (side) {
      case 'right':
        return { ...point, x: Math.max(point.x, target.x + minForward) };
      case 'left':
        return { ...point, x: Math.min(point.x, target.x - minForward) };
      case 'bottom':
        return { ...point, y: Math.max(point.y, target.y + minForward) };
      case 'top':
        return { ...point, y: Math.min(point.y, target.y - minForward) };
      default:
        return point;
    }
  }
  
  private normalizeOrthogonalPoints(points: SchemaPoint[]): SchemaPoint[] {
    if (points.length <= 1) return points;

    // 1. expand accidental diagonals into orthogonal turns
    const orthogonalized: SchemaPoint[] = [points[0]];
    for (let index = 1; index < points.length; index += 1) {
      const prev = orthogonalized[orthogonalized.length - 1];
      const next = points[index];
      const dx = Math.abs(next.x - prev.x);
      const dy = Math.abs(next.y - prev.y);
      if (dx > 0.001 && dy > 0.001) {
        orthogonalized.push({ x: next.x, y: prev.y });
      }
      orthogonalized.push(next);
    }

    // 2. remove exact duplicates / near duplicates
    const deduped = orthogonalized.filter((point, index) => {
      if (index === 0) return true;
      const prev = orthogonalized[index - 1];
      return Math.abs(point.x - prev.x) > 0.001 || Math.abs(point.y - prev.y) > 0.001;
    });

    if (deduped.length <= 2) return deduped;

    // 3. remove redundant collinear points
    const result: SchemaPoint[] = [deduped[0]];

    for (let i = 1; i < deduped.length - 1; i++) {
      const prev = result[result.length - 1];
      const curr = deduped[i];
      const next = deduped[i + 1];

      const sameX = Math.abs(prev.x - curr.x) <= 0.001 && Math.abs(curr.x - next.x) <= 0.001;
      const sameY = Math.abs(prev.y - curr.y) <= 0.001 && Math.abs(curr.y - next.y) <= 0.001;

      if (!sameX && !sameY) {
        result.push(curr);
      }
    }

    result.push(deduped[deduped.length - 1]);
    return this.squashTinyOrthogonalSegments(result, 6);
  }

  private squashTinyOrthogonalSegments(points: SchemaPoint[], minLength: number): SchemaPoint[] {
    if (points.length <= 2) return points;
    const epsilon = 0.001;
    const working = points.map((point) => ({ ...point }));
    const output: SchemaPoint[] = [working[0]];
    for (let index = 1; index < working.length - 1; index += 1) {
      const prev = output[output.length - 1];
      const curr = working[index];
      const next = working[index + 1];
      const segmentLength = Math.hypot(curr.x - prev.x, curr.y - prev.y);
      if (segmentLength >= minLength) {
        output.push(curr);
        continue;
      }

      const prevHorizontal = Math.abs(prev.y - curr.y) <= epsilon;
      const prevVertical = Math.abs(prev.x - curr.x) <= epsilon;
      const nextHorizontal = Math.abs(curr.y - next.y) <= epsilon;
      const nextVertical = Math.abs(curr.x - next.x) <= epsilon;

      // Replace tiny orthogonal "nicks" with a cleaner corner by shifting the following point.
      if (index + 1 < working.length - 1 && prevHorizontal && nextVertical) {
        working[index + 1] = { ...next, x: prev.x };
        continue;
      }
      if (index + 1 < working.length - 1 && prevVertical && nextHorizontal) {
        working[index + 1] = { ...next, y: prev.y };
        continue;
      }

      // For tiny straight segments, dropping the middle point keeps the path cleaner.
      if ((prevHorizontal && nextHorizontal) || (prevVertical && nextVertical)) {
        continue;
      }

      output.push(curr);
    }
    output.push(working[working.length - 1]);

    const deduped = output.filter((point, index) => {
      if (index === 0) return true;
      const prev = output[index - 1];
      return Math.abs(point.x - prev.x) > epsilon || Math.abs(point.y - prev.y) > epsilon;
    });
    if (deduped.length <= 2) return deduped;

    const compact: SchemaPoint[] = [deduped[0]];
    for (let index = 1; index < deduped.length - 1; index += 1) {
      const prev = compact[compact.length - 1];
      const curr = deduped[index];
      const next = deduped[index + 1];
      const sameX = Math.abs(prev.x - curr.x) <= epsilon && Math.abs(curr.x - next.x) <= epsilon;
      const sameY = Math.abs(prev.y - curr.y) <= epsilon && Math.abs(curr.y - next.y) <= epsilon;
      if (!sameX && !sameY) {
        compact.push(curr);
      }
    }
    compact.push(deduped[deduped.length - 1]);
    return compact;
  }

  private pathFromPoints(points: SchemaPoint[]): string {
    if (!points.length) return '';
    let path = `M ${points[0].x} ${points[0].y}`;
    for (let index = 1; index < points.length; index += 1) {
      path += ` L ${points[index].x} ${points[index].y}`;
    }
    return path;
  }

  private arrowPath(base: SchemaPoint, tip: SchemaPoint, relationId: string): string {
    const dir = this.normalizeVector({ x: tip.x - base.x, y: tip.y - base.y }) ?? { x: 1, y: 0 };
    const length = this.relationArrowLength(relationId);
    const width = this.relationArrowWidth(relationId);
    const realBase = {
      x: tip.x - dir.x * length,
      y: tip.y - dir.y * length,
    };
    const perp = { x: -dir.y, y: dir.x };
    const left = { x: realBase.x + perp.x * (width / 2), y: realBase.y + perp.y * (width / 2) };
    const right = { x: realBase.x - perp.x * (width / 2), y: realBase.y - perp.y * (width / 2) };
    return `M ${tip.x} ${tip.y} L ${left.x} ${left.y} L ${right.x} ${right.y} Z`;
  }

  private polylineMiddlePoint(points: SchemaPoint[]): SchemaPoint | null {
    if (points.length < 2) return points[0] ?? null;
    let total = 0;
    const lengths: number[] = [];
    for (let index = 0; index < points.length - 1; index += 1) {
      const length = Math.hypot(points[index + 1].x - points[index].x, points[index + 1].y - points[index].y);
      lengths.push(length);
      total += length;
    }
    if (total < 0.001) return points[0];
    const middle = total / 2;
    let acc = 0;
    for (let index = 0; index < lengths.length; index += 1) {
      const segmentLength = lengths[index];
      if (acc + segmentLength >= middle && segmentLength > 0.001) {
        const t = (middle - acc) / segmentLength;
        return {
          x: points[index].x + (points[index + 1].x - points[index].x) * t,
          y: points[index].y + (points[index + 1].y - points[index].y) * t,
        };
      }
      acc += segmentLength;
    }
    return points[points.length - 1];
  }

  addRelationBendPoint(relationId: string, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const relation = this.draftSchema().relations.find((item) => item.id === relationId);
    if (!relation) return;
    const route = this.relationRoute(relation);
    if (!route) return;
    const point = this.canvasPoint(event);
    const start = this.linePathStart(route.linePath);
    const end = this.linePathEnd(route.linePath);
    if (!start || !end) return;
    const sourceSide = this.bestPortSide(start, end);
    const targetSide = this.bestPortSide(end, start);
    const bends = relation.bendPoints.length
      ? [...relation.bendPoints]
      : this.defaultOrthogonalPoints(start, end, sourceSide, targetSide).slice(1, -1);
    const chain = [start, ...bends, end];
    let bestSegment = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let index = 0; index < chain.length - 1; index += 1) {
      const distance = this.distanceToSegment(point, chain[index], chain[index + 1]);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestSegment = index;
      }
    }
    bends.splice(Math.max(0, Math.min(bends.length, bestSegment)), 0, point);
    this.draftSchema.update((schema) => ({
      ...schema,
      relations: schema.relations.map((item) => (item.id === relationId ? { ...item, bendPoints: bends } : item)),
    }));
  }

  startBendPointDrag(relationId: string, bendIndex: number, event: PointerEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.bendDragState = { relationId, bendIndex, pointerId: event.pointerId };
  }

  removeBendPoint(relationId: string, bendIndex: number, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.draftSchema.update((schema) => ({
      ...schema,
      relations: schema.relations.map((relation) =>
        relation.id === relationId ? { ...relation, bendPoints: relation.bendPoints.filter((_, index) => index !== bendIndex) } : relation
      ),
    }));
  }

  private linePathStart(path: string): SchemaPoint | null {
    const matches = path.match(/M\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/);
    if (!matches) return null;
    return { x: Number(matches[1]), y: Number(matches[2]) };
  }

  private linePathEnd(path: string): SchemaPoint | null {
    const matches = [...path.matchAll(/L\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g)];
    if (!matches.length) return null;
    const last = matches[matches.length - 1];
    return { x: Number(last[1]), y: Number(last[2]) };
  }

  private entityCenter(entity: SchemaEntity): SchemaPoint {
    return { x: entity.position.x + entity.size.w / 2, y: entity.position.y + entity.size.h / 2 };
  }

  private expandedEntityBounds(entity: SchemaEntity, padding: number): { left: number; right: number; top: number; bottom: number } {
    return {
      left: entity.position.x - padding,
      right: entity.position.x + entity.size.w + padding,
      top: entity.position.y - padding,
      bottom: entity.position.y + entity.size.h + padding,
    };
  }

  private bestPortSide(from: SchemaPoint, to: SchemaPoint): PortSide {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    if (Math.abs(dx) >= Math.abs(dy)) {
      return dx >= 0 ? 'right' : 'left';
    }
    return dy >= 0 ? 'bottom' : 'top';
  }

  private resolveRelationPortSide(
    entity: SchemaEntity,
    fieldId: string | null,
    preferredSide: SchemaRelationFieldPortSide | null,
    otherPoint: SchemaPoint
  ): PortSide {
    if (fieldId) {
      if (preferredSide) return preferredSide;
      const center = this.entityCenter(entity);
      return otherPoint.x >= center.x ? 'right' : 'left';
    }
    return this.bestPortSide(this.entityCenter(entity), otherPoint);
  }

  private portPoint(entity: SchemaEntity, fieldId: string | null, side: PortSide, outward: number): SchemaPoint {
    const lane = this.fieldLane(entity.id, fieldId);
    const center = this.entityCenter(entity);
    const xLane = lane?.x ?? center.x;
    const yLane = lane?.y ?? center.y;
    switch (side) {
      case 'left':
        return { x: entity.position.x - outward, y: yLane };
      case 'right':
        return { x: entity.position.x + entity.size.w + outward, y: yLane };
      case 'top':
        return { x: xLane, y: entity.position.y - outward };
      default:
        return { x: xLane, y: entity.position.y + entity.size.h + outward };
    }
  }

  private fieldLane(entityId: string, fieldId: string | null): FieldAnchorPoint | null {
    const host = this.canvasHost?.nativeElement;
    if (!host || !fieldId) return null;
    const element = host.querySelector<HTMLElement>(`[data-schema-entity-id="${entityId}"][data-schema-field-id="${fieldId}"]`);
    if (!element) return null;
    const hostRect = host.getBoundingClientRect();
    const rect = element.getBoundingClientRect();
    const view = this.draftView();
    return {
      x: (rect.left + rect.width / 2 - hostRect.left - view.pan.x) / view.zoom,
      y: (rect.top + rect.height / 2 - hostRect.top - view.pan.y) / view.zoom,
    };
  }

  private distanceToSegment(point: SchemaPoint, start: SchemaPoint, end: SchemaPoint): number {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const len = dx * dx + dy * dy;
    if (!len) return Math.hypot(point.x - start.x, point.y - start.y);
    let t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / len;
    t = Math.max(0, Math.min(1, t));
    const proj = { x: start.x + dx * t, y: start.y + dy * t };
    return Math.hypot(point.x - proj.x, point.y - proj.y);
  }

  private segmentIntersectionWithRect(
    start: SchemaPoint,
    end: SchemaPoint,
    rect: { left: number; right: number; top: number; bottom: number }
  ): SchemaPoint | null {
    const intersections: SchemaPoint[] = [];
    const edges: [SchemaPoint, SchemaPoint][] = [
      [{ x: rect.left, y: rect.top }, { x: rect.right, y: rect.top }],
      [{ x: rect.right, y: rect.top }, { x: rect.right, y: rect.bottom }],
      [{ x: rect.right, y: rect.bottom }, { x: rect.left, y: rect.bottom }],
      [{ x: rect.left, y: rect.bottom }, { x: rect.left, y: rect.top }],
    ];
    for (const [edgeStart, edgeEnd] of edges) {
      const point = this.segmentIntersection(start, end, edgeStart, edgeEnd);
      if (point) intersections.push(point);
    }
    if (!intersections.length) return null;
    intersections.sort((a, b) => Math.hypot(a.x - start.x, a.y - start.y) - Math.hypot(b.x - start.x, b.y - start.y));
    return intersections[0];
  }

  private segmentIntersection(a1: SchemaPoint, a2: SchemaPoint, b1: SchemaPoint, b2: SchemaPoint): SchemaPoint | null {
    const d = (a2.x - a1.x) * (b2.y - b1.y) - (a2.y - a1.y) * (b2.x - b1.x);
    if (Math.abs(d) < 0.001) return null;
    const ua = ((b1.x - a1.x) * (b2.y - b1.y) - (b1.y - a1.y) * (b2.x - b1.x)) / d;
    const ub = ((b1.x - a1.x) * (a2.y - a1.y) - (b1.y - a1.y) * (a2.x - a1.x)) / d;
    if (ua < 0 || ua > 1 || ub < 0 || ub > 1) return null;
    return {
      x: a1.x + ua * (a2.x - a1.x),
      y: a1.y + ua * (a2.y - a1.y),
    };
  }

  private normalizeVector(point: SchemaPoint): SchemaPoint | null {
    const length = Math.hypot(point.x, point.y);
    if (length < 0.0001) return null;
    return { x: point.x / length, y: point.y / length };
  }

  requestCancel(): void {
    if (this.hasUnsavedChanges()) {
      const shouldDiscard = window.confirm('You have unsaved changes. Discard them and close the schema editor?');
      if (!shouldDiscard) return;
    }
    this.cancel.emit();
  }

  handleBackdropPointerDown(event: PointerEvent): void {
    event.preventDefault();
    this.requestCancel();
  }

  @HostListener('document:keydown.escape', ['$event'])
  onDocumentEscape(event: KeyboardEvent): void {
    if (!this.visible()) return;
    event.preventDefault();
    this.requestCancel();
  }

  emitApply(): void {
    const title = this.draftTitle().trim();
    if (!title) return;
    this.clearStoredDraft();
    this.restoredLocalDraft.set(false);
    this.apply.emit({
      title,
      bodyText: this.value().bodyText,
      schema: this.draftSchema(),
      view: this.draftView(),
    });
  }

  @HostListener('document:pointermove', ['$event'])
  onDocumentPointerMove(event: PointerEvent): void {
    if (this.dragState && this.dragState.pointerId === event.pointerId) {
      event.preventDefault();
      const point = this.canvasPoint(event);
      const nextX = this.applySnap(point.x - this.dragState.offsetX);
      const nextY = this.applySnap(point.y - this.dragState.offsetY);
      this.draftSchema.update((schema) => ({
        ...schema,
        entities: schema.entities.map((entity) =>
          entity.id === this.dragState!.entityId
            ? {
                ...entity,
                position: {
                  x: nextX,
                  y: nextY,
                },
              }
            : entity
        ),
      }));
    }

    if (this.resizeState && this.resizeState.pointerId === event.pointerId) {
      event.preventDefault();
      const point = this.canvasPoint(event);
      const width = this.applySnap(this.resizeState.startWidth + (point.x - this.resizeState.startX));
      const height = this.applySnap(this.resizeState.startHeight + (point.y - this.resizeState.startY));
      this.draftSchema.update((schema) => ({
        ...schema,
        entities: schema.entities.map((entity) =>
          entity.id === this.resizeState!.entityId
            ? {
                ...entity,
                size: {
                  w: Math.max(220, width),
                  h: Math.max(160, height),
                },
              }
            : entity
        ),
      }));
    }

    if (this.panState && this.panState.pointerId === event.pointerId) {
      event.preventDefault();
      this.draftView.update((view) => ({
        ...view,
        pan: {
          x: this.panState!.originX + (event.clientX - this.panState!.startX),
          y: this.panState!.originY + (event.clientY - this.panState!.startY),
        },
      }));
    }

    if (this.bendDragState && this.bendDragState.pointerId === event.pointerId) {
      event.preventDefault();
      const point = this.canvasPoint(event);
      const nextPoint = {
        x: this.applySnap(point.x),
        y: this.applySnap(point.y),
      };
      this.draftSchema.update((schema) => ({
        ...schema,
        relations: schema.relations.map((relation) =>
          relation.id === this.bendDragState!.relationId
            ? {
                ...relation,
                bendPoints: relation.bendPoints.map((bend, index) =>
                  index === this.bendDragState!.bendIndex ? nextPoint : bend
                ),
              }
            : relation
        ),
      }));
    }

    const connector = this.connectionDraft();
    if (connector && connector.pointerId === event.pointerId) {
      event.preventDefault();
      const point = this.canvasPoint(event);
      this.connectionDraft.set({
        ...connector,
        cursorX: point.x,
        cursorY: point.y,
      });
    }
  }

  @HostListener('document:pointerup', ['$event'])
  onDocumentPointerUp(event: PointerEvent): void {
    if (this.dragState?.pointerId === event.pointerId) {
      this.dragState = null;
    }
    if (this.resizeState?.pointerId === event.pointerId) {
      this.resizeState = null;
    }
    if (this.panState?.pointerId === event.pointerId) {
      this.panState = null;
    }
    if (this.bendDragState?.pointerId === event.pointerId) {
      this.bendDragState = null;
    }
    const connector = this.connectionDraft();
    if (connector && connector.pointerId === event.pointerId) {
      this.connectionDraft.set(null);
    }
  }
}
