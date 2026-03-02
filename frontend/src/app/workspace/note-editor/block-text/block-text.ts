import {
  Component,
  input,
  output,
  ViewChild,
  ElementRef,
  AfterViewInit,
  OnDestroy,
} from '@angular/core';
import { NoteBlock } from '../../../core/api/notes.service';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';

const DEFAULT_DOC = { type: 'doc' as const, content: [{ type: 'paragraph' }] };

function stringToDoc(s: string): { type: 'doc'; content: unknown[] } {
  if (!s.trim()) return { ...DEFAULT_DOC };
  return {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: s }] }],
  };
}

@Component({
  selector: 'app-block-text',
  standalone: true,
  templateUrl: './block-text.html',
  styleUrl: './block-text.scss',
})
export class BlockTextComponent implements AfterViewInit, OnDestroy {
  @ViewChild('editorHost', { static: true }) editorHost!: ElementRef<HTMLDivElement>;

  block = input.required<NoteBlock>();
  contentChange = output<Record<string, unknown>>();

  private editor: Editor | null = null;
  private emitTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly DEBOUNCE_MS = 400;

  ngAfterViewInit(): void {
    const el = this.editorHost?.nativeElement;
    if (!el) return;
    const data = this.block().data ?? {};
    let content: unknown = DEFAULT_DOC;
    if (data['doc'] && typeof data['doc'] === 'object') {
      content = data['doc'];
    } else if (typeof data['content'] === 'string') {
      content = stringToDoc(data['content']);
    }
    this.editor = new Editor({
      element: el,
      extensions: [StarterKit],
      content: content as Record<string, unknown>,
      editorProps: {
        attributes: { class: 'block-text-editor' },
      },
      onUpdate: ({ editor }) => this.emitDoc(editor.getJSON()),
    });
  }

  ngOnDestroy(): void {
    if (this.emitTimeout) clearTimeout(this.emitTimeout);
    this.emitTimeout = null;
    this.editor?.destroy();
    this.editor = null;
  }

  private emitDoc(doc: unknown): void {
    if (this.emitTimeout) clearTimeout(this.emitTimeout);
    this.emitTimeout = setTimeout(() => {
      this.emitTimeout = null;
      const current = this.editor?.getJSON() ?? doc;
      this.contentChange.emit({ ...this.block().data, doc: current });
    }, this.DEBOUNCE_MS);
  }
}
