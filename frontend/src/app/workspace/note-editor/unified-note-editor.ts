import {
  CommonModule,
} from '@angular/common';
import {
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  ViewChild,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { Editor, JSONContent, Node as TiptapNode, mergeAttributes } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Image from '@tiptap/extension-image';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import Placeholder from '@tiptap/extension-placeholder';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { Selection } from '@tiptap/extensions/selection';
import { Mark as ProseMirrorMark, Node as ProseMirrorNode } from '@tiptap/pm/model';
import { NodeSelection, Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { createLowlight, common } from 'lowlight';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom, forkJoin, of } from 'rxjs';
import { Note, NoteBlock, NotePresenceUser, NotesService } from '../../core/api/notes.service';
import { AuthService } from '../../core/auth/auth.service';
import { NoteUnsavedChangesService } from './note-unsaved-changes.service';
import { Space, SpacesService } from '../../core/api/spaces.service';
import { Folder, FoldersService } from '../../core/api/folders.service';
import { SPACE_AVATAR_OPTIONS } from '../icons/icon-space-avatar';
import { buildNoteToken, buildSpaceToken, parseNoteIdToken, resolveSpaceIdToken } from '../note-links';
import { DatabaseSchemaEditorComponent } from './database-schema-editor/database-schema-editor';
import {
  DatabaseSchemaAttrs,
  DatabaseSchemaEditorValue,
  SchemaColorToken,
  SCHEMA_COLOR_TOKENS,
  VisualSchemaModel,
  VisualSchemaViewState,
} from './database-schema-types';
import {
  createDefaultDatabaseSchemaValue,
  normalizeDatabaseSchemaAttrs,
  toDatabaseSchemaNodeAttrs,
} from './database-schema-mapper';

const RICH_TEXT_BLOCK_TYPE = 'rich_text';
const LEGACY_TEXT_BLOCK_TYPE = 'text';
const LEGACY_CODE_BLOCK_TYPE = 'code';
const LEGACY_NOTE_LINK_BLOCK_TYPE = 'note_link';
const DATABASE_SCHEMA_NODE = 'databaseSchema';
const TEXT_COLOR_TOKENS = [
  'var(--rt-text-default)',
  'var(--rt-text-muted)',
  'var(--rt-text-subtle)',
  'var(--rt-text-soft)',
  'var(--rt-text-red)',
  'var(--rt-text-orange)',
  'var(--rt-text-amber)',
  'var(--rt-text-yellow)',
  'var(--rt-text-lime)',
  'var(--rt-text-green)',
  'var(--rt-text-emerald)',
  'var(--rt-text-teal)',
  'var(--rt-text-cyan)',
  'var(--rt-text-sky)',
  'var(--rt-text-blue)',
  'var(--rt-text-indigo)',
  'var(--rt-text-violet)',
  'var(--rt-text-purple)',
  'var(--rt-text-fuchsia)',
  'var(--rt-text-pink)',
  'var(--rt-text-rose)',
] as const;
const HIGHLIGHT_COLOR_TOKENS = [
  'var(--rt-hl-1)',
  'var(--rt-hl-2)',
  'var(--rt-hl-3)',
  'var(--rt-hl-4)',
  'var(--rt-hl-5)',
  'var(--rt-hl-6)',
  'var(--rt-hl-7)',
] as const;
const CODE_LANGUAGES = ['plaintext', 'css', 'html', 'javascript', 'typescript', 'json', 'sql', 'bash'] as const;
const CODE_LANGUAGE_ALIASES: Record<string, (typeof CODE_LANGUAGES)[number]> = {
  text: 'plaintext',
  plain: 'plaintext',
  txt: 'plaintext',
  js: 'javascript',
  ts: 'typescript',
  scss: 'css',
  less: 'css',
  shell: 'bash',
  sh: 'bash',
  zsh: 'bash',
};
const TABLE_SIZES = Array.from({ length: 10 }, (_, index) => index + 1);
const lowlight = createLowlight(common);
const BRACKET_DEPTH_PLUGIN_KEY = new PluginKey<DecorationSet>('codeBlockBracketDepth');
const BRACKET_OPEN_TO_CLOSE: Record<string, string> = {
  '(': ')',
  '[': ']',
  '{': '}',
};
const BRACKET_CLOSE_TO_OPEN: Record<string, string> = {
  ')': '(',
  ']': '[',
  '}': '{',
};
const AUTOPAIR_BRACKETS: Record<string, string> = {
  '(': ')',
  '[': ']',
  '{': '}',
};

interface NoteActiveUser {
  id: number;
  label: string;
  email: string | null;
  initials: string;
  avatarColor: string | null;
  activity: 'Viewing' | 'Editing';
}

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;
type HeadingValue = 'paragraph' | `h${HeadingLevel}`;
type AlignOptionValue = 'left' | 'center' | 'right' | 'justify';
type FormatMenuAction = 'underline' | 'strike' | 'code' | 'subscript' | 'superscript';
type ToolbarIconName =
  | 'paragraph'
  | 'chevronDown'
  | 'listOrdered'
  | 'listBullet'
  | 'alignLeft'
  | 'alignCenter'
  | 'alignRight'
  | 'alignJustify'
  | 'image'
  | 'table'
  | 'plus'
  | 'link'
  | 'undo'
  | 'redo'
  | 'trash';

interface ToolbarIcon {
  viewBox: string;
  paths: string[];
}

interface HeadingOption {
  value: HeadingValue;
  label: string;
  level?: HeadingLevel;
  shortcut?: string;
}

interface FormatMenuItem {
  action: FormatMenuAction;
  label: string;
  glyph: string;
  modifierClass?: string;
  shortcut?: string;
}

interface AlignOption {
  value: AlignOptionValue;
  label: string;
  icon: ToolbarIconName;
  shortcut?: string;
}

interface FocusedLinkState {
  from: number;
  to: number;
  href: string;
  label: string;
  kind: 'note' | 'space' | 'external';
  view: LinkViewMode;
  left: number;
  top: number;
}

type LinkViewMode = 'inline' | 'text';
type LinkEditorMode = 'insert' | 'edit';
type DatabaseSchemaEditorMode = 'insert' | 'edit';

interface LinkEditorState {
  mode: LinkEditorMode;
  from: number;
  to: number;
  empty: boolean;
  href: string;
  label: string;
  left: number;
  top: number;
  error: string | null;
}

interface DatabaseSchemaEditorState {
  mode: DatabaseSchemaEditorMode;
  position: number | null;
  value: DatabaseSchemaEditorValue;
  error: string | null;
}

interface SelectedDatabaseSchemaState {
  position: number;
  value: DatabaseSchemaEditorValue;
}

interface DatabaseSchemaNodeOpenDetail {
  position: number | null;
  mode: 'view' | 'edit';
}

interface LinkMenuIcons {
  copy: string;
  follow: string;
  edit: string;
  unlink: string;
}

const HEADING_OPTIONS: HeadingOption[] = [
  { value: 'paragraph', label: 'Normal Text', shortcut: 'Mod+Alt+0' },
  { value: 'h1', label: 'Heading 1', level: 1, shortcut: 'Mod+Alt+1' },
  { value: 'h2', label: 'Heading 2', level: 2, shortcut: 'Mod+Alt+2' },
  { value: 'h3', label: 'Heading 3', level: 3, shortcut: 'Mod+Alt+3' },
  { value: 'h4', label: 'Heading 4', level: 4, shortcut: 'Mod+Alt+4' },
  { value: 'h5', label: 'Heading 5', level: 5, shortcut: 'Mod+Alt+5' },
  { value: 'h6', label: 'Heading 6', level: 6, shortcut: 'Mod+Alt+6' },
];

const FORMAT_MENU_ITEMS: FormatMenuItem[] = [
  { action: 'underline', label: 'Underline', glyph: 'U', modifierClass: 'toolbar-glyph--underline', shortcut: 'Mod+U' },
  { action: 'strike', label: 'Strikethrough', glyph: 'S', modifierClass: 'toolbar-glyph--strike', shortcut: 'Mod+Shift+X' },
  { action: 'code', label: 'Inline Code', glyph: '</>', modifierClass: 'toolbar-glyph--code', shortcut: 'Mod+E' },
  { action: 'subscript', label: 'Subscript', glyph: 'X', modifierClass: 'toolbar-glyph--subscript', shortcut: 'Mod+Alt+.' },
  { action: 'superscript', label: 'Superscript', glyph: 'X', modifierClass: 'toolbar-glyph--superscript', shortcut: 'Mod+Alt+Shift+.' },
];

const ALIGN_OPTIONS: AlignOption[] = [
  { value: 'left', label: 'Align Left', icon: 'alignLeft', shortcut: 'Mod+Alt+L' },
  { value: 'center', label: 'Align Center', icon: 'alignCenter', shortcut: 'Mod+Alt+C' },
  { value: 'right', label: 'Align Right', icon: 'alignRight', shortcut: 'Mod+Alt+R' },
  { value: 'justify', label: 'Justify', icon: 'alignJustify', shortcut: 'Mod+Alt+J' },
];

const TOOLBAR_ICONS: Record<ToolbarIconName, ToolbarIcon> = {
  paragraph: {
    viewBox: '0 0 24 24',
    paths: ['M5 6h14', 'M5 10h14', 'M5 14h10', 'M5 18h8'],
  },
  chevronDown: {
    viewBox: '0 0 24 24',
    paths: ['m6 9 6 6 6-6'],
  },
  listOrdered: {
    viewBox: '0 0 24 24',
    paths: ['M10 6h10', 'M10 12h10', 'M10 18h10', 'M4 6h2', 'M4 12h2', 'M4 18h2'],
  },
  listBullet: {
    viewBox: '0 0 24 24',
    paths: ['M8 6h12', 'M8 12h12', 'M8 18h12', 'M4 6h1.5', 'M4 12h1.5', 'M4 18h1.5'],
  },
  alignLeft: {
    viewBox: '0 0 24 24',
    paths: ['M4 6h16', 'M4 10h10', 'M4 14h16', 'M4 18h10'],
  },
  alignCenter: {
    viewBox: '0 0 24 24',
    paths: ['M4 6h16', 'M7 10h10', 'M4 14h16', 'M7 18h10'],
  },
  alignRight: {
    viewBox: '0 0 24 24',
    paths: ['M4 6h16', 'M10 10h10', 'M4 14h16', 'M10 18h10'],
  },
  alignJustify: {
    viewBox: '0 0 24 24',
    paths: ['M4 6h16', 'M4 10h16', 'M4 14h16', 'M4 18h16'],
  },
  image: {
    viewBox: '0 0 640 640',
    paths: ['M160 96C124.7 96 96 124.7 96 160L96 480C96 515.3 124.7 544 160 544L480 544C515.3 544 544 515.3 544 480L544 160C544 124.7 515.3 96 480 96L160 96zM224 176C250.5 176 272 197.5 272 224C272 250.5 250.5 272 224 272C197.5 272 176 250.5 176 224C176 197.5 197.5 176 224 176zM368 288C376.4 288 384.1 292.4 388.5 299.5L476.5 443.5C481 450.9 481.2 460.2 477 467.8C472.8 475.4 464.7 480 456 480L184 480C175.1 480 166.8 475 162.7 467.1C158.6 459.2 159.2 449.6 164.3 442.3L220.3 362.3C224.8 355.9 232.1 352.1 240 352.1C247.9 352.1 255.2 355.9 259.7 362.3L286.1 400.1L347.5 299.6C351.9 292.5 359.6 288.1 368 288.1z'],
  },
  table: {
    viewBox: '0 0 24 24',
    paths: ['M4 5h16v14H4z', 'M4 10h16', 'M9 5v14', 'M15 5v14'],
  },
  plus: {
    viewBox: '0 0 24 24',
    paths: ['M12 5v14', 'M5 12h14'],
  },
  link: {
    viewBox: '0 0 640 640',
    paths: ['M451.5 160C434.9 160 418.8 164.5 404.7 172.7C388.9 156.7 370.5 143.3 350.2 133.2C378.4 109.2 414.3 96 451.5 96C537.9 96 608 166 608 252.5C608 294 591.5 333.8 562.2 363.1L491.1 434.2C461.8 463.5 422 480 380.5 480C294.1 480 224 410 224 323.5C224 322 224 320.5 224.1 319C224.6 301.3 239.3 287.4 257 287.9C274.7 288.4 288.6 303.1 288.1 320.8C288.1 321.7 288.1 322.6 288.1 323.4C288.1 374.5 329.5 415.9 380.6 415.9C405.1 415.9 428.6 406.2 446 388.8L517.1 317.7C534.4 300.4 544.2 276.8 544.2 252.3C544.2 201.2 502.8 159.8 451.7 159.8zM307.2 237.3C305.3 236.5 303.4 235.4 301.7 234.2C289.1 227.7 274.7 224 259.6 224C235.1 224 211.6 233.7 194.2 251.1L123.1 322.2C105.8 339.5 96 363.1 96 387.6C96 438.7 137.4 480.1 188.5 480.1C205 480.1 221.1 475.7 235.2 467.5C251 483.5 269.4 496.9 289.8 507C261.6 530.9 225.8 544.2 188.5 544.2C102.1 544.2 32 474.2 32 387.7C32 346.2 48.5 306.4 77.8 277.1L148.9 206C178.2 176.7 218 160.2 259.5 160.2C346.1 160.2 416 230.8 416 317.1C416 318.4 416 319.7 416 321C415.6 338.7 400.9 352.6 383.2 352.2C365.5 351.8 351.6 337.1 352 319.4C352 318.6 352 317.9 352 317.1C352 283.4 334 253.8 307.2 237.5z'],
  },
  undo: {
    viewBox: '0 0 24 24',
    paths: ['M9 8 5 12l4 4', 'M5 12h8a6 6 0 0 1 6 6'],
  },
  redo: {
    viewBox: '0 0 24 24',
    paths: ['m15 8 4 4-4 4', 'M19 12h-8a6 6 0 0 0-6 6'],
  },
  trash: {
    viewBox: '0 0 24 24',
    paths: ['M4 7h16', 'M9 7V4h6v3', 'M7 7l1 13h8l1-13', 'M10 11v6', 'M14 11v6'],
  },
};

const LINK_MENU_ICONS: LinkMenuIcons = {
  copy: 'M288 64C252.7 64 224 92.7 224 128L224 384C224 419.3 252.7 448 288 448L480 448C515.3 448 544 419.3 544 384L544 183.4C544 166 536.9 149.3 524.3 137.2L466.6 81.8C454.7 70.4 438.8 64 422.3 64L288 64zM160 192C124.7 192 96 220.7 96 256L96 512C96 547.3 124.7 576 160 576L352 576C387.3 576 416 547.3 416 512L416 496L352 496L352 512L160 512L160 256L176 256L176 192L160 192z',
  follow:
    'M384 64C366.3 64 352 78.3 352 96C352 113.7 366.3 128 384 128L466.7 128L265.3 329.4C252.8 341.9 252.8 362.2 265.3 374.7C277.8 387.2 298.1 387.2 310.6 374.7L512 173.3L512 256C512 273.7 526.3 288 544 288C561.7 288 576 273.7 576 256L576 96C576 78.3 561.7 64 544 64L384 64zM144 160C99.8 160 64 195.8 64 240L64 496C64 540.2 99.8 576 144 576L400 576C444.2 576 480 540.2 480 496L480 416C480 398.3 465.7 384 448 384C430.3 384 416 398.3 416 416L416 496C416 504.8 408.8 512 400 512L144 512C135.2 512 128 504.8 128 496L128 240C128 231.2 135.2 224 144 224L224 224C241.7 224 256 209.7 256 192C256 174.3 241.7 160 224 160L144 160z',
  edit: 'M535.6 85.7C513.7 63.8 478.3 63.8 456.4 85.7L432 110.1L529.9 208L554.3 183.6C576.2 161.7 576.2 126.3 554.3 104.4L535.6 85.7zM236.4 305.7C230.3 311.8 225.6 319.3 222.9 327.6L193.3 416.4C190.4 425 192.7 434.5 199.1 441C205.5 447.5 215 449.7 223.7 446.8L312.5 417.2C320.7 414.5 328.2 409.8 334.4 403.7L496 241.9L398.1 144L236.4 305.7zM160 128C107 128 64 171 64 224L64 480C64 533 107 576 160 576L416 576C469 576 512 533 512 480L512 384C512 366.3 497.7 352 480 352C462.3 352 448 366.3 448 384L448 480C448 497.7 433.7 512 416 512L160 512C142.3 512 128 497.7 128 480L128 224C128 206.3 142.3 192 160 192L256 192C273.7 192 288 177.7 288 160C288 142.3 273.7 128 256 128L160 128z',
  unlink:
    'M416 480C433.7 480 448 494.3 448 512L448 576C448 593.7 433.7 608 416 608C398.3 608 384 593.7 384 576L384 512C384 494.3 398.3 480 416 480zM89.4 265.4C101.9 252.9 122.2 252.9 134.6 265.4C147 277.9 147.1 298.2 134.6 310.6L123.1 322.2C105.8 339.5 96 363.1 96 387.6C96 438.6 137.4 480 188.4 480C212.9 480 236.4 470.2 253.8 452.9L329.4 377.4C341.9 364.9 362.2 364.9 374.6 377.4C387 389.9 387.1 410.2 374.6 422.6L299.1 498.2C269.8 527.5 229.9 544 188.4 544C102 544 32 474 32 387.6C32 346.1 48.5 306.2 77.8 276.9L89.4 265.4zM473.4 441.4C485.9 428.9 506.2 428.9 518.6 441.4L566.6 489.4C579.1 501.9 579.1 522.2 566.6 534.6C554.1 547 533.8 547.1 521.4 534.6L473.4 486.6C460.9 474.1 460.9 453.8 473.4 441.4zM451.6 96C538 96 608 166 608 252.4C608 293.9 591.5 333.7 562.2 363.1L550.6 374.6C538.1 387.1 517.8 387.1 505.4 374.6C493 362.1 492.9 341.8 505.4 329.4L516.9 317.8C534.2 300.5 544 276.9 544 252.4C544 201.4 502.6 160 451.6 160C427.1 160 403.6 169.8 386.2 187.1L310.6 262.6C298.1 275.1 277.8 275.1 265.4 262.6C253 250.1 252.9 229.8 265.4 217.4L340.9 141.8C370.2 112.5 410.1 96 451.6 96zM73.4 105.4C85.9 92.9 106.2 92.9 118.6 105.4L166.6 153.4C179.1 165.9 179.1 186.2 166.6 198.6C154.1 211 133.8 211.1 121.4 198.6L73.4 150.6C60.9 138.1 60.9 117.8 73.4 105.4zM224 32C241.7 32 256 46.3 256 64L256 128C256 145.7 241.7 160 224 160C206.3 160 192 145.7 192 128L192 64C192 46.3 206.3 32 224 32z',
};

const SPACE_AVATAR_PATH_BY_KEY = new Map<number, string>(SPACE_AVATAR_OPTIONS.map((option) => [option.key, option.path]));

const AppLink = Link.extend({
  addAttributes() {
    const parent = this.parent?.() ?? {};
    return {
      ...parent,
      'data-app-link-kind': {
        default: 'external',
        parseHTML: (element: HTMLElement) => element.getAttribute('data-app-link-kind') ?? 'external',
        renderHTML: (attributes: Record<string, unknown>) =>
          attributes['data-app-link-kind'] ? { 'data-app-link-kind': String(attributes['data-app-link-kind']) } : {},
      },
      'data-app-link-view': {
        default: 'text',
        parseHTML: (element: HTMLElement) => element.getAttribute('data-app-link-view') ?? 'text',
        renderHTML: (attributes: Record<string, unknown>) =>
          attributes['data-app-link-view'] ? { 'data-app-link-view': String(attributes['data-app-link-view']) } : {},
      },
    };
  },
});

function emptyDoc(): JSONContent {
  return {
    type: 'doc',
    content: [{ type: 'paragraph' }],
  };
}

function isJsonContent(value: unknown): value is JSONContent {
  return !!value && typeof value === 'object' && typeof (value as { type?: string }).type === 'string';
}

function paragraphFromText(text: string): JSONContent[] {
  const trimmed = text.trim();
  if (!trimmed) {
    return [{ type: 'paragraph' }];
  }
  return trimmed.split(/\n{2,}/).map((chunk) => ({
    type: 'paragraph',
    content: [{ type: 'text', text: chunk.replace(/\n/g, ' ') }],
  }));
}

function splitMarkupLinkText(text: string): Array<{ kind: 'text' | 'link'; value: string; href?: string }> {
  const result: Array<{ kind: 'text' | 'link'; value: string; href?: string }> = [];
  const regex = /\[([^\]|]+?)\s*\|\s*([^\]]+?)\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null = regex.exec(text);
  while (match) {
    const index = match.index;
    if (index > lastIndex) {
      result.push({ kind: 'text', value: text.slice(lastIndex, index) });
    }
    result.push({ kind: 'link', value: match[1] ?? '', href: match[2] ?? '' });
    lastIndex = regex.lastIndex;
    match = regex.exec(text);
  }
  if (lastIndex < text.length) {
    result.push({ kind: 'text', value: text.slice(lastIndex) });
  }
  return result;
}

function cloneContent(content: JSONContent[] | undefined): JSONContent[] {
  return JSON.parse(JSON.stringify(content ?? [])) as JSONContent[];
}

function appendSpacer(nodes: JSONContent[]): void {
  if (!nodes.length) return;
  const last = nodes[nodes.length - 1];
  if (last.type !== 'paragraph' || (last.content?.length ?? 0) > 0) {
    nodes.push({ type: 'paragraph' });
  }
}

function normalizeCodeLanguage(language: unknown): (typeof CODE_LANGUAGES)[number] {
  const raw = typeof language === 'string' ? language.trim().toLowerCase() : '';
  if (!raw) return 'plaintext';
  const mapped = CODE_LANGUAGE_ALIASES[raw] ?? raw;
  return CODE_LANGUAGES.includes(mapped as (typeof CODE_LANGUAGES)[number])
    ? (mapped as (typeof CODE_LANGUAGES)[number])
    : 'plaintext';
}

function buildDocumentFromBlocks(blocks: NoteBlock[]): JSONContent {
  const ordered = [...blocks].sort((a, b) => parseFloat(a.position) - parseFloat(b.position));
  const nodes: JSONContent[] = [];
  for (const block of ordered) {
    const data = block.data ?? {};
    if (block.type === RICH_TEXT_BLOCK_TYPE && isJsonContent(data['doc'])) {
      nodes.push(...cloneContent((data['doc'] as JSONContent).content));
      continue;
    }
    if (block.type === LEGACY_TEXT_BLOCK_TYPE) {
      if (isJsonContent(data['doc']) && Array.isArray((data['doc'] as JSONContent).content)) {
        nodes.push(...cloneContent((data['doc'] as JSONContent).content));
      } else if (typeof data['content'] === 'string') {
        nodes.push(...paragraphFromText(data['content']));
      }
      appendSpacer(nodes);
      continue;
    }
    if (block.type === LEGACY_CODE_BLOCK_TYPE) {
      const rawCode = typeof data['raw_code'] === 'string' ? data['raw_code'] : '';
      nodes.push({
        type: 'codeBlock',
        attrs: {
          language: normalizeCodeLanguage(data['language']),
        },
        content: rawCode ? [{ type: 'text', text: rawCode }] : [],
      });
      appendSpacer(nodes);
      continue;
    }
    if (block.type === LEGACY_NOTE_LINK_BLOCK_TYPE) {
      const targetId = typeof data['target_note_id'] === 'string' ? data['target_note_id'] : '';
      if (targetId) {
        nodes.push({
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: `Linked note: ${targetId}`,
              marks: [
                {
                  type: 'link',
                  attrs: {
                    href: `/home/notes/${targetId}`,
                    target: null,
                    rel: null,
                  },
                },
              ],
            },
          ],
        });
        appendSpacer(nodes);
      }
      continue;
    }
    if (block.type === 'db_schema') {
      const normalized = normalizeDatabaseSchemaAttrs({
        title: data['title'],
        body: typeof data['body'] === 'string' ? data['body'] : data['schema'],
        schema: data['schema'],
        view: data['view'],
      });
      nodes.push({
        type: DATABASE_SCHEMA_NODE,
        attrs: toDatabaseSchemaNodeAttrs(normalized),
      });
      appendSpacer(nodes);
      continue;
    }
    if (Object.keys(data).length) {
      nodes.push({
        type: 'paragraph',
        content: [{ type: 'text', text: `[Unsupported ${block.type}]` }],
      });
      appendSpacer(nodes);
    }
  }
  const compact = nodes.filter((node, index, list) => {
    if (node.type !== 'paragraph' || (node.content?.length ?? 0) > 0) return true;
    const prev = list[index - 1];
    return prev?.type !== 'paragraph' || (prev.content?.length ?? 0) > 0;
  });
  return compact.length ? { type: 'doc', content: compact } : emptyDoc();
}

function normalizeSchemaColorToken(value: unknown): SchemaColorToken {
  if (typeof value === 'string' && (SCHEMA_COLOR_TOKENS as readonly string[]).includes(value)) {
    return value as SchemaColorToken;
  }
  return 'default';
}

function headerTextForHex(background: string): string {
  const normalized = background.trim();
  const hex = normalized.startsWith('#') ? normalized.slice(1) : '';
  if (!(hex.length === 3 || hex.length === 6)) return '#ffffff';
  const expanded = hex.length === 3 ? `${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}` : hex;
  const r = Number.parseInt(expanded.slice(0, 2), 16);
  const g = Number.parseInt(expanded.slice(2, 4), 16);
  const b = Number.parseInt(expanded.slice(4, 6), 16);
  if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) return '#ffffff';
  const luminance = (r * 299 + g * 587 + b * 114) / 1000;
  return luminance > 160 ? '#111827' : '#ffffff';
}

function applyEntityPaletteStyles(element: HTMLElement, entity: DatabaseSchemaEditorValue['schema']['entities'][number]): void {
  const token = normalizeSchemaColorToken(entity.style.colorToken);
  if (token === 'default') {
    element.style.setProperty('--schema-preview-entity-title', entity.style.titleColor);
    element.style.setProperty('--schema-preview-entity-title-text', headerTextForHex(entity.style.titleColor));
    element.style.setProperty('--schema-preview-entity-body', entity.style.blockColor);
    return;
  }
  element.style.setProperty('--schema-preview-entity-title', `var(--schema-palette-${token}-title)`);
  element.style.setProperty('--schema-preview-entity-title-text', `var(--schema-palette-${token}-title-text)`);
  element.style.setProperty('--schema-preview-entity-body', `var(--schema-palette-${token}-body)`);
}

function schemaFieldTags(
  field: DatabaseSchemaEditorValue['schema']['entities'][number]['fields'][number],
  isForeignKey: boolean
): string[] {
  const tags: string[] = [];
  if (field.isPrimary) tags.push('PK');
  if (isForeignKey) tags.push('FK');
  if (field.isUnique) tags.push('UQ');
  if (!field.nullable) tags.push('NN');
  if (field.isIndexed) tags.push('IDX');
  if (field.isAutoIncrement) tags.push('AI');
  return tags;
}

function schemaFieldViewText(
  entityId: string,
  field: DatabaseSchemaEditorValue['schema']['entities'][number]['fields'][number],
  foreignKeyTargets: Set<string>
): string {
  const isForeignKey = foreignKeyTargets.has(`${entityId}:${field.id}`);
  const tags = schemaFieldTags(field, isForeignKey);
  return `${field.name}: ${field.type}${tags.length ? ` [${tags.join(', ')}]` : ''}`;
}

const DatabaseSchemaNode = TiptapNode.create({
  name: DATABASE_SCHEMA_NODE,
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,
  addAttributes() {
    return {
      title: {
        default: 'Название схемы',
        parseHTML: (element) => element.getAttribute('data-title') ?? 'Название схемы',
      },
      body: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-body') ?? '',
      },
      schema: {
        default: createDefaultDatabaseSchemaValue().schema,
        parseHTML: (element) => {
          const raw = element.getAttribute('data-schema');
          if (!raw) return createDefaultDatabaseSchemaValue().schema;
          try {
            return JSON.parse(raw);
          } catch {
            return createDefaultDatabaseSchemaValue().schema;
          }
        },
      },
      view: {
        default: createDefaultDatabaseSchemaValue().view,
        parseHTML: (element) => {
          const raw = element.getAttribute('data-view');
          if (!raw) return createDefaultDatabaseSchemaValue().view;
          try {
            return JSON.parse(raw);
          } catch {
            return createDefaultDatabaseSchemaValue().view;
          }
        },
      },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-database-schema]' }];
  },
  renderHTML({ node }) {
    const normalized = normalizeDatabaseSchemaAttrs(node.attrs as DatabaseSchemaAttrs);
    const title = normalized.title;
    const foreignKeyTargets = new Set(
      normalized.schema.relations
        .filter((relation) => !!relation.toFieldId)
        .map((relation) => `${relation.toEntityId}:${relation.toFieldId}`)
    );
    const entityPreviewNodes = normalized.schema.entities.slice(0, 4).map((entity) => {
      const token = normalizeSchemaColorToken(entity.style.colorToken);
      const style =
        token === 'default'
          ? `--schema-preview-entity-title:${entity.style.titleColor};--schema-preview-entity-title-text:${headerTextForHex(entity.style.titleColor)};--schema-preview-entity-body:${entity.style.blockColor};`
          : `--schema-preview-entity-title:var(--schema-palette-${token}-title);--schema-preview-entity-title-text:var(--schema-palette-${token}-title-text);--schema-preview-entity-body:var(--schema-palette-${token}-body);`;
      return [
        'article',
        {
          class: 'database-schema-card__entity',
          style,
        },
        ['header', { class: 'database-schema-card__entity-header' }, entity.name],
        [
          'ul',
          { class: 'database-schema-card__entity-fields' },
          ...entity.fields.slice(0, 4).map((field) => [
            'li',
            {
              style:
                normalizeSchemaColorToken(field.colorToken) === 'default'
                  ? ''
                  : `background:var(--schema-palette-${normalizeSchemaColorToken(field.colorToken)}-field-bg);`,
            },
            schemaFieldViewText(entity.id, field, foreignKeyTargets),
          ]),
        ],
      ];
    });
    return [
      'div',
      {
        'data-database-schema': 'true',
        'data-title': title,
        'data-body': normalized.bodyText,
        'data-schema': JSON.stringify(normalized.schema),
        'data-view': JSON.stringify(normalized.view),
      },
      [
        'div',
        { class: 'database-schema-card database-schema-card--visual' },
        ['div', { class: 'database-schema-card__eyebrow' }, 'Название схемы'],
        ['div', { class: 'database-schema-card__title' }, title],
        ['div', { class: 'database-schema-card__canvas' }, ...entityPreviewNodes],
      ],
    ];
  },
  addNodeView() {
    return ({ node, editor, getPos }) => {
      let currentNode = node;
      const wrapper = document.createElement('div');
      wrapper.className = 'database-schema-card database-schema-card--visual database-schema-card--node';
      wrapper.setAttribute('data-database-schema-node-view', 'true');

      const title = document.createElement('div');
      title.className = 'database-schema-card__title';

      const canvas = document.createElement('div');
      canvas.className = 'database-schema-card__canvas';
      const frame = document.createElement('div');
      frame.className = 'database-schema-card__canvas-frame';
      const viewport = document.createElement('div');
      viewport.className = 'database-schema-card__canvas-viewport';
      const panSurface = document.createElement('div');
      panSurface.className = 'database-schema-card__pan-surface';
      const relationsLayer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      relationsLayer.setAttribute('class', 'database-schema-card__relations');
      const entitiesLayer = document.createElement('div');
      entitiesLayer.className = 'database-schema-card__entities';
      const openEditorButton = document.createElement('button');
      openEditorButton.type = 'button';
      openEditorButton.className = 'database-schema-card__action database-schema-card__action--expand';
      openEditorButton.title = 'Расширить схему';
      openEditorButton.setAttribute('aria-label', 'Расширить схему');
      openEditorButton.innerHTML =
        "<svg viewBox='0 0 24 24' focusable='false' aria-hidden='true'><path d='M15 3h6v6m0-6-7 7M9 21H3v-6m0 6 7-7M21 15v6h-6m6 0-7-7M3 9V3h6M3 3l7 7'/></svg>";

      viewport.append(relationsLayer, entitiesLayer);
      frame.append(viewport, panSurface, openEditorButton);
      canvas.append(frame);
      wrapper.append(title, canvas);
      wrapper.setAttribute('draggable', 'false');
      wrapper.addEventListener('dragstart', (event) => {
        event.preventDefault();
      });

      let frameWidth = 860;
      let frameHeight = 329;
      let sceneWidth = 1;
      let sceneHeight = 1;
      let fitScale = 1;
      let panX = 0;
      let panY = 0;
      let zoom = 1;
      const arrowMarkerId = `schemaCardArrow_${Math.random().toString(36).slice(2, 10)}`;
      let panState: { pointerId: number; startX: number; startY: number; originX: number; originY: number } | null = null;

      const nodePosition = (): number | null => {
        if (typeof getPos !== 'function') return null;
        const value = getPos();
        return typeof value === 'number' ? value : null;
      };

      const selectNode = (): void => {
        const position = nodePosition();
        if (position === null) return;
        const selection = NodeSelection.create(editor.state.doc, position);
        editor.view.dispatch(editor.state.tr.setSelection(selection));
      };

      const openSchemaEditor = (mode: 'view' | 'edit'): void => {
        const position = nodePosition();
        window.dispatchEvent(
          new CustomEvent('notes-database-schema-open', {
            detail: {
              position,
              mode,
            },
          })
        );
      };

      const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

      const applyTransform = (): void => {
        const totalScale = fitScale * zoom;
        viewport.style.transform = `translate(${panX}px, ${panY}px) scale(${totalScale})`;
      };

      const recalcFrame = (): void => {
        const rect = frame.getBoundingClientRect();
        frameWidth = Math.max(540, Math.round(rect.width || 860));
        frameHeight = Math.max(259, Math.round(rect.height || 329));
      };

      const renderEntities = (value: DatabaseSchemaEditorValue): void => {
        entitiesLayer.replaceChildren();
        relationsLayer.replaceChildren();
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
        marker.setAttribute('id', arrowMarkerId);
        marker.setAttribute('markerWidth', '8');
        marker.setAttribute('markerHeight', '6');
        marker.setAttribute('refX', '7');
        marker.setAttribute('refY', '3');
        marker.setAttribute('orient', 'auto');
        const markerPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        markerPath.setAttribute('d', 'M0,0 L8,3 L0,6 z');
        markerPath.setAttribute('fill', 'currentColor');
        marker.append(markerPath);
        defs.append(marker);
        relationsLayer.append(defs);

        const entities = value.schema.entities.slice(0, 20);
        const foreignKeyTargets = new Set(
          value.schema.relations
            .filter((relation) => !!relation.toFieldId)
            .map((relation) => `${relation.toEntityId}:${relation.toFieldId}`)
        );
        if (!entities.length) {
          const empty = document.createElement('div');
          empty.className = 'database-schema-card__canvas-empty';
          empty.textContent = 'No entities';
          entitiesLayer.append(empty);
          sceneWidth = frameWidth;
          sceneHeight = frameHeight;
          fitScale = 1;
          applyTransform();
          return;
        }

        type PortSide = 'left' | 'right' | 'top' | 'bottom';
        type LocalPoint = { x: number; y: number };
        type EntityGeom = { x: number; y: number; w: number; h: number; rowHeight: number; headerHeight: number };
        const relationDegree = new Map<string, number>();
        for (const entity of entities) {
          relationDegree.set(entity.id, 0);
        }
        for (const relation of value.schema.relations) {
          if (relationDegree.has(relation.fromEntityId)) {
            relationDegree.set(relation.fromEntityId, (relationDegree.get(relation.fromEntityId) ?? 0) + 1);
          }
          if (relationDegree.has(relation.toEntityId)) {
            relationDegree.set(relation.toEntityId, (relationDegree.get(relation.toEntityId) ?? 0) + 1);
          }
        }
        let rootEntity = entities[0];
        for (const entity of entities) {
          const candidateDegree = relationDegree.get(entity.id) ?? 0;
          const rootDegree = relationDegree.get(rootEntity.id) ?? 0;
          if (candidateDegree > rootDegree) {
            rootEntity = entity;
          }
        }
        const rootPaddingX = 220;
        const rootPaddingY = 160;
        const rootPosition = { x: rootEntity.position.x, y: rootEntity.position.y };
        const entitiesById = new Map(value.schema.entities.map((entity) => [entity.id, entity]));
        const points = new Map<string, EntityGeom>();
        let maxX = rootPaddingX;
        let maxY = rootPaddingY;
        for (const entity of entities) {
          const x = entity.position.x - rootPosition.x + rootPaddingX;
          const y = entity.position.y - rootPosition.y + rootPaddingY;
          const w = Math.max(220, entity.size.w);
          const h = Math.max(160, entity.size.h);
          points.set(entity.id, { x, y, w, h, rowHeight: 18, headerHeight: 28 });
          maxX = Math.max(maxX, x + w);
          maxY = Math.max(maxY, y + h);
        }
        const routePadding = 220;
        sceneWidth = Math.max(1, maxX + routePadding);
        sceneHeight = Math.max(1, maxY + routePadding);
        viewport.style.width = `${sceneWidth}px`;
        viewport.style.height = `${sceneHeight}px`;
        relationsLayer.setAttribute('viewBox', `0 0 ${sceneWidth} ${sceneHeight}`);
        relationsLayer.setAttribute('width', `${sceneWidth}`);
        relationsLayer.setAttribute('height', `${sceneHeight}`);
        const rawFit = Math.min(frameWidth / sceneWidth, frameHeight / sceneHeight);
        fitScale = clamp(rawFit, 0.1, 1);

        const entityCenter = (geom: EntityGeom): LocalPoint => ({ x: geom.x + geom.w / 2, y: geom.y + geom.h / 2 });
        const bestPortSide = (from: LocalPoint, to: LocalPoint): PortSide => {
          const dx = to.x - from.x;
          const dy = to.y - from.y;
          if (Math.abs(dx) >= Math.abs(dy)) {
            return dx >= 0 ? 'right' : 'left';
          }
          return dy >= 0 ? 'bottom' : 'top';
        };
        const resolvePortSide = (
          relation: VisualSchemaModel['relations'][number],
          kind: 'from' | 'to',
          fromGeom: EntityGeom,
          toGeom: EntityGeom
        ): PortSide => {
          const explicit = kind === 'from' ? relation.fromPortSide : relation.toPortSide;
          const fieldId = kind === 'from' ? relation.fromFieldId : relation.toFieldId;
          if (fieldId) {
            if (explicit === 'left' || explicit === 'right') return explicit;
            return entityCenter(toGeom).x >= entityCenter(fromGeom).x ? 'right' : 'left';
          }
          return bestPortSide(entityCenter(fromGeom), entityCenter(toGeom));
        };
        const fieldLane = (entityId: string, fieldId: string | null, geom: EntityGeom): LocalPoint => {
          const entity = entitiesById.get(entityId);
          if (!entity || !fieldId) return { x: geom.x + geom.w / 2, y: geom.y + geom.h / 2 };
          const index = Math.max(0, entity.fields.findIndex((field) => field.id === fieldId));
          return {
            x: geom.x + geom.w / 2,
            y: Math.min(geom.y + geom.h - 10, geom.y + geom.headerHeight + geom.rowHeight * index + geom.rowHeight / 2),
          };
        };
        const portPoint = (entityId: string, fieldId: string | null, side: PortSide, outward: number, geom: EntityGeom): LocalPoint => {
          const lane = fieldLane(entityId, fieldId, geom);
          switch (side) {
            case 'left':
              return { x: geom.x - outward, y: lane.y };
            case 'right':
              return { x: geom.x + geom.w + outward, y: lane.y };
            case 'top':
              return { x: lane.x, y: geom.y - outward };
            default:
              return { x: lane.x, y: geom.y + geom.h + outward };
          }
        };
        const expandedEntityBounds = (
          geom: EntityGeom,
          padding: number
        ): { left: number; right: number; top: number; bottom: number } => ({
          left: geom.x - padding,
          right: geom.x + geom.w + padding,
          top: geom.y - padding,
          bottom: geom.y + geom.h + padding,
        });
        const pointInsideRect = (
          point: LocalPoint,
          rect: { left: number; right: number; top: number; bottom: number }
        ): boolean => point.x > rect.left && point.x < rect.right && point.y > rect.top && point.y < rect.bottom;
        const projectFromPort = (point: LocalPoint, side: PortSide, distance: number): LocalPoint => {
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
        };
        const normalizeVector = (point: LocalPoint): LocalPoint | null => {
          const length = Math.hypot(point.x, point.y);
          if (length < 0.0001) return null;
          return { x: point.x / length, y: point.y / length };
        };
        const normalizeOrthogonalPoints = (pathPoints: LocalPoint[]): LocalPoint[] => {
          if (pathPoints.length <= 1) return pathPoints;

          // 1. expand accidental diagonals into orthogonal turns
          const orthogonalized: LocalPoint[] = [pathPoints[0]];
          for (let index = 1; index < pathPoints.length; index += 1) {
            const prev = orthogonalized[orthogonalized.length - 1];
            const next = pathPoints[index];
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
          const result: LocalPoint[] = [deduped[0]];

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
          return squashTinyOrthogonalSegments(result, 6);
        };

        const squashTinyOrthogonalSegments = (pathPoints: LocalPoint[], minLength: number): LocalPoint[] => {
          if (pathPoints.length <= 2) return pathPoints;
          const epsilon = 0.001;
          const working = pathPoints.map((point) => ({ ...point }));
          const output: LocalPoint[] = [working[0]];
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

          const compact: LocalPoint[] = [deduped[0]];
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
        };
        const clampAgainstSourceBacktracking = (
          point: LocalPoint,
          source: LocalPoint,
          side: PortSide,
          minForward: number
        ): LocalPoint => {
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
        };
        const clampAgainstTargetApproach = (
          point: LocalPoint,
          target: LocalPoint,
          side: PortSide,
          minForward: number
        ): LocalPoint => {
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
        };
        const routeSearchBounds = (
          start: LocalPoint,
          end: LocalPoint,
          rects: Array<{ left: number; right: number; top: number; bottom: number }>,
          step: number
        ): { minX: number; minY: number; width: number; height: number } => {
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
        };
        const routeAroundEntities = (start: LocalPoint, end: LocalPoint, clearance: number): LocalPoint[] | null => {
          const step = 10;
          const blockedRects = Array.from(points.values()).map((geom) => expandedEntityBounds(geom, clearance));
          if (!blockedRects.length) return [start, end];
          const bounds = routeSearchBounds(start, end, blockedRects, step);
          type Cell = { gx: number; gy: number };
          const toCell = (point: LocalPoint): Cell => ({
            gx: Math.round((point.x - bounds.minX) / step),
            gy: Math.round((point.y - bounds.minY) / step),
          });
          const toPoint = (cell: Cell): LocalPoint => ({
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
            return blockedRects.some((rect) => pointInsideRect(point, rect));
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
              const routed = cells.map((cell) => toPoint(cell));
              routed[0] = start;
              routed[routed.length - 1] = end;
              return normalizeOrthogonalPoints(routed);
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
        };
        const defaultOrthogonalPoints = (start: LocalPoint, end: LocalPoint, sourceSide: PortSide, targetSide: PortSide): LocalPoint[] => {
          const portStub = 24;
          const minForward = 56;
          const sourceStub = projectFromPort(start, sourceSide, portStub);
          const targetStub = projectFromPort(end, targetSide, portStub);
          const sourceSafe = projectFromPort(start, sourceSide, minForward);
          const targetSafe = projectFromPort(end, targetSide, minForward);
          const sourceHorizontal = sourceSide === 'left' || sourceSide === 'right';
          const targetHorizontal = targetSide === 'left' || targetSide === 'right';
          let middle: LocalPoint[] = [];
          if (sourceHorizontal && targetHorizontal) {
            const midX = (sourceSafe.x + targetSafe.x) / 2;
            middle = [
              { x: midX, y: sourceSafe.y },
              { x: midX, y: targetSafe.y },
            ];
          } else if (!sourceHorizontal && !targetHorizontal) {
            const midY = (sourceSafe.y + targetSafe.y) / 2;
            middle = [
              { x: sourceSafe.x, y: midY },
              { x: targetSafe.x, y: midY },
            ];
          } else if (sourceHorizontal) {
            middle = [{ x: targetSafe.x, y: sourceSafe.y }];
          } else {
            middle = [{ x: sourceSafe.x, y: targetSafe.y }];
          }
          if (middle.length) {
            middle[0] = clampAgainstSourceBacktracking(middle[0], start, sourceSide, minForward);
            const lastIndex = middle.length - 1;
            middle[lastIndex] = clampAgainstTargetApproach(middle[lastIndex], end, targetSide, minForward);
          }
          const fallbackPath = normalizeOrthogonalPoints([start, sourceStub, sourceSafe, ...middle, targetSafe, targetStub, end]);
          const obstaclePath = routeAroundEntities(sourceSafe, targetSafe, 10);
          if (!obstaclePath || obstaclePath.length < 2) {
            return fallbackPath;
          }
          return normalizeOrthogonalPoints([start, sourceStub, ...obstaclePath, targetStub, end]);
        };
        const segmentIntersection = (a1: LocalPoint, a2: LocalPoint, b1: LocalPoint, b2: LocalPoint): LocalPoint | null => {
          const d = (a2.x - a1.x) * (b2.y - b1.y) - (a2.y - a1.y) * (b2.x - b1.x);
          if (Math.abs(d) < 0.001) return null;
          const ua = ((b1.x - a1.x) * (b2.y - b1.y) - (b1.y - a1.y) * (b2.x - b1.x)) / d;
          const ub = ((b1.x - a1.x) * (a2.y - a1.y) - (b1.y - a1.y) * (a2.x - a1.x)) / d;
          if (ua < 0 || ua > 1 || ub < 0 || ub > 1) return null;
          return {
            x: a1.x + ua * (a2.x - a1.x),
            y: a1.y + ua * (a2.y - a1.y),
          };
        };
        const segmentIntersectionWithRect = (
          start: LocalPoint,
          end: LocalPoint,
          rect: { left: number; right: number; top: number; bottom: number }
        ): LocalPoint | null => {
          const intersections: LocalPoint[] = [];
          const edges: [LocalPoint, LocalPoint][] = [
            [{ x: rect.left, y: rect.top }, { x: rect.right, y: rect.top }],
            [{ x: rect.right, y: rect.top }, { x: rect.right, y: rect.bottom }],
            [{ x: rect.right, y: rect.bottom }, { x: rect.left, y: rect.bottom }],
            [{ x: rect.left, y: rect.bottom }, { x: rect.left, y: rect.top }],
          ];
          for (const [edgeStart, edgeEnd] of edges) {
            const point = segmentIntersection(start, end, edgeStart, edgeEnd);
            if (point) intersections.push(point);
          }
          if (!intersections.length) return null;
          intersections.sort((a, b) => Math.hypot(a.x - start.x, a.y - start.y) - Math.hypot(b.x - start.x, b.y - start.y));
          return intersections[0];
        };
        const ensureLastSegmentMinLength = (pathPoints: LocalPoint[], minLength: number, fallbackDirection: LocalPoint): void => {
          if (pathPoints.length < 2) return;
          const lastIndex = pathPoints.length - 1;
          const prevIndex = lastIndex - 1;
          const last = pathPoints[lastIndex];
          const prev = pathPoints[prevIndex];
          const currentLength = Math.hypot(last.x - prev.x, last.y - prev.y);
          if (currentLength >= minLength) return;
          const norm = normalizeVector({ x: prev.x - last.x, y: prev.y - last.y }) ?? fallbackDirection;
          pathPoints[prevIndex] = {
            x: last.x + norm.x * minLength,
            y: last.y + norm.y * minLength,
          };
        };
        const applyEndpointRules = (
          pathPoints: LocalPoint[],
          targetBounds: { left: number; right: number; top: number; bottom: number },
          endingMode: VisualSchemaModel['relations'][number]['endingMode']
        ): LocalPoint[] => {
          if (pathPoints.length < 2) return pathPoints;
          const basePoints = [...pathPoints];
          const prev = basePoints[basePoints.length - 2];
          const rawEnd = basePoints[basePoints.length - 1];
          const impact = segmentIntersectionWithRect(prev, rawEnd, targetBounds) ?? rawEnd;
          const dir = normalizeVector({ x: impact.x - prev.x, y: impact.y - prev.y }) ?? { x: 1, y: 0 };
          const tipInset = endingMode === 'edge' ? 0 : endingMode === 'offset-edge' ? 4 : 8;
          const arrowLength = 9;
          const tip = { x: impact.x - dir.x * tipInset, y: impact.y - dir.y * tipInset };
          const lineEnd = { x: tip.x - dir.x * arrowLength, y: tip.y - dir.y * arrowLength };
          basePoints[basePoints.length - 1] = lineEnd;
          ensureLastSegmentMinLength(basePoints, 14, dir);
          return basePoints;
        };
        const pathFromPoints = (pathPoints: Array<{ x: number; y: number }>): string => {
          if (!pathPoints.length) return '';
          let d = `M ${pathPoints[0].x} ${pathPoints[0].y}`;
          for (let index = 1; index < pathPoints.length; index += 1) {
            d += ` L ${pathPoints[index].x} ${pathPoints[index].y}`;
          }
          return d;
        };

        for (const relation of value.schema.relations.slice(0, 24)) {
          const from = points.get(relation.fromEntityId);
          const to = points.get(relation.toEntityId);
          if (!from || !to) continue;
          const fromSide = resolvePortSide(relation, 'from', from, to);
          const toSide = resolvePortSide(relation, 'to', to, from);
          const safePadding = 10;
          const start = portPoint(relation.fromEntityId, relation.fromFieldId, fromSide, safePadding, from);
          const endHint = portPoint(relation.toEntityId, relation.toFieldId, toSide, safePadding, to);
          const targetBounds = expandedEntityBounds(to, safePadding);
          const mappedBendPoints = relation.bendPoints.map((point) => ({
            x: point.x - rootPosition.x + rootPaddingX,
            y: point.y - rootPosition.y + rootPaddingY,
          }));
          const rawPoints = mappedBendPoints.length
            ? normalizeOrthogonalPoints([start, ...mappedBendPoints, endHint])
            : normalizeOrthogonalPoints(defaultOrthogonalPoints(start, endHint, fromSide, toSide));
          const linePoints = applyEndpointRules(rawPoints, targetBounds, relation.endingMode);
          const d = pathFromPoints(linePoints);
          const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          line.setAttribute('d', d);
          line.setAttribute('fill', 'none');
          line.setAttribute('stroke', relation.style.color || 'var(--schema-card-relation, #7f8fb8)');
          line.setAttribute('stroke-width', '1.4');
          line.setAttribute('stroke-opacity', '0.86');
          line.setAttribute('marker-end', `url(#${arrowMarkerId})`);
          (line.style as CSSStyleDeclaration).color = relation.style.color || 'var(--schema-card-relation, #7f8fb8)';
          relationsLayer.append(line);
        }

        for (const entity of entities) {
          const card = document.createElement('article');
          card.className = 'database-schema-card__entity';
          applyEntityPaletteStyles(card, entity);
          const point = points.get(entity.id);
          if (point) {
            card.style.left = `${point.x}px`;
            card.style.top = `${point.y}px`;
            card.style.width = `${point.w}px`;
            card.style.height = `${point.h}px`;
          }

          const header = document.createElement('header');
          header.className = 'database-schema-card__entity-header';
          header.textContent = entity.name;
          card.append(header);

          const fields = document.createElement('ul');
          fields.className = 'database-schema-card__entity-fields';
          for (const field of entity.fields.slice(0, 4)) {
            const line = document.createElement('li');
            line.textContent = schemaFieldViewText(entity.id, field, foreignKeyTargets);
            const token = normalizeSchemaColorToken(field.colorToken);
            if (token !== 'default') {
              line.style.background = `var(--schema-palette-${token}-field-bg)`;
            }
            fields.append(line);
          }
          card.append(fields);

          entitiesLayer.append(card);
        }
        applyTransform();
      };

      const applyNodeState = (nextNode: typeof node): void => {
        currentNode = nextNode;
        const normalized = normalizeDatabaseSchemaAttrs(nextNode.attrs as DatabaseSchemaAttrs);
        title.textContent = normalized.title;
        openEditorButton.disabled = !editor.isEditable;
        openEditorButton.title = editor.isEditable ? 'Расширить схему' : 'Откройте note в режиме редактирования';
        renderEntities(normalized);
      };

      const onPointerMove = (event: PointerEvent): void => {
        if (!panState || panState.pointerId !== event.pointerId) return;
        event.preventDefault();
        panX = panState.originX + (event.clientX - panState.startX);
        panY = panState.originY + (event.clientY - panState.startY);
        applyTransform();
      };

      const onPointerUp = (event: PointerEvent): void => {
        if (!panState || panState.pointerId !== event.pointerId) return;
        if (panSurface.hasPointerCapture(event.pointerId)) {
          panSurface.releasePointerCapture(event.pointerId);
        }
        panState = null;
        frame.classList.remove('database-schema-card__canvas-frame--panning');
      };

      const startPan = (event: PointerEvent): void => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        panState = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          originX: panX,
          originY: panY,
        };
        frame.classList.add('database-schema-card__canvas-frame--panning');
        panSurface.setPointerCapture(event.pointerId);
        selectNode();
      };
      panSurface.addEventListener('pointerdown', startPan);
      panSurface.addEventListener('pointermove', onPointerMove);
      panSurface.addEventListener('pointerup', onPointerUp);
      panSurface.addEventListener('pointercancel', onPointerUp);

      frame.addEventListener('wheel', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const delta = event.deltaY < 0 ? 0.1 : -0.1;
        zoom = clamp(Number((zoom + delta).toFixed(2)), 0.5, 2.4);
        applyTransform();
      });

      openEditorButton.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!editor.isEditable) return;
        selectNode();
        openSchemaEditor('edit');
      });

      recalcFrame();
      applyNodeState(currentNode);
      return {
        dom: wrapper,
        update(nextNode) {
          if (nextNode.type.name !== DATABASE_SCHEMA_NODE) return false;
          recalcFrame();
          applyNodeState(nextNode);
          return true;
        },
        destroy() {
          panSurface.removeEventListener('pointermove', onPointerMove);
          panSurface.removeEventListener('pointerup', onPointerUp);
          panSurface.removeEventListener('pointercancel', onPointerUp);
        },
      };
    };
  },
});

const RichCodeBlock = CodeBlockLowlight.extend({
  addProseMirrorPlugins() {
    const parentPlugins = this.parent?.() ?? [];
    const bracketDepthPlugin = new Plugin<DecorationSet>({
      key: BRACKET_DEPTH_PLUGIN_KEY,
      state: {
        init: (_, state) => buildCodeDecorations(state.doc),
        apply: (transaction, decorationSet, _oldState, newState) =>
          transaction.docChanged ? buildCodeDecorations(newState.doc) : decorationSet,
      },
      props: {
        decorations: (state) => BRACKET_DEPTH_PLUGIN_KEY.getState(state),
      },
    });
    return [...parentPlugins, bracketDepthPlugin];
  },
  addAttributes() {
    return {
      ...this.parent?.(),
      language: {
        default: 'plaintext',
        parseHTML: (element) =>
          element.getAttribute('data-language') ??
          element.querySelector('code')?.getAttribute('data-language') ??
          'plaintext',
        renderHTML: (attributes) => ({
          'data-language':
            typeof attributes['language'] === 'string' ? attributes['language'] : 'plaintext',
        }),
      },
    };
  },
  addNodeView() {
    return ({ node, editor, getPos }) => {
      let currentNode = node;
      const wrapper = document.createElement('div');
      wrapper.className = 'rich-code-block';

      const header = document.createElement('div');
      header.className = 'rich-code-block__header';

      const languageControl = document.createElement('label');
      languageControl.className = 'rich-code-block__language';

      const languageLabel = document.createElement('span');
      languageLabel.className = 'rich-code-block__language-label';
      languageLabel.textContent = 'Code';
      const languageName = document.createElement('span');
      languageName.className = 'rich-code-block__language-name';

      const languageSelect = document.createElement('select');
      languageSelect.className = 'rich-code-block__language-select';
      for (const language of CODE_LANGUAGES) {
        const option = document.createElement('option');
        option.value = language;
        option.textContent = language;
        languageSelect.append(option);
      }
      languageControl.append(languageLabel, languageName, languageSelect);

      const copyButton = document.createElement('button');
      copyButton.type = 'button';
      copyButton.className = 'rich-code-block__copy';
      copyButton.textContent = 'Copy';

      const pre = document.createElement('pre');
      pre.className = 'hljs';
      const code = document.createElement('code');
      pre.append(code);

      const copyCodeText = async (): Promise<void> => {
        const text = currentNode.textContent ?? '';
        if (!text.trim()) {
          copyButton.textContent = 'Empty';
          window.setTimeout(() => {
            copyButton.textContent = 'Copy';
          }, 900);
          return;
        }
        try {
          await navigator.clipboard.writeText(text);
          copyButton.textContent = 'Copied';
        } catch {
          const textarea = document.createElement('textarea');
          textarea.value = text;
          textarea.setAttribute('readonly', 'true');
          textarea.style.position = 'fixed';
          textarea.style.opacity = '0';
          document.body.append(textarea);
          textarea.select();
          document.execCommand('copy');
          textarea.remove();
          copyButton.textContent = 'Copied';
        }
        window.setTimeout(() => {
          copyButton.textContent = 'Copy';
        }, 900);
      };

      const updateLanguageClass = (language: string): void => {
        code.className = '';
        code.classList.add(`language-${language}`);
      };

      const applyNodeState = (nextNode: typeof node): void => {
        currentNode = nextNode;
        const language = normalizeCodeLanguage(nextNode.attrs['language']);
        languageSelect.value = language;
        languageName.textContent = language;
        updateLanguageClass(language);
      };

      const updateLanguage = (language: string): void => {
        if (!editor.isEditable || typeof getPos !== 'function') return;
        const position = getPos();
        if (typeof position !== 'number') return;
        const attrs = {
          ...currentNode.attrs,
          language: normalizeCodeLanguage(language),
        };
        const transaction = editor.state.tr.setNodeMarkup(position, undefined, attrs);
        editor.view.dispatch(transaction);
      };

      header.addEventListener('mousedown', (event) => {
        const target = event.target;
        if (target instanceof Element && target.closest('select, button')) {
          return;
        }
        event.preventDefault();
      });
      languageSelect.addEventListener('change', () => {
        updateLanguage(languageSelect.value);
      });
      copyButton.addEventListener('click', () => {
        void copyCodeText();
      });

      header.append(languageControl, copyButton);
      wrapper.append(header, pre);
      applyNodeState(currentNode);

      return {
        dom: wrapper,
        contentDOM: code,
        update(updatedNode) {
          if (updatedNode.type !== currentNode.type) return false;
          applyNodeState(updatedNode);
          return true;
        },
      };
    };
  },
  renderHTML({ node, HTMLAttributes }) {
    const language = normalizeCodeLanguage(node.attrs['language']);
    return [
      'pre',
      mergeAttributes(HTMLAttributes, { 'data-language': language }),
      ['code', { class: `language-${language}`, 'data-language': language }, 0],
    ];
  },
});

function buildCodeDecorations(doc: ProseMirrorNode): DecorationSet {
  const decorations: Decoration[] = [];
  doc.descendants((node: ProseMirrorNode, position: number) => {
    if (node.type.name !== 'codeBlock') return;
    const codeText = node.textContent ?? '';
    const language = normalizeCodeLanguage(node.attrs['language']);
    const baseIdentifierRegex = /\b[A-Za-z_$][\w$]*(?=(?:\s*\[[^\]\n]+\])?\s*(?:(?:\?\.|\.)[A-Za-z_$][\w$]*)+)/g;
    for (const match of codeText.matchAll(baseIdentifierRegex)) {
      if (typeof match.index !== 'number') continue;
      const from = position + 1 + match.index;
      const value = match[0] ?? '';
      if (!value) continue;
      decorations.push(
        Decoration.inline(from, from + value.length, {
          class: 'code-member-base',
        })
      );
    }
    const memberPropertyRegex = /(?:\?\.|\.)([A-Za-z_$][\w$]*)/g;
    for (const match of codeText.matchAll(memberPropertyRegex)) {
      if (typeof match.index !== 'number') continue;
      const dotFrom = position + 1 + match.index;
      const accessorToken = match[0].startsWith('?.') ? '?.' : '.';
      decorations.push(
        Decoration.inline(dotFrom, dotFrom + accessorToken.length, {
          class: 'code-member-dot',
        })
      );
      const prop = match[1] ?? '';
      if (!prop) continue;
      decorations.push(
        Decoration.inline(
          dotFrom + accessorToken.length,
          dotFrom + accessorToken.length + prop.length,
          {
          class: 'code-member-property',
          }
        )
      );
    }
    const indexedPropertyRegex = /\.([A-Za-z_$][\w$]*)\s*\[(.+?)\]/g;
    for (const match of codeText.matchAll(indexedPropertyRegex)) {
      if (typeof match.index !== 'number') continue;
      const property = match[1] ?? '';
      const indexExpression = match[2] ?? '';
      if (!property) continue;
      const full = match[0] ?? '';
      const dotAbsolute = position + 1 + match.index;
      const propertyAbsolute = dotAbsolute + 1;
      const openingBracketInMatch = full.indexOf('[');
      if (openingBracketInMatch < 0) continue;
      const openingBracketAbsolute = dotAbsolute + openingBracketInMatch;
      const closingBracketAbsolute = openingBracketAbsolute + 1 + indexExpression.length;
      decorations.push(
        Decoration.inline(propertyAbsolute, propertyAbsolute + property.length, {
          class: 'code-indexed-property',
        })
      );
      decorations.push(
        Decoration.inline(openingBracketAbsolute, openingBracketAbsolute + 1, {
          class: 'code-index-bracket',
        })
      );
      decorations.push(
        Decoration.inline(closingBracketAbsolute, closingBracketAbsolute + 1, {
          class: 'code-index-bracket',
        })
      );
      if (indexExpression.length) {
        decorations.push(
          Decoration.inline(openingBracketAbsolute + 1, openingBracketAbsolute + 1 + indexExpression.length, {
            class: 'code-index-expression',
          })
        );
      }
    }
    const declarationKeywordRegex = /\b(let|const)\b/g;
    for (const match of codeText.matchAll(declarationKeywordRegex)) {
      if (typeof match.index !== 'number') continue;
      const keyword = match[1];
      if (!keyword) continue;
      const from = position + 1 + match.index;
      decorations.push(
        Decoration.inline(from, from + keyword.length, {
          class: keyword === 'const' ? 'code-keyword-const' : 'code-keyword-let',
        })
      );
    }
    const declarationVariableRegex = /\b(?:let|const|var)\s+([A-Za-z_$][\w$]*)/g;
    for (const match of codeText.matchAll(declarationVariableRegex)) {
      if (typeof match.index !== 'number') continue;
      const variableName = match[1];
      if (!variableName) continue;
      const variableOffsetInMatch = match[0].lastIndexOf(variableName);
      if (variableOffsetInMatch < 0) continue;
      const from = position + 1 + match.index + variableOffsetInMatch;
      decorations.push(
        Decoration.inline(from, from + variableName.length, {
          class: 'code-declaration-variable',
        })
      );
    }
    if (language === 'css') {
      const cssValueWordRegex = /:\s*([A-Za-z-]+)/g;
      for (const match of codeText.matchAll(cssValueWordRegex)) {
        if (typeof match.index !== 'number') continue;
        const valueWord = match[1];
        if (!valueWord) continue;
        const valueOffsetInMatch = match[0].lastIndexOf(valueWord);
        if (valueOffsetInMatch < 0) continue;
        const from = position + 1 + match.index + valueOffsetInMatch;
        decorations.push(
          Decoration.inline(from, from + valueWord.length, {
            class: 'code-css-value-word',
          })
        );
      }
    }
    const stack: Array<{ bracket: string; depth: 1 | 2 | 3 }> = [];
    node.descendants((child: ProseMirrorNode, childPos: number) => {
      if (!child.isText || typeof child.text !== 'string') return;
      const text = child.text;
      for (let index = 0; index < text.length; index += 1) {
        const char = text[index];
        const from = position + 1 + childPos + index;
        if (BRACKET_OPEN_TO_CLOSE[char]) {
          const depth = ((stack.length % 3) + 1) as 1 | 2 | 3;
          stack.push({ bracket: char, depth });
          decorations.push(
            Decoration.inline(from, from + 1, {
              class: `code-bracket-depth-${depth}`,
            })
          );
          continue;
        }
        const expectedOpen = BRACKET_CLOSE_TO_OPEN[char];
        if (!expectedOpen || !stack.length) continue;
        const last = stack[stack.length - 1];
        if (last.bracket !== expectedOpen) continue;
        stack.pop();
        decorations.push(
          Decoration.inline(from, from + 1, {
            class: `code-bracket-depth-${last.depth}`,
          })
        );
      }
    });
  });
  return DecorationSet.create(doc, decorations);
}

@Component({
  selector: 'app-unified-note-editor',
  standalone: true,
  imports: [CommonModule, DatabaseSchemaEditorComponent],
  template: `
    <div class="unified-note-editor-shell">
      <div class="note-editor-topbar">
        <div class="note-header-top-shell">
          <div class="note-header-top">
            @if (statusMessage(); as message) {
              <span
                class="note-updated"
                [class.note-updated--warning]="hasUnsavedChanges()"
                [class.note-updated--error]="!!saveError()"
              >
                {{ message }}
              </span>
            }

            <div class="note-active-users-wrap">
              <button
                type="button"
                class="note-active-users"
                [class.note-active-users--open]="activeUsersOpen()"
                [attr.aria-expanded]="activeUsersOpen()"
                aria-label="Open active users"
                aria-haspopup="dialog"
                (click)="toggleActiveUsers()"
              >
                <span class="note-active-users__avatars">
                  @for (user of visibleActiveUsers(); track user.id) {
                    <span
                      class="note-active-users__avatar"
                      [style.background]="user.avatarColor || '#8f9ab3'"
                      [attr.aria-label]="user.label"
                      [attr.data-tooltip]="user.label + ' - ' + user.activity"
                    >
                      {{ user.initials }}
                    </span>
                  }
                  @if (hiddenActiveUsersCount()) {
                    <span class="note-active-users__more">+{{ hiddenActiveUsersCount() }}</span>
                  }
                </span>
              </button>

              @if (activeUsersOpen()) {
                <section class="note-active-users-popover" role="dialog" aria-label="Active users">
                  <div class="note-active-users-popover__list">
                    @for (user of activeUsers(); track user.id) {
                      <div class="note-active-users-popover__item">
                        <span
                          class="note-active-users-popover__avatar"
                          [style.background]="user.avatarColor || '#8f9ab3'"
                        >
                          {{ user.initials }}
                        </span>
                        <div class="note-active-users-popover__text">
                          <span class="note-active-users-popover__name">{{ user.label }}</span>
                          <span class="note-active-users-popover__meta">{{ user.email || 'No email' }}</span>
                        </div>
                        <span
                          class="note-active-users-popover__status"
                          [class.note-active-users-popover__status--editing]="user.activity === 'Editing'"
                          [class.note-active-users-popover__status--viewing]="user.activity === 'Viewing'"
                        >
                          {{ user.activity }}
                        </span>
                      </div>
                    }
                  </div>
                </section>
              }
            </div>

            @if (canEdit()) {
              <div class="note-edit-actions">
                @if (isEditing()) {
                  <button
                    type="button"
                    class="note-edit-toggle note-edit-toggle--secondary"
                    [disabled]="isSaving()"
                    (click)="cancelEditing()"
                  >
                    <span>Cancel</span>
                  </button>
                  <button
                    type="button"
                    class="note-edit-toggle note-edit-toggle--primary"
                    [disabled]="isSaving()"
                    (click)="updateEditing()"
                  >
                    <span>{{ isSaving() ? 'Updating...' : 'Update' }}</span>
                  </button>
                } @else {
                  <button
                    type="button"
                    class="note-edit-toggle"
                    (click)="toggleEditing()"
                  >
                    <span class="note-edit-toggle__icon" aria-hidden="true">
                      <svg viewBox="0 0 640 640" focusable="false">
                        <path d="M505 122.9L517.1 135C526.5 144.4 526.5 159.6 517.1 168.9L488 198.1L441.9 152L471 122.9C480.4 113.5 495.6 113.5 504.9 122.9zM273.8 320.2L408 185.9L454.1 232L319.8 366.2C316.9 369.1 313.3 371.2 309.4 372.3L250.9 389L267.6 330.5C268.7 326.6 270.8 323 273.7 320.1zM437.1 89L239.8 286.2C231.1 294.9 224.8 305.6 221.5 317.3L192.9 417.3C190.5 425.7 192.8 434.7 199 440.9C205.2 447.1 214.2 449.4 222.6 447L322.6 418.4C334.4 415 345.1 408.7 353.7 400.1L551 202.9C579.1 174.8 579.1 129.2 551 101.1L538.9 89C510.8 60.9 465.2 60.9 437.1 89zM152 128C103.4 128 64 167.4 64 216L64 488C64 536.6 103.4 576 152 576L424 576C472.6 576 512 536.6 512 488L512 376C512 362.7 501.3 352 488 352C474.7 352 464 362.7 464 376L464 488C464 510.1 446.1 528 424 528L152 528C129.9 528 112 510.1 112 488L112 216C112 193.9 129.9 176 152 176L264 176C277.3 176 288 165.3 288 152C288 138.7 277.3 128 264 128L152 128z"/>
                      </svg>
                    </span>
                    <span>Edit</span>
                  </button>
                }
              </div>
            }
          </div>
        </div>

        @if (toolbarVisible()) {
        <section
          class="editor-toolbar"
          role="toolbar"
          aria-label="Note formatting toolbar"
          (pointerdown)="preserveToolbarSelection($event)"
          (mousedown)="preserveToolbarSelection($event)"
          (click)="onToolbarClick($event)"
        >
          <div class="editor-toolbar__group">
            <div class="toolbar-anchor">
              <button
                type="button"
                class="toolbar-btn toolbar-btn--label toolbar-btn--with-caret"
                [class.toolbar-btn--active]="headingMenuOpen() || headingValue() !== 'paragraph'"
                [attr.title]="buttonTitle(currentHeadingLabel(), 'Mod+Alt+0..6', '🔠')"
                (pointerdown)="preserveToolbarSelection($event)"
                (mousedown)="preserveToolbarSelection($event)"
                (click)="toggleHeadingMenu()"
              >
                <span class="toolbar-heading-glyph" aria-hidden="true">
                  @if (activeHeadingLevel(); as level) {
                    <span>H</span>
                    <sub>{{ level }}</sub>
                  } @else {
                    <span>T</span>
                  }
                </span>
                <span>{{ currentHeadingLabel() }}</span>
                <span class="toolbar-caret" aria-hidden="true">
                  <svg class="toolbar-svg" [attr.viewBox]="toolbarIcons.chevronDown.viewBox" focusable="false">
                    @for (path of toolbarIcons.chevronDown.paths; track path) {
                      <path [attr.d]="path"></path>
                    }
                  </svg>
                </span>
              </button>

              @if (headingMenuOpen()) {
                <div class="toolbar-popover toolbar-popover--menu">
                  @for (option of headingOptions; track option.value) {
                    <button
                      type="button"
                      class="toolbar-menu-item toolbar-menu-item--heading"
                      [class.toolbar-menu-item--active]="headingValue() === option.value"
                      [class.toolbar-menu-item--heading-1]="option.level === 1"
                      [class.toolbar-menu-item--heading-2]="option.level === 2"
                      [class.toolbar-menu-item--heading-3]="option.level === 3"
                      [class.toolbar-menu-item--heading-4]="option.level === 4"
                      [class.toolbar-menu-item--heading-5]="option.level === 5"
                      [class.toolbar-menu-item--heading-6]="option.level === 6"
                      (click)="applyHeadingOption(option.value)"
                    >
                      <span class="toolbar-heading-glyph toolbar-heading-glyph--menu" aria-hidden="true">
                        <span>{{ option.level ? 'H' : 'T' }}</span>
                        @if (option.level) {
                          <sub>{{ option.level }}</sub>
                        }
                      </span>
                      <span>{{ option.label }}</span>
                      @if (option.shortcut) {
                        <span class="toolbar-menu-shortcut">{{ displayShortcut(option.shortcut) }}</span>
                      }
                    </button>
                  }
                </div>
              }
            </div>
          </div>

          <span class="editor-toolbar__divider" aria-hidden="true"></span>

          <div class="editor-toolbar__group">
            <button
              type="button"
              class="toolbar-btn toolbar-btn--icon"
              [class.toolbar-btn--active]="isMarkActive('bold')"
              [attr.title]="buttonTitle('Bold', 'Mod+B', '🅱️')"
              (click)="toggleBold()"
            >
              <span class="toolbar-glyph toolbar-glyph--bold" aria-hidden="true">B</span>
            </button>
            <button
              type="button"
              class="toolbar-btn toolbar-btn--icon"
              [class.toolbar-btn--active]="isMarkActive('italic')"
              [attr.title]="buttonTitle('Italic', 'Mod+I', '🖋️')"
              (click)="toggleItalic()"
            >
              <span class="toolbar-glyph toolbar-glyph--italic" aria-hidden="true">I</span>
            </button>

            <div class="toolbar-anchor">
              <button
                type="button"
                class="toolbar-btn toolbar-btn--icon toolbar-btn--with-caret"
                [class.toolbar-btn--active]="formatMenuOpen() || hasAdvancedFormatActive()"
                [attr.title]="buttonTitle('Underline and more', 'Mod+U', '✨')"
                (pointerdown)="preserveToolbarSelection($event)"
                (mousedown)="preserveToolbarSelection($event)"
                (click)="toggleFormatMenu()"
              >
                <span class="toolbar-glyph toolbar-glyph--underline" aria-hidden="true">U</span>
                <span class="toolbar-caret" aria-hidden="true">
                  <svg class="toolbar-svg" [attr.viewBox]="toolbarIcons.chevronDown.viewBox" focusable="false">
                    @for (path of toolbarIcons.chevronDown.paths; track path) {
                      <path [attr.d]="path"></path>
                    }
                  </svg>
                </span>
              </button>

              @if (formatMenuOpen()) {
                <div class="toolbar-popover toolbar-popover--menu">
                  @for (item of formatMenuItems; track item.action) {
                    <button
                      type="button"
                      class="toolbar-menu-item"
                      [class.toolbar-menu-item--active]="isFormatActionActive(item.action)"
                      (click)="runFormatAction(item.action)"
                    >
                      <span class="toolbar-glyph" [ngClass]="item.modifierClass" aria-hidden="true">
                        {{ item.glyph }}
                      </span>
                      <span>{{ item.label }}</span>
                      @if (item.shortcut) {
                        <span class="toolbar-menu-shortcut">{{ displayShortcut(item.shortcut) }}</span>
                      }
                    </button>
                  }
                </div>
              }
            </div>
          </div>

          <span class="editor-toolbar__divider" aria-hidden="true"></span>

          <div class="editor-toolbar__group">
            <button
              type="button"
              class="toolbar-btn toolbar-btn--icon"
              [class.toolbar-btn--active]="isNodeActive('orderedList')"
              [attr.title]="buttonTitle('Numbered list', 'Mod+Shift+7', '🔢')"
              (click)="toggleOrderedList()"
            >
              <span class="toolbar-icon" aria-hidden="true">
                <svg class="toolbar-svg" [attr.viewBox]="toolbarIcons.listOrdered.viewBox" focusable="false">
                  @for (path of toolbarIcons.listOrdered.paths; track path) {
                    <path [attr.d]="path"></path>
                  }
                </svg>
              </span>
            </button>
            <button
              type="button"
              class="toolbar-btn toolbar-btn--icon"
              [class.toolbar-btn--active]="isNodeActive('bulletList')"
              [attr.title]="buttonTitle('Bulleted list', 'Mod+Shift+8', '•')"
              (click)="toggleBulletList()"
            >
              <span class="toolbar-icon" aria-hidden="true">
                <svg class="toolbar-svg" [attr.viewBox]="toolbarIcons.listBullet.viewBox" focusable="false">
                  @for (path of toolbarIcons.listBullet.paths; track path) {
                    <path [attr.d]="path"></path>
                  }
                </svg>
              </span>
            </button>
          </div>

          <span class="editor-toolbar__divider" aria-hidden="true"></span>

          <div class="editor-toolbar__group">
            <div class="toolbar-anchor">
              <button
                type="button"
                class="toolbar-btn toolbar-btn--icon toolbar-btn--with-caret"
                [class.toolbar-btn--active]="alignMenuOpen() || isTextAligned()"
                [attr.title]="buttonTitle('Alignment', 'Mod+Alt+L/C/R/J', '📐')"
                (pointerdown)="preserveToolbarSelection($event)"
                (mousedown)="preserveToolbarSelection($event)"
                (click)="toggleAlignMenu()"
              >
                <span class="toolbar-icon" aria-hidden="true">
                  <svg class="toolbar-svg" [attr.viewBox]="toolbarIcons[currentAlignOption().icon].viewBox" focusable="false">
                    @for (path of toolbarIcons[currentAlignOption().icon].paths; track path) {
                      <path [attr.d]="path"></path>
                    }
                  </svg>
                </span>
                <span class="toolbar-caret" aria-hidden="true">
                  <svg class="toolbar-svg" [attr.viewBox]="toolbarIcons.chevronDown.viewBox" focusable="false">
                    @for (path of toolbarIcons.chevronDown.paths; track path) {
                      <path [attr.d]="path"></path>
                    }
                  </svg>
                </span>
              </button>

              @if (alignMenuOpen()) {
                <div class="toolbar-popover toolbar-popover--menu">
                  @for (option of alignOptions; track option.value) {
                    <button
                      type="button"
                      class="toolbar-menu-item"
                      [class.toolbar-menu-item--active]="isTextAlignActive(option.value)"
                      (click)="applyTextAlign(option.value)"
                    >
                      <span class="toolbar-icon" aria-hidden="true">
                        <svg class="toolbar-svg" [attr.viewBox]="toolbarIcons[option.icon].viewBox" focusable="false">
                          @for (path of toolbarIcons[option.icon].paths; track path) {
                            <path [attr.d]="path"></path>
                          }
                        </svg>
                      </span>
                      <span>{{ option.label }}</span>
                      @if (option.shortcut) {
                        <span class="toolbar-menu-shortcut">{{ displayShortcut(option.shortcut) }}</span>
                      }
                    </button>
                  }
                </div>
              }
            </div>
          </div>

          <span class="editor-toolbar__divider" aria-hidden="true"></span>

          <div class="editor-toolbar__group">
            <div class="toolbar-anchor">
              <button
                type="button"
                class="toolbar-btn toolbar-btn--icon toolbar-btn--with-caret"
                [class.toolbar-btn--active]="colorMenuOpen() || hasActiveColors()"
                [attr.title]="buttonTitle('Text color and highlight', undefined, '🎨')"
                (pointerdown)="preserveToolbarSelection($event)"
                (mousedown)="preserveToolbarSelection($event)"
                (click)="toggleColorMenu()"
              >
                <span class="toolbar-color-icon" aria-hidden="true">
                  <span class="toolbar-color-icon__letter">A</span>
                  <span class="toolbar-color-icon__underline" [style.background]="activeTextColor() || '#111827'"></span>
                </span>
                <span class="toolbar-caret" aria-hidden="true">
                  <svg class="toolbar-svg" [attr.viewBox]="toolbarIcons.chevronDown.viewBox" focusable="false">
                    @for (path of toolbarIcons.chevronDown.paths; track path) {
                      <path [attr.d]="path"></path>
                    }
                  </svg>
                </span>
              </button>

              @if (colorMenuOpen()) {
                <div class="toolbar-popover toolbar-popover--palette">
                  <div class="toolbar-popover__section">
                    <div class="toolbar-popover__row">
                      <div class="toolbar-popover__title">Text color</div>
                      <button type="button" class="palette-clear palette-clear--inline" (click)="clearTextColor()">
                        Default ({{ displayShortcut('Mod+Alt+X') }})
                      </button>
                    </div>
                    <div class="palette-grid">
                      @for (color of textColors; track color) {
                        <button
                          type="button"
                          class="palette-swatch"
                          [class.palette-swatch--active]="activeTextColor() === color"
                          [style.background]="color"
                          [attr.aria-label]="color"
                          (click)="setTextColor(color)"
                        ></button>
                      }
                    </div>
                  </div>

                  <div class="toolbar-popover__section toolbar-popover__section--bordered">
                    <div class="toolbar-popover__row">
                      <div class="toolbar-popover__title">Highlight</div>
                      <button type="button" class="palette-clear palette-clear--inline" (click)="clearHighlight()">
                        Clear ({{ displayShortcut('Mod+Alt+H') }})
                      </button>
                    </div>
                    <div class="palette-grid palette-grid--highlight">
                      @for (color of highlightColors; track color) {
                        <button
                          type="button"
                          class="palette-swatch"
                          [class.palette-swatch--active]="activeHighlightColor() === color"
                          [style.background]="color"
                          [attr.aria-label]="color"
                          (click)="setHighlight(color)"
                        ></button>
                      }
                    </div>
                  </div>
                </div>
              }
            </div>
          </div>

          <span class="editor-toolbar__divider" aria-hidden="true"></span>

          <div class="editor-toolbar__group">
            <button
              type="button"
              class="toolbar-btn toolbar-btn--icon"
              [attr.title]="buttonTitle('Insert image', 'Mod+Shift+I', '🖼️')"
              (click)="insertImageByUrl()"
            >
              <span class="toolbar-icon" aria-hidden="true">
                <svg class="toolbar-svg toolbar-svg--filled" [attr.viewBox]="toolbarIcons.image.viewBox" focusable="false">
                  @for (path of toolbarIcons.image.paths; track path) {
                    <path [attr.d]="path"></path>
                  }
                </svg>
              </span>
            </button>

            <div class="toolbar-anchor">
              <button
                type="button"
                class="toolbar-btn toolbar-btn--icon"
                [class.toolbar-btn--active]="tableMenuOpen()"
                [attr.title]="buttonTitle('Insert table', 'Mod+Alt+T', '📊')"
                (pointerdown)="preserveToolbarSelection($event)"
                (mousedown)="preserveToolbarSelection($event)"
                (click)="toggleTableMenu()"
              >
                <span class="toolbar-icon" aria-hidden="true">
                  <svg class="toolbar-svg" [attr.viewBox]="toolbarIcons.table.viewBox" focusable="false">
                    @for (path of toolbarIcons.table.paths; track path) {
                      <path [attr.d]="path"></path>
                    }
                  </svg>
                </span>
              </button>

              @if (tableMenuOpen()) {
                <div class="toolbar-popover">
                  <div class="table-picker-label">{{ tablePreviewLabel() }}</div>
                  <div class="table-picker-grid" (mouseleave)="clearTablePreview()">
                    @for (row of tableSizes; track row) {
                      @for (col of tableSizes; track col) {
                        <button
                          type="button"
                          class="table-picker-cell"
                          [class.table-picker-cell--active]="isTableCellActive(row, col)"
                          (mouseenter)="previewTableSize(row, col)"
                          (click)="insertTable(row, col)"
                        ></button>
                      }
                    }
                  </div>
                </div>
              }
            </div>

            <div class="toolbar-anchor">
              <button
                type="button"
                class="toolbar-btn toolbar-btn--icon"
                [class.toolbar-btn--active]="plusMenuOpen()"
                [attr.title]="buttonTitle('More insert actions', undefined, '➕')"
                (pointerdown)="preserveToolbarSelection($event)"
                (mousedown)="preserveToolbarSelection($event)"
                (click)="togglePlusMenu()"
              >
                <span class="toolbar-icon" aria-hidden="true">
                  <svg class="toolbar-svg" [attr.viewBox]="toolbarIcons.plus.viewBox" focusable="false">
                    @for (path of toolbarIcons.plus.paths; track path) {
                      <path [attr.d]="path"></path>
                    }
                  </svg>
                </span>
              </button>

              @if (plusMenuOpen()) {
                <div class="toolbar-popover toolbar-popover--menu">
                  <button type="button" class="toolbar-menu-item" (click)="insertDatabaseSchema()">
                    {{ databaseSchemaMenuLabel() }}
                  </button>
                  <div class="toolbar-menu-heading">Code block</div>
                  <div class="toolbar-menu-heading toolbar-menu-heading--hint">Tip: /code or /code ts</div>
                  @for (language of codeLanguages; track language) {
                    <button type="button" class="toolbar-menu-item" (click)="insertCodeBlock(language)">
                      {{ language }}
                    </button>
                  }
                </div>
              }
            </div>
          </div>

          <span class="editor-toolbar__divider" aria-hidden="true"></span>

          <div class="editor-toolbar__group">
            <button
              type="button"
              class="toolbar-btn toolbar-btn--icon"
              [class.toolbar-btn--active]="isMarkActive('link')"
              [attr.title]="buttonTitle('Insert link', 'Mod+K', '🔗')"
              (pointerdown)="preserveToolbarSelection($event)"
              (mousedown)="preserveToolbarSelection($event)"
              (click)="insertLink()"
            >
              <span class="toolbar-icon" aria-hidden="true">
                <svg class="toolbar-svg toolbar-svg--filled" [attr.viewBox]="toolbarIcons.link.viewBox" focusable="false">
                  @for (path of toolbarIcons.link.paths; track path) {
                    <path [attr.d]="path"></path>
                  }
                </svg>
              </span>
            </button>
            <button
              type="button"
              class="toolbar-btn toolbar-btn--icon"
              [disabled]="!canUndo()"
              [attr.title]="buttonTitle('Undo', 'Mod+Z', '↩️')"
              (click)="undo()"
            >
              <span class="toolbar-icon" aria-hidden="true">
                <svg class="toolbar-svg" [attr.viewBox]="toolbarIcons.undo.viewBox" focusable="false">
                  @for (path of toolbarIcons.undo.paths; track path) {
                    <path [attr.d]="path"></path>
                  }
                </svg>
              </span>
            </button>
            <button
              type="button"
              class="toolbar-btn toolbar-btn--icon"
              [disabled]="!canRedo()"
              [attr.title]="buttonTitle('Redo', 'Mod+Shift+Z', '↪️')"
              (click)="redo()"
            >
              <span class="toolbar-icon" aria-hidden="true">
                <svg class="toolbar-svg" [attr.viewBox]="toolbarIcons.redo.viewBox" focusable="false">
                  @for (path of toolbarIcons.redo.paths; track path) {
                    <path [attr.d]="path"></path>
                  }
                </svg>
              </span>
            </button>
            @if (!note().is_about_note) {
              <button
                type="button"
                class="toolbar-btn toolbar-btn--icon toolbar-btn--danger"
                [attr.title]="buttonTitle('Delete note', undefined, '🗑️')"
                (click)="deleteRequested.emit()"
              >
                <span class="toolbar-icon" aria-hidden="true">
                  <svg class="toolbar-svg" [attr.viewBox]="toolbarIcons.trash.viewBox" focusable="false">
                    @for (path of toolbarIcons.trash.paths; track path) {
                      <path [attr.d]="path"></path>
                    }
                  </svg>
                </span>
              </button>
            }
          </div>
        </section>
        }
      </div>

      <section class="editor-surface" #editorSurface [class.editor-surface--editing]="editorEnabled()">
        <ng-content select="[note-header-slot]"></ng-content>
        <div #editorHost class="editor-host"></div>
        @if (focusedLinkMenu(); as menu) {
          <div
            class="link-focus-menu"
            [style.left.px]="menu.left"
            [style.top.px]="menu.top"
            (pointerdown)="preserveLinkMenuSelection($event)"
            (mousedown)="preserveLinkMenuSelection($event)"
            (mouseenter)="onLinkMenuMouseEnter()"
            (mouseleave)="onLinkMenuMouseLeave()"
          >
            @if (editorEnabled()) {
              <span
                class="link-focus-menu__text-action"
                data-tooltip="Toggle URL and smart title."
                role="button"
                tabindex="0"
                (click)="toggleFocusedLinkView()"
                (keydown.enter)="toggleFocusedLinkView()"
                (keydown.space)="toggleFocusedLinkView(); $event.preventDefault()"
              >
                text
              </span>
              <button
                type="button"
                class="link-focus-menu__btn"
                data-tooltip="Edit URL and display title."
                aria-label="Edit link"
                (click)="editFocusedLink()"
              >
                <svg viewBox="0 0 640 640" focusable="false" aria-hidden="true">
                  <path [attr.d]="linkMenuIcons.edit"></path>
                </svg>
              </button>
              <button
                type="button"
                class="link-focus-menu__btn"
                data-tooltip="Remove link and keep text."
                aria-label="Remove link"
                (click)="removeFocusedLink()"
              >
                <svg viewBox="0 0 640 640" focusable="false" aria-hidden="true">
                  <path [attr.d]="linkMenuIcons.unlink"></path>
                </svg>
              </button>
            }
            <button
              type="button"
              class="link-focus-menu__btn"
              data-tooltip="Open link target in a new tab."
              aria-label="Open link"
              (click)="openFocusedLink()"
            >
              <svg viewBox="0 0 640 640" focusable="false" aria-hidden="true">
                <path [attr.d]="linkMenuIcons.follow"></path>
              </svg>
            </button>
            <button
              type="button"
              class="link-focus-menu__btn"
              data-tooltip="Copy URL to clipboard."
              aria-label="Copy link"
              (click)="copyFocusedLink()"
            >
              <svg viewBox="0 0 640 640" focusable="false" aria-hidden="true">
                <path [attr.d]="linkMenuIcons.copy"></path>
              </svg>
            </button>
          </div>
        }
        @if (linkEditorState(); as editorState) {
          <form
            class="link-editor-popover"
            [style.left.px]="editorState.left"
            [style.top.px]="editorState.top"
            (pointerdown)="preserveLinkMenuSelection($event)"
            (mousedown)="preserveLinkMenuSelection($event)"
            (submit)="submitLinkEditor(); $event.preventDefault()"
          >
            <div class="link-editor-popover__title">
              {{ editorState.mode === 'insert' ? 'Insert link' : 'Edit link' }}
            </div>
            <label class="link-editor-popover__field">
              URL
              <input
                type="text"
                class="link-editor-popover__input"
                placeholder="https://example.com or /home/notes/..."
                [value]="editorState.href"
                (input)="onLinkEditorHrefInput($event)"
                (keydown.escape)="cancelLinkEditor(); $event.preventDefault()"
                autofocus
              />
            </label>
            <label class="link-editor-popover__field">
              Text
              <input
                type="text"
                class="link-editor-popover__input"
                placeholder="Display text"
                [value]="editorState.label"
                (input)="onLinkEditorLabelInput($event)"
                (keydown.escape)="cancelLinkEditor(); $event.preventDefault()"
              />
            </label>
            @if (editorState.error) {
              <div class="link-editor-popover__error">{{ editorState.error }}</div>
            }
            <div class="link-editor-popover__actions">
              <button type="button" class="link-editor-popover__btn link-editor-popover__btn--ghost" (click)="cancelLinkEditor()">
                Cancel
              </button>
              <button type="submit" class="link-editor-popover__btn">Apply</button>
            </div>
          </form>
        }
        @if (databaseSchemaEditorState(); as schemaState) {
          <app-database-schema-editor
            [visible]="true"
            [value]="schemaState.value"
            (cancel)="cancelDatabaseSchemaEditor()"
            (apply)="submitDatabaseSchemaEditor($event)"
          />
        }
      </section>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        height: 100%;
        min-height: 0;
      }

      .unified-note-editor-shell {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
        margin-bottom: 0;
      }

      .note-editor-topbar {
        position: sticky;
        top: 0;
        z-index: 3;
        order: 1;
      }

      .editor-surface {
        order: 3;
        flex: 1 1 auto;
        min-height: 0;
        height: 0;
        overflow-y: auto;
        overflow-x: hidden;
      }

      .editor-host {
        min-height: 18rem;
      }

      .note-header-top-shell {
        position: relative;
        min-height: var(--note-editor-top-controls-height, 2rem);
        border-bottom: 1px solid var(--border-color, #e5e7eb);
        background: var(--bg-color, #fff);
      }

      .note-header-top {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        flex-wrap: wrap;
        gap: 0.2rem 0.35rem;
        width: 100%;
        min-height: 2rem;
        max-width: none;
        margin: 0;
        padding: 0.08rem 1rem;
        box-sizing: border-box;
      }

      .note-edit-actions {
        display: inline-flex;
        align-items: center;
        gap: 0.2rem;
      }

      .note-edit-toggle {
        display: inline-flex;
        align-items: center;
        gap: 0.65rem;
        min-height: 1.9rem;
        padding: 0.28rem 0.5rem;
        border: 0;
        border-radius: 0.32rem;
        background: transparent;
        color: var(--text-color, #111);
        font: inherit;
        font-size: 0.82rem;
        font-weight: 600;
        cursor: pointer;
        transition: background-color 120ms ease, color 120ms ease;
      }

      .note-edit-toggle:hover,
      .note-edit-toggle--active {
        background: var(--hover-bg, #f5f7fb);
        color: var(--focus-color, #1976d2);
      }

      .note-edit-toggle__icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 0.92rem;
        height: 0.92rem;
        flex: 0 0 0.92rem;
      }

      .note-edit-toggle__icon svg {
        width: 100%;
        height: 100%;
        fill: currentColor;
      }

      .note-edit-toggle--secondary {
        color: var(--text-muted, #666);
      }

      .note-edit-toggle--primary {
        background: rgba(79, 70, 229, 0.09);
        color: var(--focus-color, #1976d2);
      }

      .note-edit-toggle:disabled {
        opacity: 0.6;
        cursor: wait;
      }

      .note-active-users-wrap {
        position: relative;
      }

      .note-active-users {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        min-height: 1.9rem;
        padding: 0.28rem 0.4rem;
        border: 0;
        border-radius: 0.32rem;
        background: transparent;
        color: var(--text-color, #111);
        font: inherit;
        font-size: 0.82rem;
        cursor: pointer;
        transition: background-color 120ms ease, color 120ms ease;
      }

      .note-active-users:hover,
      .note-active-users--open {
        background: var(--hover-bg, #f5f7fb);
        color: var(--focus-color, #1976d2);
      }

      .note-active-users__avatars {
        display: inline-flex;
        align-items: center;
        min-width: 1.8rem;
      }

      .note-active-users__avatar,
      .note-active-users-popover__avatar {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 999px;
        color: var(--text-color, #111);
        font-size: 0.82rem;
        font-weight: 700;
        text-transform: uppercase;
        border: 1px solid var(--border-color, #e0e0e0);
      }

      .note-active-users__avatar {
        position: relative;
        width: 1.75rem;
        height: 1.75rem;
        margin-left: -0.78rem;
      }

      .note-active-users__avatar:first-child {
        margin-left: 0;
      }

      .note-active-users__avatar::after {
        content: attr(data-tooltip);
        position: absolute;
        left: 50%;
        bottom: calc(100% + 0.55rem);
        transform: translateX(-50%) translateY(0.15rem);
        opacity: 0;
        pointer-events: none;
        padding: 0.35rem 0.55rem;
        border-radius: 8px;
        background: rgba(15, 23, 42, 0.92);
        color: #fff;
        font-size: 0.78rem;
        font-weight: 500;
        line-height: 1.2;
        text-transform: none;
        white-space: nowrap;
        transition: opacity 120ms ease, transform 120ms ease;
        z-index: 12;
      }

      .note-active-users__avatar:hover::after {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }

      .note-active-users__more {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 1.75rem;
        height: 1.75rem;
        padding: 0 0.38rem;
        margin-left: 0.12rem;
        border-radius: 999px;
        background: var(--hover-bg, #eef1f6);
        color: var(--text-muted, #666);
        font-size: 0.72rem;
        font-weight: 600;
        border: 1px solid var(--border-color, #e0e0e0);
      }

      .note-active-users-popover {
        position: absolute;
        top: calc(100% + 0.45rem);
        right: 0;
        z-index: 10;
        width: min(20rem, calc(100vw - 4rem));
        padding: 0.45rem;
        border: 1px solid var(--border-color, #d8dde6);
        border-radius: 0.55rem;
        background: var(--dropdown-bg, var(--bg-color, #fff));
        color: var(--text-color, #111);
        box-shadow: 0 10px 22px rgba(2, 6, 23, 0.16);
      }

      .note-active-users-popover__list {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        max-height: 14rem;
        overflow-y: auto;
      }

      .note-active-users-popover__item {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.55rem 0.6rem;
        border-radius: 0.45rem;
      }

      .note-active-users-popover__item:hover {
        background: var(--hover-bg, #f5f7fb);
      }

      .note-active-users-popover__avatar {
        width: 2.35rem;
        height: 2.35rem;
        flex: 0 0 2.35rem;
      }

      .note-active-users-popover__text {
        display: flex;
        flex-direction: column;
        min-width: 0;
        flex: 1;
      }

      .note-active-users-popover__name,
      .note-active-users-popover__meta,
      .note-active-users-popover__status {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .note-active-users-popover__name {
        font-size: 1rem;
        font-weight: 600;
      }

      .note-active-users-popover__meta,
      .note-active-users-popover__status,
      .note-updated {
        color: var(--text-muted, #666);
        font-size: 0.76rem;
      }

      .note-active-users-popover__status {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 4.6rem;
        padding: 0.22rem 0.45rem;
        border-radius: 999px;
        border: 1px solid transparent;
        font-weight: 600;
      }

      .note-active-users-popover__status--editing {
        background: var(--presence-editing-bg, rgba(34, 197, 94, 0.14));
        color: var(--presence-editing-text, #166534);
        border-color: var(--presence-editing-border, rgba(34, 197, 94, 0.28));
      }

      .note-active-users-popover__status--viewing {
        background: var(--presence-viewing-bg, rgba(59, 130, 246, 0.12));
        color: var(--presence-viewing-text, #1e40af);
        border-color: var(--presence-viewing-border, rgba(59, 130, 246, 0.26));
      }

      .note-updated--warning {
        color: #b45309;
      }

      .note-updated--error {
        color: var(--error-color, #c62828);
      }

      .link-focus-menu {
        position: fixed;
        z-index: 18;
        display: inline-flex;
        align-items: center;
        gap: 0.32rem;
        padding: 0.36rem;
        border-radius: 0.72rem;
        border: 1px solid var(--border-color, #d8dde6);
        background: var(--dropdown-bg, var(--bg-color, #fff));
        box-shadow: 0 14px 28px rgba(2, 6, 23, 0.2);
      }

      .link-focus-menu__btn {
        width: 2rem;
        height: 2rem;
        border: 0;
        border-radius: 0.5rem;
        background: transparent;
        color: var(--text-color, #111);
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 0.95rem;
        font-weight: 600;
        line-height: 1;
        transition: background-color 120ms ease, color 120ms ease;
        position: relative;
      }

      .link-focus-menu__text-action {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 2.1rem;
        height: 2rem;
        padding: 0 0.45rem;
        border-radius: 0.5rem;
        color: var(--text-color, #111);
        cursor: pointer;
        text-transform: lowercase;
        font-size: 0.76rem;
        font-weight: 700;
        letter-spacing: 0.03em;
        transition: background-color 120ms ease, color 120ms ease;
        position: relative;
      }

      .link-focus-menu__btn:hover {
        background: var(--hover-bg, #f5f7fb);
        color: var(--focus-color, #1976d2);
      }

      .link-focus-menu__text-action:hover,
      .link-focus-menu__text-action:focus-visible {
        background: var(--hover-bg, #f5f7fb);
        color: var(--focus-color, #1976d2);
        outline: none;
      }

      .link-focus-menu__btn svg {
        width: 1.12rem;
        height: 1.12rem;
        fill: currentColor;
      }

      .link-focus-menu__btn[data-tooltip]:hover::after,
      .link-focus-menu__text-action[data-tooltip]:hover::after {
        content: attr(data-tooltip);
        position: absolute;
        left: 50%;
        top: calc(100% + 0.45rem);
        transform: translateX(-50%);
        white-space: nowrap;
        padding: 0.33rem 0.5rem;
        border-radius: 0.4rem;
        background: rgba(15, 23, 42, 0.92);
        color: #fff;
        font-size: 0.72rem;
        font-weight: 500;
        pointer-events: none;
        z-index: 20;
      }

      @media (max-width: 640px) {
        .note-header-top {
          padding-inline: 0.75rem;
        }

        .editor-toolbar {
          padding: 0.7rem;
        }

        .editor-toolbar__divider {
          display: none;
        }

        .toolbar-popover {
          left: auto;
          right: 0;
        }
      }
    `,
  ],
})
export class UnifiedNoteEditorComponent implements OnDestroy {
  @ViewChild('editorHost')
  set editorHostRef(host: ElementRef<HTMLDivElement> | undefined) {
    if (host && this.editorHost?.nativeElement === host.nativeElement) {
      return;
    }
    this.editorHost = host;
    if (host && this.editorDoc) {
      this.requestMountEditor(this.editorDoc, this.restoreDraftOnMount);
    }
  }
  @ViewChild('editorSurface') private editorSurface?: ElementRef<HTMLElement>;

  readonly note = input.required<Note>();
  readonly blocks = input<NoteBlock[]>([]);
  readonly canEdit = input(false);
  readonly deleteRequested = output<void>();
  readonly updatedAtChange = output<string>();
  readonly editingChange = output<boolean>();
  readonly updateRequested = output<void>();

  readonly auth = inject(AuthService);
  private readonly hostElement = inject(ElementRef<HTMLElement>);
  private readonly notesService = inject(NotesService);
  private readonly spacesService = inject(SpacesService);
  private readonly foldersService = inject(FoldersService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly unsavedChanges = inject(NoteUnsavedChangesService);

  readonly isEditing = signal(false);
  readonly isSaving = signal(false);
  readonly hasUnsavedChanges = signal(false);
  readonly saveError = signal<string | null>(null);
  readonly activeUsersOpen = signal(false);
  readonly headingMenuOpen = signal(false);
  readonly formatMenuOpen = signal(false);
  readonly alignMenuOpen = signal(false);
  readonly colorMenuOpen = signal(false);
  readonly tableMenuOpen = signal(false);
  readonly plusMenuOpen = signal(false);
  readonly tablePreview = signal<{ rows: number; cols: number } | null>(null);
  readonly selectionVersion = signal(0);
  readonly presenceUsers = signal<NoteActiveUser[]>([]);
  readonly focusedLinkMenu = signal<FocusedLinkState | null>(null);
  readonly databaseSchemaEditorState = signal<DatabaseSchemaEditorState | null>(null);

  readonly toolbarIcons = TOOLBAR_ICONS;
  readonly linkMenuIcons = LINK_MENU_ICONS;
  readonly headingOptions = HEADING_OPTIONS;
  readonly formatMenuItems = FORMAT_MENU_ITEMS;
  readonly alignOptions = ALIGN_OPTIONS;
  readonly textColors = TEXT_COLOR_TOKENS;
  readonly highlightColors = HIGHLIGHT_COLOR_TOKENS;
  readonly codeLanguages = CODE_LANGUAGES;
  readonly tableSizes = TABLE_SIZES;
  readonly editorEnabled = computed(() => this.canEdit() && this.isEditing());
  readonly toolbarVisible = computed(() => this.editorEnabled());
  readonly activeUsers = computed<NoteActiveUser[]>(() => {
    const users = this.presenceUsers();
    if (users.length) {
      return users;
    }
    const fallback = this.buildFallbackUser();
    return fallback ? [fallback] : [];
  });
  readonly visibleActiveUsers = computed(() => this.activeUsers().slice(0, 3));
  readonly hiddenActiveUsersCount = computed(() => Math.max(this.activeUsers().length - 3, 0));

  private editorHost?: ElementRef<HTMLDivElement>;
  private editor: Editor | null = null;
  private pendingDoc: JSONContent | null = null;
  private editorDoc: JSONContent | null = null;
  private bodyBlockId: string | null = null;
  private legacyBlockIds: string[] = [];
  private lastBlocksSignature = '';
  private suppressUpdates = false;
  private currentPersistPromise: Promise<boolean> | null = null;
  private restoreDraftOnMount = false;
  private readonlyDocBeforeEdit: JSONContent | null = null;
  private toolbarSelection: { from: number; to: number } | null = null;
  private selectionVersionQueued = false;
  private mountEditorQueued = false;
  private pendingMountRequest: { doc: JSONContent; preserveDirty: boolean } | null = null;
  private readonly isMacPlatform = this.detectMacPlatform();
  private presenceInFlight = false;
  private modeScrollFrameId: number | null = null;
  private lastAppliedEditorMode: boolean | null = null;
  private draftRequestVersion = 0;
  private linkMenuHideTimeoutId: number | null = null;
  private linkMenuHovered = false;
  private linkAutoEnhanceTimerId: number | null = null;
  private linkAutoEnhanceInFlight = false;
  private syncLinkAttrsTimerId: number | null = null;
  private syncSpaceLinkIconsTimerId: number | null = null;
  private readonly noteCache = new Map<string, Note | null>();
  private spacesCache: Space[] | null = null;
  private foldersCache: Folder[] | null = null;
  private readonly aboutSpaceByNoteId = new Map<string, Space>();
  private readonly spaceAvatarKeyById = new Map<number, number>();
  readonly linkEditorState = signal<LinkEditorState | null>(null);

  constructor() {
    effect(() => {
      const editable = this.editorEnabled();
      this.editor?.setEditable(editable);
      this.syncEditorModeClass();
      this.queueSelectionVersionUpdate();
      if (editable) {
        this.hideFocusedLinkMenu();
      }
      if (this.lastAppliedEditorMode !== editable) {
        this.lastAppliedEditorMode = editable;
        this.queueModeScrollAlignment();
      }
    });

    effect((onCleanup) => {
      const noteId = this.note().id;
      this.unsavedChanges.register(noteId, () => this.flushPendingChanges());
      onCleanup(() => this.unsavedChanges.unregister(noteId));
    });

    effect(() => {
      this.unsavedChanges.setState(this.note().id, {
        dirty: this.hasUnsavedChanges(),
        saving: this.isSaving(),
        error: this.saveError(),
      });
    });

    effect(() => {
      const note = this.note();
      const blocks = this.blocks();
      const signature = `${note.id}:${blocks.map((block) => `${block.id}:${block.version}`).join('|')}`;
      if (signature === this.lastBlocksSignature) {
        return;
      }
      this.lastBlocksSignature = signature;
      const bodyBlock = blocks.find((block) => block.type === RICH_TEXT_BLOCK_TYPE) ?? null;
      this.bodyBlockId = bodyBlock?.id ?? null;
      this.legacyBlockIds = blocks
        .filter((block) => block.id !== this.bodyBlockId)
        .map((block) => block.id);
      const doc =
        bodyBlock && isJsonContent(bodyBlock.data?.['doc'])
          ? (bodyBlock.data['doc'] as JSONContent)
          : buildDocumentFromBlocks(blocks);
      this.pendingDoc = doc;
      this.editorDoc = doc;
      this.restoreDraftOnMount = false;
      this.hasUnsavedChanges.set(false);
      this.saveError.set(null);
      if (this.editorHost) {
        this.requestMountEditor(this.editorDoc, false);
      }
      const requestVersion = ++this.draftRequestVersion;
      void this.restoreDraftFromServer(note.id, doc, requestVersion);
    });

    effect((onCleanup) => {
      const noteId = this.note().id;
      this.presenceUsers.set([]);
      this.syncPresence(noteId);
      const intervalId = window.setInterval(() => {
        this.syncPresence(noteId);
      }, 10_000);
      onCleanup(() => {
        window.clearInterval(intervalId);
      });
    });

    effect(() => {
      const noteId = this.note().id;
      this.editorEnabled();
      this.syncPresence(noteId);
    });
  }

  ngOnDestroy(): void {
    if (this.modeScrollFrameId !== null) {
      window.cancelAnimationFrame(this.modeScrollFrameId);
      this.modeScrollFrameId = null;
    }
    this.cancelLinkMenuHideTimer();
    if (this.linkAutoEnhanceTimerId !== null) {
      window.clearTimeout(this.linkAutoEnhanceTimerId);
      this.linkAutoEnhanceTimerId = null;
    }
    if (this.syncLinkAttrsTimerId !== null) {
      window.clearTimeout(this.syncLinkAttrsTimerId);
      this.syncLinkAttrsTimerId = null;
    }
    if (this.syncSpaceLinkIconsTimerId !== null) {
      window.clearTimeout(this.syncSpaceLinkIconsTimerId);
      this.syncSpaceLinkIconsTimerId = null;
    }
    this.editor?.destroy();
    this.editor = null;
  }

  private buildFallbackUser(): NoteActiveUser | null {
    const user = this.auth.user();
    if (!user) {
      return null;
    }
    const label = user.nickname || user.email || 'Guest';
    return {
      id: user.id,
      label,
      email: user.email,
      initials: user.avatar_initials || label.slice(0, 2).toUpperCase(),
      avatarColor: user.avatar_color,
      activity: this.editorEnabled() ? 'Editing' : 'Viewing',
    };
  }

  private mapPresenceUsers(users: NotePresenceUser[]): NoteActiveUser[] {
    return users.map((user) => ({
      id: user.id,
      label: user.label,
      email: user.email,
      initials: user.initials,
      avatarColor: user.avatarColor,
      activity: user.activity,
    }));
  }

  private syncPresence(noteId: string): void {
    if (this.presenceInFlight || noteId !== this.note().id) return;
    this.presenceInFlight = true;
    const currentUser = this.auth.user();
    const request$ = currentUser
      ? this.notesService.heartbeatPresence(noteId, this.editorEnabled() ? 'Editing' : 'Viewing')
      : this.notesService.listPresence(noteId);
    request$.subscribe({
      next: (users) => {
        if (noteId !== this.note().id) return;
        this.presenceUsers.set(this.mapPresenceUsers(users));
      },
      error: () => {
        this.presenceInFlight = false;
        if (noteId !== this.note().id) return;
        const fallback = this.buildFallbackUser();
        this.presenceUsers.set(fallback ? [fallback] : []);
      },
      complete: () => {
        this.presenceInFlight = false;
      },
    });
  }

  formattedUpdatedAt(): string {
    const date = new Date(this.note().updated_at);
    if (Number.isNaN(date.getTime())) return '';
    const isCurrentYear = date.getFullYear() === new Date().getFullYear();
    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
      ...(isCurrentYear ? {} : { year: 'numeric' }),
    }).format(date);
  }

  statusMessage(): string {
    if (this.saveError()) return this.saveError() ?? '';
    if (this.isSaving()) return 'Saving changes...';
    if (this.hasUnsavedChanges()) return 'You have unsaved changes';
    const formatted = this.formattedUpdatedAt();
    return formatted ? `Updated ${formatted}` : '';
  }

  toggleEditing(): void {
    if (!this.canEdit()) return;
    const sourceDoc = this.pendingDoc ?? this.editor?.getJSON() ?? this.editorDoc ?? emptyDoc();
    this.readonlyDocBeforeEdit = sourceDoc;
    const editableDoc = this.convertMarkupLinksInDoc(sourceDoc);
    this.editorDoc = editableDoc;
    this.pendingDoc = editableDoc;
    this.setEditingState(true);
    this.saveError.set(null);
    if (this.editorHost) {
      this.requestMountEditor(editableDoc, false);
    }
    this.closeToolbarMenus();
  }

  cancelEditing(): void {
    if (!this.canEdit() || this.isSaving()) return;
    this.setEditingState(false);
    this.closeToolbarMenus();
    this.hasUnsavedChanges.set(false);
    this.saveError.set(null);
    this.unsavedChanges.clearDraft(this.note().id);
    const readonlyDoc = this.readonlyDocBeforeEdit ?? this.pendingDoc;
    this.readonlyDocBeforeEdit = null;
    if (readonlyDoc && this.editorHost) {
      this.pendingDoc = readonlyDoc;
      this.editorDoc = readonlyDoc;
      this.requestMountEditor(readonlyDoc, false);
    }
  }

  async updateEditing(): Promise<void> {
    if (!this.editorEnabled() || this.isSaving()) return;
    this.closeToolbarMenus();
    this.updateRequested.emit();
    const saved = await this.persist(() => {
      this.setEditingState(false);
      if (this.pendingDoc && this.editorHost) {
        this.requestMountEditor(this.pendingDoc);
      }
    });
    if (!saved) {
      this.setEditingState(true);
    }
  }

  private setEditingState(nextValue: boolean): void {
    if (this.isEditing() === nextValue) return;
    this.isEditing.set(nextValue);
    this.editingChange.emit(nextValue);
  }

  toggleActiveUsers(): void {
    this.activeUsersOpen.update((value) => !value);
  }

  @HostListener('document:pointerdown', ['$event'])
  onDocumentPointerDown(event: PointerEvent): void {
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (this.shouldKeepOverlayOpenForTarget(target)) return;
    this.dismissTransientOverlays();
  }

  @HostListener('window:notes-database-schema-open', ['$event'])
  onDatabaseSchemaNodeOpen(event: Event): void {
    if (!(event instanceof CustomEvent)) return;
    const detail = event.detail as DatabaseSchemaNodeOpenDetail | null;
    if (!detail) return;
    this.openDatabaseSchemaEditorFromNode(detail.position, detail.mode);
  }

  private openDatabaseSchemaEditorFromNode(position: number | null, mode: 'view' | 'edit'): void {
    if (mode !== 'edit') return;
    if (!this.editorEnabled() || !this.canEdit()) return;
    if (!this.editor) return;
    if (typeof position === 'number') {
      const selection = NodeSelection.create(this.editor.state.doc, position);
      this.editor.view.dispatch(this.editor.state.tr.setSelection(selection));
      this.queueSelectionVersionUpdate();
    }
    const selected = this.selectedDatabaseSchemaState(this.editor);
    if (!selected) return;
    this.databaseSchemaEditorState.set({
      mode: 'edit',
      position: selected.position,
      value: selected.value,
      error: null,
    });
    this.closeToolbarMenus();
  }

  private activeEditor(): Editor | null {
    if (!this.editorEnabled() || !this.editor) return null;
    return this.editor;
  }

  preserveToolbarSelection(event: MouseEvent | PointerEvent): void {
    if (!this.editorEnabled() || !this.editor) return;
    const { from, to } = this.editor.state.selection;
    const hasRangeSelection = to > from;
    if (hasRangeSelection) {
      this.toolbarSelection = { from, to };
    } else {
      // Important: do not reuse stale ranges from previous interactions.
      this.toolbarSelection = null;
    }
    // Keep ProseMirror selection visible while toolbar menus are clicked.
    event.preventDefault();
    event.stopPropagation();
  }

  preserveLinkMenuSelection(event: MouseEvent | PointerEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }

  private focusEditorForToolbarAction(fallbackToFocus = true): Editor | null {
    const editor = this.activeEditor();
    if (!editor) return null;
    const currentSelection = editor.state.selection;
    const hasCurrentRange = currentSelection.to > currentSelection.from;
    const nextSelection = hasCurrentRange
      ? { from: currentSelection.from, to: currentSelection.to }
      : this.toolbarSelection;
    if (!nextSelection) {
      if (fallbackToFocus) {
        editor.commands.focus();
      }
      return editor;
    }
    try {
      editor.chain().focus().setTextSelection(nextSelection).run();
    } catch {
      editor.commands.focus();
    }
    return editor;
  }

  private restoreSelectionAfterToolbarAction(): void {
    this.queueSelectionVersionUpdate();
  }

  private queueSelectionVersionUpdate(): void {
    if (this.selectionVersionQueued) return;
    this.selectionVersionQueued = true;
    queueMicrotask(() => {
      this.selectionVersionQueued = false;
      this.selectionVersion.update((value) => value + 1);
      if (this.editorEnabled()) {
        this.syncEditModeFocusedLinkMenu();
      }
    });
  }

  private hasOpenToolbarMenu(): boolean {
    return (
      this.headingMenuOpen() ||
      this.formatMenuOpen() ||
      this.alignMenuOpen() ||
      this.colorMenuOpen() ||
      this.tableMenuOpen() ||
      this.plusMenuOpen()
    );
  }

  displayShortcut(shortcut?: string): string {
    if (!shortcut) return '';
    if (!this.isMacPlatform) {
      return shortcut.replaceAll('Mod', 'Ctrl');
    }
    const parts = shortcut.split('+').map((part) => part.trim());
    const mapped = parts.map((part) => {
      switch (part) {
        case 'Mod':
          return '⌘';
        case 'Shift':
          return '⇧';
        case 'Alt':
          return '⌥';
        default:
          return part.toUpperCase();
      }
    });
    return mapped.join('');
  }

  buttonTitle(label: string, shortcut?: string, emoji?: string): string {
    const prefix = emoji ? `${emoji} ` : '';
    const renderedShortcut = this.displayShortcut(shortcut);
    return renderedShortcut ? `${prefix}${label} (${renderedShortcut})` : `${prefix}${label}`;
  }

  private detectMacPlatform(): boolean {
    if (typeof navigator === 'undefined') return false;
    const platform = navigator.platform?.toLowerCase() ?? '';
    if (platform.includes('mac')) return true;
    const userAgent = navigator.userAgent?.toLowerCase() ?? '';
    return userAgent.includes('mac os');
  }

  private isModPressed(event: KeyboardEvent): boolean {
    return event.metaKey || event.ctrlKey;
  }

  private handleEditorShortcuts(event: KeyboardEvent): boolean {
    if (!this.editorEnabled() || event.defaultPrevented || event.isComposing) return false;
    if (this.tryHandleBracketAutopair(event)) return true;
    if (this.tryHandleCodeSlashCommand(event)) return true;
    const key = event.key.toLowerCase();
    if (!this.isModPressed(event) && !event.altKey && !event.shiftKey && key === 'escape') {
      if (this.databaseSchemaEditorState()) {
        event.preventDefault();
        this.cancelDatabaseSchemaEditor();
        return true;
      }
    }
    if (this.isModPressed(event) && key === 's') {
      event.preventDefault();
      void this.updateEditing();
      return true;
    }
    if (!this.isModPressed(event) && !event.altKey && !event.shiftKey && key === 'escape') {
      event.preventDefault();
      this.cancelEditing();
      return true;
    }

    if (this.isModPressed(event) && event.altKey && !event.shiftKey) {
      if (key === '0') {
        event.preventDefault();
        this.applyHeadingOption('paragraph');
        return true;
      }
      if (['1', '2', '3', '4', '5', '6'].includes(key)) {
        event.preventDefault();
        this.applyHeadingOption(`h${key}` as HeadingValue);
        return true;
      }
      if (key === '.') {
        event.preventDefault();
        this.toggleSubscript();
        return true;
      }
      if (key === 'h') {
        event.preventDefault();
        this.clearHighlight();
        return true;
      }
      if (key === 'x') {
        event.preventDefault();
        this.clearTextColor();
        return true;
      }
      if (key === 'l') {
        event.preventDefault();
        this.applyTextAlign('left');
        return true;
      }
      if (key === 'c') {
        event.preventDefault();
        this.applyTextAlign('center');
        return true;
      }
      if (key === 'r') {
        event.preventDefault();
        this.applyTextAlign('right');
        return true;
      }
      if (key === 'j') {
        event.preventDefault();
        this.applyTextAlign('justify');
        return true;
      }
      if (key === 't') {
        event.preventDefault();
        this.toggleTableMenu();
        return true;
      }
    }

    if (this.isModPressed(event) && event.altKey && event.shiftKey) {
      if (key === '.') {
        event.preventDefault();
        this.toggleSuperscript();
        return true;
      }
    }

    if (this.isModPressed(event) && event.shiftKey && !event.altKey) {
      if (key === 'x') {
        event.preventDefault();
        this.toggleStrike();
        return true;
      }
      if (key === '7') {
        event.preventDefault();
        this.toggleOrderedList();
        return true;
      }
      if (key === '8') {
        event.preventDefault();
        this.toggleBulletList();
        return true;
      }
      if (key === 'i') {
        event.preventDefault();
        this.insertImageByUrl();
        return true;
      }
    }

    if (this.isModPressed(event) && !event.shiftKey && !event.altKey) {
      if (key === 'e') {
        event.preventDefault();
        this.toggleInlineCode();
        return true;
      }
      if (key === 'k') {
        event.preventDefault();
        this.insertLink();
        return true;
      }
    }

    return false;
  }

  private tryHandleBracketAutopair(event: KeyboardEvent): boolean {
    if (this.isModPressed(event) || event.altKey || event.ctrlKey || event.metaKey) {
      return false;
    }
    const closing = AUTOPAIR_BRACKETS[event.key];
    if (!closing) return false;
    const editor = this.activeEditor();
    if (!editor) return false;
    const { selection } = editor.state;
    if (!selection.empty) return false;
    if (selection.$from.parent.type.name !== 'codeBlock') return false;
    event.preventDefault();
    const from = selection.from;
    const pair = `${event.key}${closing}`;
    const transaction = editor.state.tr.insertText(pair, from, from);
    transaction.setSelection(TextSelection.create(transaction.doc, from + 1));
    editor.view.dispatch(transaction);
    return true;
  }

  private tryHandleCodeSlashCommand(event: KeyboardEvent): boolean {
    if (event.key !== 'Enter' || this.isModPressed(event) || event.altKey || event.shiftKey) {
      return false;
    }
    const editor = this.activeEditor();
    if (!editor) return false;
    const { selection } = editor.state;
    if (!selection.empty) return false;
    const parent = selection.$from.parent;
    if (parent.type.name !== 'paragraph') return false;
    const commandText = parent.textContent.trim();
    const match = commandText.match(/^\/code(?:\s+([a-zA-Z0-9_+-]+))?$/);
    if (!match) return false;
    const language = normalizeCodeLanguage(match[1]);
    event.preventDefault();
    const from = selection.$from.start();
    const to = selection.$from.end();
    editor
      .chain()
      .focus()
      .setTextSelection({ from, to })
      .deleteSelection()
      .setCodeBlock({ language })
      .run();
    const nextSelection = editor.state.selection;
    if (!nextSelection.empty) return true;
    const transaction = editor.state.tr.setSelection(TextSelection.near(editor.state.selection.$from));
    editor.view.dispatch(transaction);
    return true;
  }

  private requestMountEditor(doc: JSONContent, preserveDirty = false): void {
    this.pendingMountRequest = { doc, preserveDirty };
    if (this.mountEditorQueued) return;
    this.mountEditorQueued = true;
    queueMicrotask(() => {
      this.mountEditorQueued = false;
      const request = this.pendingMountRequest;
      this.pendingMountRequest = null;
      if (!request || !this.editorHost) return;
      this.mountEditor(request.doc, request.preserveDirty);
    });
  }

  headingValue(): HeadingValue {
    this.selectionVersion();
    if (!this.editor) return 'paragraph';
    for (const level of [1, 2, 3, 4, 5, 6]) {
      if (this.editor.isActive('heading', { level })) {
        return `h${level}` as HeadingValue;
      }
    }
    return 'paragraph';
  }

  activeHeadingLevel(): HeadingLevel | null {
    const value = this.headingValue();
    return value === 'paragraph' ? null : (Number(value.replace('h', '')) as HeadingLevel);
  }

  currentHeadingLabel(): string {
    const value = this.headingValue();
    if (value === 'paragraph') {
      return 'Normal Text';
    }
    return this.headingOptions.find((option) => option.value === value)?.label ?? 'Normal Text';
  }

  isParagraphActive(): boolean {
    return this.headingValue() === 'paragraph';
  }

  applyHeadingOption(value: HeadingValue): void {
    const editor = this.focusEditorForToolbarAction();
    if (!editor) return;
    this.closeToolbarMenus();
    if (value === 'paragraph') {
      editor.chain().focus().setParagraph().run();
      return;
    }
    const level = Number(value.replace('h', ''));
    if (level >= 1 && level <= 6) {
      editor.chain().focus().toggleHeading({ level: level as 1 | 2 | 3 | 4 | 5 | 6 }).run();
    }
  }

  setParagraph(): void {
    this.applyHeadingOption('paragraph');
  }

  toggleHeadingMenu(): void {
    this.focusEditorForToolbarAction(false);
    const next = !this.headingMenuOpen();
    this.closeToolbarMenus();
    this.headingMenuOpen.set(next);
    this.restoreSelectionAfterToolbarAction();
  }

  onToolbarClick(event: MouseEvent): void {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    // Dropdown trigger buttons manage their own open/close state.
    if (target.closest('.toolbar-anchor > button')) return;
    // Let popover controls finish their own click actions.
    if (target.closest('.toolbar-popover')) return;
    this.dismissTransientOverlays();
  }

  isMarkActive(mark: string): boolean {
    this.selectionVersion();
    return this.editor?.isActive(mark) ?? false;
  }

  isNodeActive(node: string): boolean {
    this.selectionVersion();
    return this.editor?.isActive(node) ?? false;
  }

  isTextAlignActive(alignment: 'left' | 'center' | 'right' | 'justify'): boolean {
    this.selectionVersion();
    return this.editor?.isActive({ textAlign: alignment }) ?? false;
  }

  activeTextColor(): string | null {
    this.selectionVersion();
    const color = this.editor?.getAttributes('textStyle')['color'];
    return typeof color === 'string' ? color : null;
  }

  activeHighlightColor(): string | null {
    this.selectionVersion();
    const color = this.editor?.getAttributes('highlight')['color'];
    return typeof color === 'string' ? color : null;
  }

  hasAdvancedFormatActive(): boolean {
    return (
      this.isMarkActive('underline') ||
      this.isMarkActive('strike') ||
      this.isMarkActive('code') ||
      this.isMarkActive('subscript') ||
      this.isMarkActive('superscript')
    );
  }

  isFormatActionActive(action: FormatMenuAction): boolean {
    switch (action) {
      case 'underline':
        return this.isMarkActive('underline');
      case 'strike':
        return this.isMarkActive('strike');
      case 'code':
        return this.isMarkActive('code');
      case 'subscript':
        return this.isMarkActive('subscript');
      case 'superscript':
        return this.isMarkActive('superscript');
    }
  }

  runFormatAction(action: FormatMenuAction): void {
    switch (action) {
      case 'underline':
        this.toggleUnderline();
        break;
      case 'strike':
        this.toggleStrike();
        break;
      case 'code':
        this.toggleInlineCode();
        break;
      case 'subscript':
        this.toggleSubscript();
        break;
      case 'superscript':
        this.toggleSuperscript();
        break;
    }
    this.formatMenuOpen.set(false);
  }

  toggleFormatMenu(): void {
    this.focusEditorForToolbarAction(false);
    const next = !this.formatMenuOpen();
    this.closeToolbarMenus();
    this.formatMenuOpen.set(next);
    this.restoreSelectionAfterToolbarAction();
  }

  currentAlignOption(): AlignOption {
    this.selectionVersion();
    return (
      this.alignOptions.find((option) => this.editor?.isActive({ textAlign: option.value }) ?? false) ??
      this.alignOptions[0]
    );
  }

  isTextAligned(): boolean {
    return this.alignOptions.some((option) => this.isTextAlignActive(option.value));
  }

  applyTextAlign(alignment: AlignOptionValue): void {
    this.setTextAlign(alignment);
    this.alignMenuOpen.set(false);
  }

  toggleAlignMenu(): void {
    this.focusEditorForToolbarAction(false);
    const next = !this.alignMenuOpen();
    this.closeToolbarMenus();
    this.alignMenuOpen.set(next);
    this.restoreSelectionAfterToolbarAction();
  }

  hasActiveColors(): boolean {
    return !!this.activeTextColor() || !!this.activeHighlightColor();
  }

  toggleColorMenu(): void {
    this.focusEditorForToolbarAction(false);
    const next = !this.colorMenuOpen();
    this.closeToolbarMenus();
    this.colorMenuOpen.set(next);
    this.restoreSelectionAfterToolbarAction();
  }

  toggleBold(): void {
    this.focusEditorForToolbarAction()?.chain().toggleBold().run();
  }

  toggleItalic(): void {
    this.focusEditorForToolbarAction()?.chain().toggleItalic().run();
  }

  toggleUnderline(): void {
    this.focusEditorForToolbarAction()?.chain().toggleUnderline().run();
  }

  toggleStrike(): void {
    this.focusEditorForToolbarAction()?.chain().toggleStrike().run();
  }

  toggleInlineCode(): void {
    this.focusEditorForToolbarAction()?.chain().toggleCode().run();
  }

  toggleSubscript(): void {
    this.focusEditorForToolbarAction()?.chain().toggleSubscript().run();
  }

  toggleSuperscript(): void {
    this.focusEditorForToolbarAction()?.chain().toggleSuperscript().run();
  }

  clearFormatting(): void {
    this.activeEditor()?.chain().focus().unsetAllMarks().clearNodes().unsetTextAlign().run();
  }

  toggleOrderedList(): void {
    this.focusEditorForToolbarAction()?.chain().toggleOrderedList().run();
  }

  toggleBulletList(): void {
    this.focusEditorForToolbarAction()?.chain().toggleBulletList().run();
  }

  toggleTaskList(): void {
    this.focusEditorForToolbarAction()?.chain().toggleTaskList().run();
  }

  setTextAlign(alignment: 'left' | 'center' | 'right' | 'justify'): void {
    this.focusEditorForToolbarAction()?.chain().setTextAlign(alignment).run();
  }

  canUndo(): boolean {
    this.selectionVersion();
    return this.editor?.can().chain().focus().undo().run() ?? false;
  }

  canRedo(): boolean {
    this.selectionVersion();
    return this.editor?.can().chain().focus().redo().run() ?? false;
  }

  undo(): void {
    this.editor?.chain().focus().undo().run();
  }

  redo(): void {
    this.editor?.chain().focus().redo().run();
  }

  toggleTableMenu(): void {
    this.focusEditorForToolbarAction(false);
    const next = !this.tableMenuOpen();
    this.closeToolbarMenus();
    this.tableMenuOpen.set(next);
    this.restoreSelectionAfterToolbarAction();
  }

  togglePlusMenu(): void {
    this.focusEditorForToolbarAction(false);
    const next = !this.plusMenuOpen();
    this.closeToolbarMenus();
    this.plusMenuOpen.set(next);
    this.restoreSelectionAfterToolbarAction();
  }

  setTextColor(color: string): void {
    this.focusEditorForToolbarAction()?.chain().setColor(color).run();
    this.colorMenuOpen.set(false);
  }

  clearTextColor(): void {
    this.focusEditorForToolbarAction()?.chain().unsetColor().run();
    this.colorMenuOpen.set(false);
  }

  setHighlight(color: string): void {
    this.focusEditorForToolbarAction()?.chain().setHighlight({ color }).run();
    this.colorMenuOpen.set(false);
  }

  clearHighlight(): void {
    this.focusEditorForToolbarAction()?.chain().unsetHighlight().run();
    this.colorMenuOpen.set(false);
  }

  previewTableSize(rows: number, cols: number): void {
    this.tablePreview.set({ rows, cols });
  }

  clearTablePreview(): void {
    this.tablePreview.set(null);
  }

  tablePreviewLabel(): string {
    const preview = this.tablePreview();
    return preview ? `${preview.rows} x ${preview.cols}` : 'Pick size';
  }

  isTableCellActive(rows: number, cols: number): boolean {
    const preview = this.tablePreview();
    return !!preview && rows <= preview.rows && cols <= preview.cols;
  }

  insertTable(rows: number, cols: number): void {
    this.focusEditorForToolbarAction()
      ?.chain()
      .insertTable({ rows, cols, withHeaderRow: true })
      .run();
    this.tableMenuOpen.set(false);
    this.tablePreview.set(null);
  }

  databaseSchemaMenuLabel(): string {
    return this.selectedDatabaseSchemaState() ? 'Редактировать схему' : 'Название схемы';
  }

  private selectedDatabaseSchemaState(editor: Editor | null = this.activeEditor()): SelectedDatabaseSchemaState | null {
    this.selectionVersion();
    if (!editor) return null;
    const selection = editor.state.selection;
    if (!(selection instanceof NodeSelection)) return null;
    if (selection.node.type.name !== DATABASE_SCHEMA_NODE) return null;
    const value = normalizeDatabaseSchemaAttrs(selection.node.attrs as DatabaseSchemaAttrs);
    return {
      position: selection.from,
      value,
    };
  }

  insertImageByUrl(): void {
    const editor = this.activeEditor();
    if (!editor) return;
    const src = window.prompt('Image URL');
    if (!src?.trim()) return;
    const alt = window.prompt('Alt text (optional)')?.trim() ?? '';
    editor.chain().focus().setImage({ src: src.trim(), alt }).run();
    this.closeToolbarMenus();
  }

  insertLink(): void {
    const editor = this.focusEditorForToolbarAction(false);
    if (!editor) return;
    const { from, to, empty } = editor.state.selection;
    const selectedText = empty ? '' : editor.state.doc.textBetween(from, to, ' ').trim();
    const position = this.getDefaultLinkEditorPosition();
    this.linkEditorState.set({
      mode: 'insert',
      from,
      to,
      empty,
      href: '',
      label: selectedText,
      left: position.left,
      top: position.top,
      error: null,
    });
    this.saveError.set(null);
    this.closeToolbarMenus();
  }

  openFocusedLink(): void {
    const focused = this.focusedLinkMenu();
    if (!focused) return;
    this.cancelLinkMenuHideTimer();
    const internalRoute = this.resolveInternalRouteHref(focused.href);
    if (internalRoute) {
      void this.router.navigateByUrl(internalRoute);
      return;
    }
    window.open(focused.href, '_blank', 'noopener,noreferrer');
  }

  private resolveInternalRouteHref(rawHref: string): string | null {
    const normalized = this.asAbsoluteUrl(rawHref);
    const hash = normalized.hash.startsWith('#') ? normalized.hash.slice(1) : normalized.hash;
    if (normalized.origin === window.location.origin && normalized.pathname.startsWith('/home')) {
      return `${normalized.pathname}${normalized.search}${normalized.hash}`;
    }
    if (hash.startsWith('/home')) {
      return hash;
    }
    if (rawHref.startsWith('/home')) {
      return rawHref;
    }
    const noteId = this.extractNoteIdFromHref(rawHref);
    if (noteId) {
      return `/home/notes/${noteId}`;
    }
    const spaceId = this.extractSpaceIdFromHref(rawHref);
    if (spaceId !== null) {
      return `/home?space=${this.buildSpaceTokenById(spaceId)}`;
    }
    return null;
  }

  copyFocusedLink(): void {
    const focused = this.focusedLinkMenu();
    if (!focused) return;
    this.cancelLinkMenuHideTimer();
    void this.copyResolvedFocusedLink(focused);
  }

  private async copyResolvedFocusedLink(focused: FocusedLinkState): Promise<void> {
    if (focused.kind === 'note') {
      const noteId = this.extractNoteIdFromHref(focused.href);
      if (noteId) {
        const presentation = await this.resolveInternalLinkPresentation(`/home/notes/${noteId}`);
        if (presentation) {
          await navigator.clipboard.writeText(this.asAbsoluteUrl(presentation.href).toString());
          return;
        }
      }
    }
    if (focused.kind === 'space') {
      const spaceId = this.extractSpaceIdFromHref(focused.href);
      if (spaceId !== null) {
        const spaceToken = this.buildSpaceTokenById(spaceId);
        await navigator.clipboard.writeText(this.asAbsoluteUrl(`/home?space=${spaceToken}`).toString());
        return;
      }
    }
    await navigator.clipboard.writeText(this.asAbsoluteUrl(focused.href).toString());
  }

  async toggleFocusedLinkView(): Promise<void> {
    const editor = this.activeEditor();
    const focused = this.focusedLinkMenu();
    if (!editor || !focused) return;
    if (focused.kind === 'external') {
      return;
    }
    const nextView: LinkViewMode = focused.view === 'text' ? 'inline' : 'text';
    const presentation =
      nextView === 'inline'
        ? await this.resolveInternalLinkPresentation(focused.href)
        : { href: focused.href, label: focused.href };
    if (!presentation) return;
    editor
      .chain()
      .focus()
      .setTextSelection({ from: focused.from, to: focused.to })
      .insertContent({
        type: 'text',
        text: presentation.label,
        marks: [{ type: 'link', attrs: this.buildLinkAttrs(presentation.href, nextView) }],
      })
      .run();
    this.cancelLinkMenuHideTimer();
    this.syncEditModeFocusedLinkMenu();
  }

  editFocusedLink(): void {
    const focused = this.focusedLinkMenu();
    if (!focused) return;
    this.cancelLinkMenuHideTimer();
    this.linkEditorState.set({
      mode: 'edit',
      from: focused.from,
      to: focused.to,
      empty: false,
      href: focused.href,
      label: focused.label,
      left: Math.min(window.innerWidth - 360, Math.max(12, focused.left)),
      top: Math.min(window.innerHeight - 220, Math.max(12, focused.top + 8)),
      error: null,
    });
    this.hideFocusedLinkMenu(true);
    this.saveError.set(null);
  }

  onLinkEditorHrefInput(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    this.linkEditorState.update((state) => (state ? { ...state, href: target.value, error: null } : state));
  }

  onLinkEditorLabelInput(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    this.linkEditorState.update((state) => (state ? { ...state, label: target.value, error: null } : state));
  }

  cancelLinkEditor(): void {
    this.linkEditorState.set(null);
  }

  submitLinkEditor(): void {
    const draft = this.linkEditorState();
    const editor = this.activeEditor();
    if (!draft || !editor) {
      this.cancelLinkEditor();
      return;
    }
    const normalizedHref = this.normalizeLinkHref(draft.href);
    if (!normalizedHref) {
      this.linkEditorState.update((state) =>
        state ? { ...state, error: 'Please enter a valid http(s) URL, relative path, or #anchor.' } : state
      );
      return;
    }

    this.saveError.set(null);
    const typedLabel = draft.label.trim();
    const fallbackLabel = this.fallbackLinkLabel(normalizedHref);
    const nextLabel = typedLabel || (draft.mode === 'edit' ? fallbackLabel : draft.empty ? fallbackLabel : '');
    const viewLabel = nextLabel || typedLabel || fallbackLabel;
    const attrs = this.buildLinkAttrs(normalizedHref, this.resolveLinkViewMode(normalizedHref, viewLabel));

    if (!draft.empty || draft.mode === 'edit') {
      const selectedText = editor.state.doc.textBetween(draft.from, draft.to, ' ').trim();
      const replaceText = typedLabel.length > 0 && typedLabel !== selectedText;
      const chain = editor.chain().focus().setTextSelection({ from: draft.from, to: draft.to });
      if (replaceText || draft.mode === 'edit') {
        chain
          .insertContent({
            type: 'text',
            text: nextLabel || selectedText || fallbackLabel,
            marks: [{ type: 'link', attrs }],
          })
          .run();
      } else {
        chain.setLink(attrs).run();
      }
    } else {
      const label = nextLabel || fallbackLabel;
      editor
        .chain()
        .focus()
        .setTextSelection({ from: draft.from, to: draft.to })
        .insertContent({
          type: 'text',
          text: label,
          marks: [{ type: 'link', attrs }],
        })
        .run();
    }

    this.cancelLinkEditor();
    this.queueSelectionVersionUpdate();
  }

  removeFocusedLink(): void {
    const editor = this.activeEditor();
    const focused = this.focusedLinkMenu();
    if (!editor || !focused) return;
    editor.chain().focus().setTextSelection({ from: focused.from, to: focused.to }).unsetLink().run();
    this.hideFocusedLinkMenu(true);
  }

  onLinkMenuMouseEnter(): void {
    this.linkMenuHovered = true;
    this.cancelLinkMenuHideTimer();
  }

  onLinkMenuMouseLeave(): void {
    this.linkMenuHovered = false;
    if (!this.editorEnabled()) {
      this.scheduleLinkMenuHide();
    }
  }

  private hideFocusedLinkMenu(immediate = false): void {
    if (!immediate && this.linkMenuHovered) return;
    this.cancelLinkMenuHideTimer();
    this.linkMenuHovered = false;
    this.focusedLinkMenu.set(null);
  }

  private scheduleLinkMenuHide(delayMs = 500): void {
    this.cancelLinkMenuHideTimer();
    this.linkMenuHideTimeoutId = window.setTimeout(() => {
      this.linkMenuHideTimeoutId = null;
      if (this.linkMenuHovered) return;
      this.focusedLinkMenu.set(null);
    }, delayMs);
  }

  private cancelLinkMenuHideTimer(): void {
    if (this.linkMenuHideTimeoutId === null) return;
    window.clearTimeout(this.linkMenuHideTimeoutId);
    this.linkMenuHideTimeoutId = null;
  }

  private closestLinkAnchor(node: Node | null): HTMLAnchorElement | null {
    if (!node) return null;
    if (node instanceof HTMLAnchorElement) return node;
    if (node instanceof HTMLElement) {
      return node.closest('a[href]');
    }
    return node.parentElement?.closest('a[href]') ?? null;
  }

  private buildFocusedLinkState(anchor: HTMLAnchorElement, anchorPoint?: { left: number; top: number }): FocusedLinkState | null {
    if (!this.editor) return null;
    try {
      const from = this.editor.view.posAtDOM(anchor, 0);
      const to = this.editor.view.posAtDOM(anchor, anchor.childNodes.length);
      const href = anchor.getAttribute('href')?.trim() ?? '';
      if (!href) return null;
      const label = anchor.textContent?.trim() || href;
      const rect = anchor.getBoundingClientRect();
      const position = anchorPoint ?? {
        left: Math.min(window.innerWidth - 140, Math.max(12, rect.left)),
        top: Math.min(window.innerHeight - 64, Math.max(12, rect.bottom + 8)),
      };
      return {
        from: Math.min(from, to),
        to: Math.max(from, to),
        href,
        label,
        kind: this.inferLinkKind(href),
        view: this.parseLinkView(anchor, href, label),
        ...position,
      };
    } catch {
      return null;
    }
  }

  private parseLinkView(anchor: HTMLAnchorElement, href: string, label: string): LinkViewMode {
    const raw = anchor.getAttribute('data-app-link-view');
    if (raw === 'inline' || raw === 'text') {
      return raw;
    }
    return this.resolveLinkViewMode(href, label);
  }

  private syncEditModeFocusedLinkMenu(): void {
    if (!this.editor || !this.editorEnabled()) return;
    const { from, to } = this.editor.state.selection;
    const fromNode = this.editor.view.domAtPos(from).node;
    const toNode = this.editor.view.domAtPos(Math.max(from, to - 1)).node;
    const anchor = this.closestLinkAnchor(fromNode) ?? this.closestLinkAnchor(toNode);
    if (!anchor) {
      this.hideFocusedLinkMenu(true);
      return;
    }
    this.openFocusedLinkMenuFromAnchor(anchor);
  }

  private queueAutoEnhanceInternalLinks(): void {
    if (!this.editorEnabled() || !this.editor || this.suppressUpdates) return;
    if (this.linkAutoEnhanceInFlight) return;
    if (this.linkAutoEnhanceTimerId !== null) return;
    this.linkAutoEnhanceTimerId = window.setTimeout(() => {
      this.linkAutoEnhanceTimerId = null;
      void this.autoEnhanceInternalLinks();
    }, 120);
  }

  private async autoEnhanceInternalLinks(): Promise<void> {
    if (!this.editor || !this.editorEnabled() || this.suppressUpdates || this.linkAutoEnhanceInFlight) return;
    this.linkAutoEnhanceInFlight = true;
    try {
      let changed = true;
      let iterations = 0;
      while (changed && iterations < 3) {
        changed = await this.enhanceOneInternalLink();
        iterations += 1;
      }
    } finally {
      this.linkAutoEnhanceInFlight = false;
    }
  }

  private queueSyncSpaceLinkIcons(): void {
    if (!this.editor || this.suppressUpdates) return;
    if (this.syncSpaceLinkIconsTimerId !== null) return;
    this.syncSpaceLinkIconsTimerId = window.setTimeout(() => {
      this.syncSpaceLinkIconsTimerId = null;
      void this.syncSpaceLinkIcons();
    }, 140);
  }

  private queueSyncLinkAttrs(): void {
    if (!this.editor || this.suppressUpdates) return;
    if (this.syncLinkAttrsTimerId !== null) return;
    this.syncLinkAttrsTimerId = window.setTimeout(() => {
      this.syncLinkAttrsTimerId = null;
      this.syncLinkAttrs();
    }, 100);
  }

  private syncLinkAttrs(): void {
    if (!this.editor || this.suppressUpdates) return;
    const state = this.editor.state;
    const tr = state.tr;
    let changed = false;
    state.doc.descendants((node, position) => {
      if (!node.isText || typeof node.text !== 'string') return;
      const linkMark = node.marks.find((mark) => mark.type.name === 'link');
      if (!linkMark) return;
      const rawHref = typeof linkMark.attrs?.['href'] === 'string' ? String(linkMark.attrs['href']).trim() : '';
      if (!rawHref) return;
      const label = node.text;
      const desiredAttrs = this.buildLinkAttrs(rawHref, this.resolveLinkViewMode(rawHref, label));
      const currentKind = String(linkMark.attrs?.['data-app-link-kind'] ?? '');
      const currentView = String(linkMark.attrs?.['data-app-link-view'] ?? '');
      const currentTarget = String(linkMark.attrs?.['target'] ?? '');
      const currentRel = String(linkMark.attrs?.['rel'] ?? '');
      const shouldUpdate =
        currentKind !== desiredAttrs['data-app-link-kind'] ||
        currentView !== desiredAttrs['data-app-link-view'] ||
        currentTarget !== desiredAttrs.target ||
        currentRel !== desiredAttrs.rel;
      if (!shouldUpdate) return;
      const from = position;
      const to = position + node.nodeSize;
      tr.removeMark(from, to, linkMark.type);
      tr.addMark(from, to, linkMark.type.create({ ...linkMark.attrs, ...desiredAttrs }));
      changed = true;
    });
    if (changed) {
      this.editor.view.dispatch(tr);
    }
  }

  private async syncSpaceLinkIcons(): Promise<void> {
    if (!this.editor) return;
    if (!this.spacesCache) {
      await this.getSpacesCached();
    }
    const root = this.editor.view.dom;
    if (!(root instanceof HTMLElement)) return;
    const anchors = root.querySelectorAll<HTMLAnchorElement>('a[data-app-link-kind="space"], a[href*="?space="]');
    anchors.forEach((anchor) => {
      const href = anchor.getAttribute('href')?.trim() ?? '';
      const spaceId = this.extractSpaceIdFromHref(href);
      if (spaceId === null) {
        anchor.style.removeProperty('--space-link-icon-mask');
        return;
      }
      const avatarKey = this.spaceAvatarKeyById.get(spaceId) ?? 1;
      const mask = this.spaceAvatarMaskDataUrl(avatarKey);
      anchor.style.setProperty('--space-link-icon-mask', `url("${mask}")`);
    });
  }

  private spaceAvatarMaskDataUrl(avatarKey: number): string {
    const path = SPACE_AVATAR_PATH_BY_KEY.get(avatarKey) ?? SPACE_AVATAR_OPTIONS[0]?.path ?? '';
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 640 640'><path fill='black' d='${path}'/></svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }

  private async enhanceOneInternalLink(): Promise<boolean> {
    if (!this.editor) return false;
    const state = this.editor.state;
    const doc = state.doc;
    const holder: {
      value: { from: number; to: number; text: string; href: string; originalMarks: readonly ProseMirrorMark[] } | null;
    } = { value: null };

    doc.descendants((node, position) => {
      if (holder.value || !node.isText || typeof node.text !== 'string') return;
      const linkMark = node.marks.find((mark) => mark.type.name === 'link');
      if (!linkMark) return;
      const rawHref = typeof linkMark.attrs?.['href'] === 'string' ? String(linkMark.attrs['href']).trim() : '';
      if (!rawHref) return;
      if (!this.isLikelyInternalHref(rawHref)) return;
      const from = position;
      const to = position + node.nodeSize;
      const currentText = node.text;
      holder.value = {
        from,
        to,
        text: currentText,
        href: rawHref,
        originalMarks: node.marks,
      };
    });
    const next = holder.value;
    if (!next) return false;

    const presentation = await this.resolveInternalLinkPresentation(next.href);
    if (!presentation) return false;
    const shouldSwapText = this.looksLikeUrlText(next.text, next.href);
    const desiredText = shouldSwapText ? presentation.label : next.text;
    const desiredHref = presentation.href;
    if (desiredText === next.text && desiredHref === next.href) return false;

    const tr = state.tr;
    const marks = next.originalMarks.map((mark: ProseMirrorMark) =>
      mark.type.name === 'link'
        ? mark.type.create(this.buildLinkAttrs(desiredHref, this.resolveLinkViewMode(desiredHref, desiredText)))
        : mark
    );
    tr.replaceWith(next.from, next.to, state.schema.text(desiredText, marks));
    this.editor.view.dispatch(tr);
    return true;
  }

  private isLikelyInternalHref(href: string): boolean {
    const lower = href.toLowerCase();
    return (
      lower.includes('/home/notes/') ||
      lower.includes('/notes/') ||
      lower.includes('/home/spaces/') ||
      lower.includes('/spaces/') ||
      lower.includes('/home?space=') ||
      lower.includes('localhost') ||
      lower.startsWith('/home')
    );
  }

  private looksLikeUrlText(text: string, href: string): boolean {
    const trimmed = text.trim();
    const normalizedHref = href.trim();
    if (!trimmed) return true;
    if (trimmed === normalizedHref) return true;
    if (trimmed === decodeURIComponent(normalizedHref)) return true;
    return /^https?:\/\//i.test(trimmed) || trimmed.startsWith('localhost');
  }

  private async resolveInternalLinkPresentation(
    rawHref: string
  ): Promise<{ href: string; label: string } | null> {
    const noteId = this.extractNoteIdFromHref(rawHref);
    if (!noteId) {
      const spaceId = this.extractSpaceIdFromHref(rawHref);
      if (!spaceId) return null;
      const spaces = await this.getSpacesCached();
      const targetSpace = spaces.find((space) => space.id === spaceId) ?? null;
      const label = targetSpace?.name?.trim() ? targetSpace.name.trim() : `space-${spaceId}`;
      const spaceToken = targetSpace ? buildSpaceToken(targetSpace) : this.buildSpaceTokenById(spaceId);
      return { href: `/home?space=${spaceToken}`, label };
    }

    const note = await this.getNoteCached(noteId);
    if (note?.is_about_note) {
      const aboutSpace = await this.findSpaceByAboutNoteId(noteId);
      if (aboutSpace) {
        return {
          href: `/home?space=${buildSpaceToken(aboutSpace)}`,
          label: aboutSpace.name,
        };
      }
    }

    const label = note?.title?.trim() ? note.title.trim() : `Note ${noteId.slice(0, 8)}`;
    const noteToken = note ? buildNoteToken(note) : `${noteId.slice(0, 8)}--${noteId}`;
    const space = note ? await this.findSpaceForFolderId(note.folder_id) : null;
    const query = space ? `?space=${buildSpaceToken(space)}` : '';
    return {
      href: `/home/notes/${noteToken}${query}`,
      label,
    };
  }

  private extractNoteIdFromHref(rawHref: string): string | null {
    const normalized = this.asAbsoluteUrl(rawHref);
    const candidates = [normalized.pathname, normalized.hash.startsWith('#') ? normalized.hash.slice(1) : normalized.hash];
    for (const candidate of candidates) {
      const match = candidate.match(/\/home\/notes\/([^/?#]+)/i) ?? candidate.match(/\/notes\/([^/?#]+)/i);
      if (match?.[1]) return parseNoteIdToken(match[1]);
    }
    return null;
  }

  private extractSpaceIdFromHref(rawHref: string): number | null {
    const normalized = this.asAbsoluteUrl(rawHref);
    const spaces = this.spacesCache ?? [];
    const direct = resolveSpaceIdToken(normalized.searchParams.get('space'), spaces);
    if (direct !== null) return direct;
    const pathMatch = normalized.pathname.match(/\/home\/spaces\/(\d+)(?:[/?#]|$)/i) ?? normalized.pathname.match(/\/spaces\/(\d+)(?:[/?#]|$)/i);
    if (pathMatch?.[1]) {
      const pathSpace = Number.parseInt(pathMatch[1], 10);
      if (Number.isFinite(pathSpace)) return pathSpace;
    }
    const hash = normalized.hash.startsWith('#') ? normalized.hash.slice(1) : normalized.hash;
    const hashUrl = hash.startsWith('/home') ? new URL(`https://local${hash}`) : null;
    if (hashUrl) {
      const hashSpace = resolveSpaceIdToken(hashUrl.searchParams.get('space'), spaces);
      if (hashSpace !== null) return hashSpace;
    }
    return null;
  }

  private asAbsoluteUrl(rawHref: string): URL {
    try {
      return new URL(rawHref);
    } catch {
      return new URL(rawHref, window.location.origin);
    }
  }

  private async getNoteCached(noteId: string): Promise<Note | null> {
    if (this.noteCache.has(noteId)) return this.noteCache.get(noteId) ?? null;
    try {
      const note = await firstValueFrom(this.notesService.get(noteId));
      this.noteCache.set(noteId, note);
      return note;
    } catch {
      this.noteCache.set(noteId, null);
      return null;
    }
  }

  private async getSpacesCached(): Promise<Space[]> {
    if (this.spacesCache) return this.spacesCache;
    try {
      const spaces = await firstValueFrom(this.spacesService.list());
      this.spacesCache = spaces;
      this.aboutSpaceByNoteId.clear();
      this.spaceAvatarKeyById.clear();
      for (const space of spaces) {
        if (space.about_note_id) {
          this.aboutSpaceByNoteId.set(space.about_note_id, space);
        }
        this.spaceAvatarKeyById.set(space.id, space.avatar_key ?? 1);
      }
      return spaces;
    } catch {
      this.spacesCache = [];
      this.spaceAvatarKeyById.clear();
      return [];
    }
  }

  private async getFoldersCached(): Promise<Folder[]> {
    if (this.foldersCache) return this.foldersCache;
    try {
      const folders = await firstValueFrom(this.foldersService.getTree());
      this.foldersCache = folders;
      return folders;
    } catch {
      this.foldersCache = [];
      return [];
    }
  }

  private async findSpaceForFolderId(folderId: number): Promise<Space | null> {
    const [spaces, folders] = await Promise.all([this.getSpacesCached(), this.getFoldersCached()]);
    const folderMap = new Map(folders.map((folder) => [folder.id, folder]));
    let current = folderMap.get(folderId) ?? null;
    while (current) {
      const space = spaces.find((candidate) => candidate.root_folder_id === current!.id);
      if (space) return space;
      if (current.parent_id == null) return null;
      current = folderMap.get(current.parent_id) ?? null;
    }
    return null;
  }

  private buildSpaceTokenById(spaceId: number): string {
    const known = (this.spacesCache ?? []).find((space) => space.id === spaceId);
    return known ? buildSpaceToken(known) : `space-${spaceId}--${spaceId}`;
  }

  private async findSpaceByAboutNoteId(noteId: string): Promise<Space | null> {
    if (this.aboutSpaceByNoteId.has(noteId)) {
      return this.aboutSpaceByNoteId.get(noteId) ?? null;
    }
    const spaces = await this.getSpacesCached();
    return spaces.find((space) => space.about_note_id === noteId) ?? null;
  }

  private inferLinkKind(href: string): FocusedLinkState['kind'] {
    if (this.extractNoteIdFromHref(href)) return 'note';
    if (this.extractSpaceIdFromHref(href) !== null) return 'space';
    return 'external';
  }

  private handleEditorContextMenu(event: Event): boolean {
    if (!(event instanceof MouseEvent) || !this.editor) {
      return false;
    }
    const anchor = this.closestLinkAnchor(event.target instanceof Node ? event.target : null);
    if (!anchor) return false;
    const href = anchor.getAttribute('href')?.trim();
    if (!href) return false;
    event.preventDefault();
    return this.openFocusedLinkMenuFromAnchor(anchor, {
      left: Math.min(window.innerWidth - 220, Math.max(12, event.clientX + 10)),
      top: Math.min(window.innerHeight - 64, Math.max(12, event.clientY + 10)),
    });
  }

  private openFocusedLinkMenuFromAnchor(anchor: HTMLAnchorElement, anchorPoint?: { left: number; top: number }): boolean {
    this.cancelLinkMenuHideTimer();
    const nextMenu = this.buildFocusedLinkState(anchor, anchorPoint);
    if (!nextMenu) {
      this.hideFocusedLinkMenu(true);
      return false;
    }
    this.focusedLinkMenu.set(nextMenu);
    return true;
  }

  private handleEditorMouseMove(event: Event): boolean {
    if (!(event instanceof MouseEvent) || this.editorEnabled()) {
      return false;
    }
    const anchor = this.closestLinkAnchor(event.target instanceof Node ? event.target : null);
    if (!anchor) {
      if (!this.linkMenuHovered) {
        this.scheduleLinkMenuHide();
      }
      return false;
    }
    this.linkMenuHovered = false;
    return this.openFocusedLinkMenuFromAnchor(anchor);
  }

  private handleEditorMouseLeave(_event: Event): boolean {
    if (!this.editorEnabled()) {
      if (!this.linkMenuHovered) {
        this.scheduleLinkMenuHide();
      }
    }
    return false;
  }

  private normalizeLinkHref(rawHref: string): string | null {
    const trimmed = rawHref.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('/') || trimmed.startsWith('#')) {
      return trimmed;
    }
    const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    try {
      const parsed = new URL(withProtocol);
      if (!['http:', 'https:'].includes(parsed.protocol)) return null;
      return parsed.toString();
    } catch {
      return null;
    }
  }

  private getDefaultLinkEditorPosition(): { left: number; top: number } {
    const rect = this.hostElement.nativeElement.getBoundingClientRect();
    return {
      left: Math.min(window.innerWidth - 360, Math.max(12, rect.left + 32)),
      top: Math.min(window.innerHeight - 220, Math.max(12, rect.top + 110)),
    };
  }

  private fallbackLinkLabel(href: string): string {
    if (!href.startsWith('http')) return href;
    try {
      return new URL(href).hostname;
    } catch {
      return href;
    }
  }

  private convertMarkupLinksInDoc(doc: JSONContent): JSONContent {
    const convertNode = (node: JSONContent): JSONContent[] => {
      if (node.type === 'codeBlock') return [node];
      if (node.type === 'text' && typeof node.text === 'string') {
        const marks = node.marks ?? [];
        if (marks.some((mark) => mark.type === 'code' || mark.type === 'link')) {
          return [node];
        }
        const tokens = splitMarkupLinkText(node.text);
        if (!tokens.some((token) => token.kind === 'link')) {
          return [node];
        }
        const nonLinkMarks = marks.filter((mark) => mark.type !== 'link');
        const transformed: JSONContent[] = [];
        for (const token of tokens) {
          if (token.kind === 'text') {
            if (!token.value) continue;
            transformed.push({
              type: 'text',
              text: token.value,
              ...(nonLinkMarks.length ? { marks: nonLinkMarks } : {}),
            });
            continue;
          }
          const label = token.value.trim();
          const normalizedHref = this.normalizeLinkHref(token.href ?? '');
          if (!label || !normalizedHref) {
            transformed.push({
              type: 'text',
              text: `[${token.value} | ${token.href ?? ''}]`,
              ...(marks.length ? { marks } : {}),
            });
            continue;
          }
          transformed.push({
            type: 'text',
            text: label,
            marks: [
              ...nonLinkMarks,
              { type: 'link', attrs: this.buildLinkAttrs(normalizedHref, this.resolveLinkViewMode(normalizedHref, label)) },
            ],
          });
        }
        return transformed.length ? transformed : [node];
      }
      const content = node.content ?? [];
      if (!content.length) return [node];
      const nextContent = content.flatMap((child) => convertNode(child));
      return [{ ...node, content: nextContent }];
    };
    return convertNode(doc)[0] ?? doc;
  }

  private resolveLinkViewMode(href: string, label: string): LinkViewMode {
    if (this.inferLinkKind(href) === 'external') return 'text';
    return this.looksLikeUrlText(label, href) ? 'text' : 'inline';
  }

  private buildLinkAttrs(href: string, view: LinkViewMode = 'text'): {
    href: string;
    target: string;
    rel: string;
    'data-app-link-kind': FocusedLinkState['kind'];
    'data-app-link-view': LinkViewMode;
  } {
    const kind = this.inferLinkKind(href);
    const isInternal = kind !== 'external';
    return {
      href,
      target: isInternal ? '_self' : '_blank',
      rel: isInternal ? 'noopener noreferrer' : 'noopener noreferrer nofollow',
      'data-app-link-kind': kind,
      'data-app-link-view': view,
    };
  }

  insertDatabaseSchema(): void {
    const editor = this.activeEditor();
    if (!editor) return;
    const selected = this.selectedDatabaseSchemaState(editor);
    this.databaseSchemaEditorState.set({
      mode: selected ? 'edit' : 'insert',
      position: selected?.position ?? null,
      value: selected?.value ?? createDefaultDatabaseSchemaValue(),
      error: null,
    });
    this.plusMenuOpen.set(false);
    this.saveError.set(null);
  }

  cancelDatabaseSchemaEditor(): void {
    this.databaseSchemaEditorState.set(null);
  }

  submitDatabaseSchemaEditor(value: DatabaseSchemaEditorValue): void {
    const draft = this.databaseSchemaEditorState();
    const editor = this.activeEditor();
    if (!draft || !editor) {
      this.cancelDatabaseSchemaEditor();
      return;
    }

    const title = value.title.trim();
    if (!title) {
      this.databaseSchemaEditorState.update((state) =>
        state ? { ...state, error: 'Please enter a schema title.' } : state
      );
      return;
    }
    const normalizedValue: DatabaseSchemaEditorValue = {
      ...value,
      title,
      view: value.view as VisualSchemaViewState,
      schema: value.schema as VisualSchemaModel,
    };
    const attrs = toDatabaseSchemaNodeAttrs(normalizedValue);

    if (draft.mode === 'edit' && draft.position !== null) {
      const changed = editor
        .chain()
        .focus()
        .command(({ tr, dispatch }) => {
          const node = tr.doc.nodeAt(draft.position ?? -1);
          if (!node || node.type.name !== DATABASE_SCHEMA_NODE) return false;
          if (dispatch) {
            tr.setNodeMarkup(draft.position ?? -1, undefined, attrs);
          }
          return true;
        })
        .run();
      if (!changed) {
        this.databaseSchemaEditorState.update((state) =>
          state
            ? {
                ...state,
                error: 'Select a database schema block and retry.',
              }
            : state
        );
        return;
      }
    } else {
      editor
        .chain()
        .focus()
        .insertContent({
          type: DATABASE_SCHEMA_NODE,
          attrs,
        })
        .run();
    }

    this.cancelDatabaseSchemaEditor();
    this.queueSelectionVersionUpdate();
  }

  insertCodeBlock(language: string): void {
    const editor = this.activeEditor();
    if (!editor) return;
    const normalizedLanguage = normalizeCodeLanguage(language);
    editor
      .chain()
      .focus()
      .insertContent({
        type: 'codeBlock',
        attrs: { language: normalizedLanguage },
        content: [],
      })
      .run();
    this.plusMenuOpen.set(false);
  }

  private currentDocSignature(doc: JSONContent | null | undefined): string {
    return JSON.stringify(doc ?? emptyDoc());
  }

  private async restoreDraftFromServer(
    noteId: string,
    persistedDoc: JSONContent,
    requestVersion: number
  ): Promise<void> {
    const draft = await this.unsavedChanges.readDraft(noteId);
    if (requestVersion !== this.draftRequestVersion) return;
    if (this.note().id !== noteId) return;
    const shouldRestoreDraft =
      !!draft &&
      this.currentDocSignature(draft) !== this.currentDocSignature(persistedDoc);
    if (!shouldRestoreDraft || !draft) return;
    this.editorDoc = draft;
    this.restoreDraftOnMount = true;
    this.hasUnsavedChanges.set(true);
    if (this.canEdit()) {
      this.setEditingState(true);
    }
    if (this.editorHost) {
      this.requestMountEditor(draft, true);
    }
  }

  private refreshUnsavedState(): void {
    if (!this.editor || this.suppressUpdates) return;
    const editorDoc = this.editor.getJSON();
    const dirty =
      this.currentDocSignature(editorDoc) !== this.currentDocSignature(this.pendingDoc);
    this.hasUnsavedChanges.set(dirty);
    if (dirty) {
      this.unsavedChanges.saveDraft(this.note().id, editorDoc);
      this.saveError.set(null);
    } else {
      this.unsavedChanges.clearDraft(this.note().id);
    }
  }

  private readPersistError(err: unknown, fallback: string): string {
    if (typeof err === 'object' && err !== null) {
      const candidate = (err as { error?: { error?: string }; message?: string }).error?.error;
      if (typeof candidate === 'string' && candidate.trim()) return candidate;
      if (typeof (err as { message?: string }).message === 'string' && (err as { message: string }).message.trim()) {
        return (err as { message: string }).message;
      }
    }
    return fallback;
  }

  private async flushPendingChanges(): Promise<boolean> {
    if (!this.hasUnsavedChanges()) return true;
    return this.persist();
  }

  private mountEditor(doc: JSONContent, preserveDirty = false): void {
    const host = this.editorHost?.nativeElement;
    if (!host) return;
    this.focusedLinkMenu.set(null);
    if (this.editor) {
      this.editor.destroy();
      this.editor = null;
    }
    this.suppressUpdates = true;
    const initialContent = this.convertMarkupLinksInDoc(doc);
    this.editor = new Editor({
      element: host,
      editable: this.editorEnabled(),
      content: initialContent,
      extensions: [
        StarterKit.configure({
          codeBlock: false,
          link: false,
          underline: false,
        }),
        RichCodeBlock.configure({
          lowlight,
          languageClassPrefix: 'language-',
          defaultLanguage: 'plaintext',
          exitOnTripleEnter: false,
          exitOnArrowDown: true,
        }),
        Underline,
        AppLink.configure({
          openOnClick: false,
          autolink: true,
          linkOnPaste: true,
          defaultProtocol: 'https',
        }),
        Subscript,
        Superscript,
        TextAlign.configure({
          types: ['heading', 'paragraph'],
        }),
        TextStyle,
        Color,
        Highlight.configure({
          multicolor: true,
        }),
        Image.configure({
          inline: false,
        }),
        TaskList,
        TaskItem.configure({
          nested: true,
        }),
        Table.configure({
          resizable: true,
        }),
        TableRow,
        TableHeader,
        TableCell,
        Placeholder.configure({
          placeholder: 'Start typing or use tools to insert content',
          showOnlyCurrent: false,
          showOnlyWhenEditable: true,
        }),
        Selection.configure({
          className: 'selection',
        }),
        DatabaseSchemaNode,
      ],
      editorProps: {
        attributes: {
          class: 'unified-note-editor',
        },
        handleKeyDown: (_view, event) => this.handleEditorShortcuts(event),
        handleDOMEvents: {
          mousemove: (_view, event) => this.handleEditorMouseMove(event),
          mouseleave: (_view, event) => this.handleEditorMouseLeave(event),
          contextmenu: (_view, event) => this.handleEditorContextMenu(event),
        },
      },
      onUpdate: () => {
        this.refreshUnsavedState();
        this.queueSelectionVersionUpdate();
        this.queueSyncLinkAttrs();
        this.queueSyncSpaceLinkIcons();
      },
      onSelectionUpdate: () => {
        this.queueSelectionVersionUpdate();
      },
      onTransaction: () => {
        this.queueSelectionVersionUpdate();
      },
    });
    queueMicrotask(() => {
      this.suppressUpdates = false;
      this.syncEditorModeClass();
      this.queueSyncLinkAttrs();
      this.queueSyncSpaceLinkIcons();
      this.hasUnsavedChanges.set(preserveDirty);
      this.saveError.set(null);
      this.queueSelectionVersionUpdate();
      const q = this.route.snapshot.queryParamMap.get('q');
      if (q?.trim()) {
        setTimeout(() => this.scrollToFirstMatch(q.trim()), 100);
      } else {
        this.queueModeScrollAlignment();
      }
    });
  }

  private syncEditorModeClass(): void {
    const root = this.editor?.view.dom;
    if (!(root instanceof HTMLElement)) return;
    root.classList.add('unified-note-editor');
    root.style.paddingTop = '0';
  }

  private queueModeScrollAlignment(): void {
    if (this.modeScrollFrameId !== null) {
      window.cancelAnimationFrame(this.modeScrollFrameId);
      this.modeScrollFrameId = null;
    }
    this.modeScrollFrameId = window.requestAnimationFrame(() => {
      this.modeScrollFrameId = window.requestAnimationFrame(() => {
        this.modeScrollFrameId = null;
        this.applyModeScrollAlignment();
      });
    });
  }

  private applyModeScrollAlignment(): void {
    const targets = this.collectScrollTargets();
    if (!targets.length) return;
    const target = targets[0].scrollTop;
    for (const container of targets) {
      container.scrollTop = target;
    }
  }

  private resolveSecondLineOffset(): number {
    const root = this.editor?.view.dom;
    if (!(root instanceof HTMLElement)) return 24;
    const lineHeight = Number.parseFloat(getComputedStyle(root).lineHeight);
    return Number.isFinite(lineHeight) && lineHeight > 0 ? Math.round(lineHeight) : 24;
  }

  private collectScrollTargets(): HTMLElement[] {
    const targets: HTMLElement[] = [];
    const pushUnique = (element: HTMLElement | null | undefined): void => {
      if (!element) return;
      if (!targets.includes(element)) targets.push(element);
    };

    const surface = this.editorSurface?.nativeElement;
    if (surface instanceof HTMLElement) {
      pushUnique(surface);
    }

    const root = this.editor?.view.dom;
    if (root instanceof HTMLElement) {
      let current: HTMLElement | null = root.parentElement;
      while (current) {
        if (this.isScrollable(current)) {
          pushUnique(current);
          // First scrollable ancestor is usually the active container.
          break;
        }
        current = current.parentElement;
      }
    }

    const scrollingElement = document.scrollingElement;
    if (scrollingElement instanceof HTMLElement) {
      pushUnique(scrollingElement);
    }
    return targets;
  }

  private isScrollable(element: HTMLElement): boolean {
    const style = getComputedStyle(element);
    const overflowY = style.overflowY;
    const allowsScroll = overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay';
    return allowsScroll && element.scrollHeight > element.clientHeight;
  }

  private persist(onSuccess?: () => void): Promise<boolean> {
    if (!this.editor) return Promise.resolve(false);
    if (this.currentPersistPromise) return this.currentPersistPromise;
    const note = this.note();
    const rawDoc = this.editor.getJSON();
    const nextDoc = this.convertMarkupLinksInDoc(rawDoc);
    const payload = {
      doc: nextDoc,
    };
    this.isSaving.set(true);
    this.saveError.set(null);
    const persist$ = this.bodyBlockId
      ? this.notesService.updateBlock(note.id, this.bodyBlockId, {
          type: RICH_TEXT_BLOCK_TYPE,
          position: '1',
          data: payload,
        })
      : this.notesService.createBlock(note.id, RICH_TEXT_BLOCK_TYPE, '1', payload);
    this.currentPersistPromise = new Promise<boolean>((resolve) => {
      persist$.subscribe({
        next: (block) => {
          this.bodyBlockId = block.id;
          const staleIds = this.legacyBlockIds.filter((id) => id !== block.id);
          const cleanup$ = staleIds.length
            ? forkJoin(staleIds.map((id) => this.notesService.deleteBlock(note.id, id)))
            : of([]);
          cleanup$.subscribe({
            next: () => {
              this.pendingDoc = nextDoc;
              this.editorDoc = nextDoc;
              this.readonlyDocBeforeEdit = null;
              this.legacyBlockIds = [];
              this.hasUnsavedChanges.set(false);
              this.unsavedChanges.clearDraft(note.id);
              this.updatedAtChange.emit(new Date().toISOString());
              this.isSaving.set(false);
              onSuccess?.();
              resolve(true);
            },
            error: (err) => {
              this.saveError.set(this.readPersistError(err, 'Failed to finish saving changes'));
              this.isSaving.set(false);
              resolve(false);
            },
          });
        },
        error: (err) => {
          this.saveError.set(this.readPersistError(err, 'Failed to save changes'));
          this.isSaving.set(false);
          resolve(false);
        },
      });
    }).finally(() => {
      this.currentPersistPromise = null;
    });
    return this.currentPersistPromise;
  }

  private scrollToFirstMatch(q: string): void {
    const root = this.editor?.view.dom;
    if (!root) return;
    const lower = q.toLowerCase();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let current = walker.nextNode();
    while (current) {
      if ((current.textContent ?? '').toLowerCase().includes(lower)) {
        const parent = current.parentElement ?? root;
        parent.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      current = walker.nextNode();
    }
  }

  private closeToolbarMenus(): void {
    this.headingMenuOpen.set(false);
    this.formatMenuOpen.set(false);
    this.alignMenuOpen.set(false);
    this.colorMenuOpen.set(false);
    this.tableMenuOpen.set(false);
    this.plusMenuOpen.set(false);
    this.tablePreview.set(null);
  }

  private dismissTransientOverlays(): void {
    if (this.activeUsersOpen()) {
      this.activeUsersOpen.set(false);
    }
    if (this.hasOpenToolbarMenu()) {
      this.closeToolbarMenus();
    }
    if (this.focusedLinkMenu()) {
      this.hideFocusedLinkMenu(true);
    }
    if (this.linkEditorState()) {
      this.cancelLinkEditor();
    }
    if (this.databaseSchemaEditorState()) {
      this.cancelDatabaseSchemaEditor();
    }
  }

  private shouldKeepOverlayOpenForTarget(target: Node): boolean {
    if (!(target instanceof Element)) return false;
    return (
      target.closest('.toolbar-popover') !== null ||
      target.closest('.link-focus-menu') !== null ||
      target.closest('.link-editor-popover') !== null ||
      target.closest('app-database-schema-editor') !== null ||
      target.closest('.schema-visual-shell') !== null ||
      target.closest('.schema-editor-popover') !== null ||
      target.closest('.note-active-users') !== null ||
      target.closest('.note-active-users-popover') !== null
    );
  }
}
