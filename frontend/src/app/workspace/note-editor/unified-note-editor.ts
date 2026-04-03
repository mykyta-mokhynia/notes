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
import { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { createLowlight, common } from 'lowlight';
import { ActivatedRoute } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { Note, NoteBlock, NotePresenceUser, NotesService } from '../../core/api/notes.service';
import { AuthService } from '../../core/auth/auth.service';
import { NoteUnsavedChangesService } from './note-unsaved-changes.service';

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
      nodes.push({
        type: DATABASE_SCHEMA_NODE,
        attrs: {
          title: typeof data['title'] === 'string' ? data['title'] : 'Database schema',
          body:
            typeof data['body'] === 'string'
              ? data['body']
              : typeof data['schema'] === 'string'
                ? data['schema']
                : '',
        },
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

const DatabaseSchemaNode = TiptapNode.create({
  name: DATABASE_SCHEMA_NODE,
  group: 'block',
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      title: {
        default: 'Database schema',
        parseHTML: (element) => element.getAttribute('data-title') ?? 'Database schema',
      },
      body: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-body') ?? '',
      },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-database-schema]' }];
  },
  renderHTML({ node }) {
    const title = typeof node.attrs['title'] === 'string' ? node.attrs['title'] : 'Database schema';
    const body = typeof node.attrs['body'] === 'string' ? node.attrs['body'] : '';
    return [
      'div',
      {
        'data-database-schema': 'true',
        'data-title': title,
        'data-body': body,
      },
      [
        'div',
        { class: 'database-schema-card' },
        ['div', { class: 'database-schema-card__eyebrow' }, 'Database schema'],
        ['div', { class: 'database-schema-card__title' }, title],
        ['pre', { class: 'database-schema-card__body' }, body || 'No schema body'],
      ],
    ];
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
  imports: [CommonModule],
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
                  <button type="button" class="toolbar-menu-item" (click)="insertDatabaseSchema()">Database schema</button>
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
  private readonly route = inject(ActivatedRoute);
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

  readonly toolbarIcons = TOOLBAR_ICONS;
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
  private toolbarSelection: { from: number; to: number } | null = null;
  private selectionVersionQueued = false;
  private mountEditorQueued = false;
  private pendingMountRequest: { doc: JSONContent; preserveDirty: boolean } | null = null;
  private readonly isMacPlatform = this.detectMacPlatform();
  private presenceInFlight = false;
  private modeScrollFrameId: number | null = null;
  private lastAppliedEditorMode: boolean | null = null;
  private draftRequestVersion = 0;

  constructor() {
    effect(() => {
      const editable = this.editorEnabled();
      this.editor?.setEditable(editable);
      this.syncEditorModeClass();
      this.queueSelectionVersionUpdate();
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
    this.setEditingState(true);
    this.saveError.set(null);
    this.closeToolbarMenus();
  }

  cancelEditing(): void {
    if (!this.canEdit() || this.isSaving()) return;
    this.setEditingState(false);
    this.closeToolbarMenus();
    this.hasUnsavedChanges.set(false);
    this.saveError.set(null);
    this.unsavedChanges.clearDraft(this.note().id);
    if (this.pendingDoc && this.editorHost) {
      this.editorDoc = this.pendingDoc;
      this.requestMountEditor(this.pendingDoc, false);
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
    if (!this.hasOpenToolbarMenu()) return;
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (this.hostElement.nativeElement.contains(target)) return;
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
    const editor = this.activeEditor();
    if (!editor) return;
    const currentHref = editor.getAttributes('link')['href'];
    const href = window.prompt(
      'Link URL',
      typeof currentHref === 'string' ? currentHref : 'https://'
    );
    if (!href?.trim()) return;
    const activeEditor = this.activeEditor();
    if (!activeEditor) return;
    if (activeEditor.state.selection.empty) {
      const label = window.prompt('Link label', href.trim())?.trim();
      if (!label) return;
      activeEditor
        .chain()
        .focus()
        .insertContent({
          type: 'text',
          text: label,
          marks: [
            {
              type: 'link',
              attrs: {
                href: href.trim(),
                target: '_blank',
                rel: 'noopener noreferrer nofollow',
              },
            },
          ],
        })
        .run();
    } else {
      activeEditor
        .chain()
        .focus()
        .extendMarkRange('link')
        .setLink({
          href: href.trim(),
          target: '_blank',
          rel: 'noopener noreferrer nofollow',
        })
        .run();
    }
    this.closeToolbarMenus();
  }

  insertDatabaseSchema(): void {
    const editor = this.activeEditor();
    if (!editor) return;
    const title = window.prompt('Schema title', 'Database schema')?.trim();
    if (!title) return;
    const body =
      window.prompt(
        'Schema fields / SQL preview',
        'users\\n- id uuid\\n- email text\\n- created_at timestamptz'
      ) ?? '';
    editor
      .chain()
      .focus()
      .insertContent({
        type: DATABASE_SCHEMA_NODE,
        attrs: {
          title,
          body,
        },
      })
      .run();
    this.plusMenuOpen.set(false);
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
    if (this.editor) {
      this.editor.destroy();
      this.editor = null;
    }
    this.suppressUpdates = true;
    this.editor = new Editor({
      element: host,
      editable: this.editorEnabled(),
      content: doc,
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
        Link.configure({
          openOnClick: false,
          autolink: false,
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
          class: `unified-note-editor${this.editorEnabled() ? '' : ' unified-note-editor--readonly'}`,
        },
        handleKeyDown: (_view, event) => this.handleEditorShortcuts(event),
      },
      onUpdate: () => {
        this.refreshUnsavedState();
        this.queueSelectionVersionUpdate();
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
    root.classList.toggle('unified-note-editor--readonly', !this.editorEnabled());
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
    const nextDoc = this.editor.getJSON();
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
}
