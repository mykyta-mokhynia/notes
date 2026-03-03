import { Component, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NotesService, Note, NoteBlock } from '../../core/api/notes.service';
import { RecentService } from '../../core/sidebar/recent.service';
import { FavouriteService } from '../../core/sidebar/favourite.service';
import { CommonModule } from '@angular/common';
import { BlockTextComponent } from './block-text/block-text';
import { BlockCodeComponent } from './block-code/block-code';
import { NoteReferenceCardComponent } from './note-reference-card/note-reference-card';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-note-editor',
  standalone: true,
  imports: [CommonModule, BlockTextComponent, BlockCodeComponent, NoteReferenceCardComponent],
  templateUrl: './note-editor.html',
  styleUrl: './note-editor.scss',
})
export class NoteEditorComponent implements OnInit, OnDestroy {
  note = signal<Note | null>(null);
  blocks = signal<NoteBlock[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  private sub?: Subscription;

  sortedBlocks = computed(() => {
    const list = this.blocks();
    return [...list].sort(
      (a, b) => parseFloat(a.position) - parseFloat(b.position)
    );
  });

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private notesService: NotesService,
    private recentService: RecentService,
    private favouriteService: FavouriteService
  ) {}

  ngOnInit(): void {
    this.sub = this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) this.loadNote(id);
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  loadNote(id: string): void {
    this.loading.set(true);
    this.error.set(null);
    this.notesService.get(id).subscribe({
      next: (n: Note) => {
        this.note.set(n);
        this.recentService.add(n.id, n.title);
        if (this.favouriteService.isNoteFavourite(n.id)) {
          this.favouriteService.setNoteLastVisited(n.id, Date.now());
        }
        this.loadBlocks(id);
      },
      error: (err: { message?: string }) => {
        this.error.set(err?.message ?? 'Failed to load note');
        this.loading.set(false);
      },
    });
  }

  loadBlocks(noteId: string): void {
    this.notesService.listBlocks(noteId).subscribe({
      next: (list: NoteBlock[]) => {
        this.blocks.set(list);
        this.loading.set(false);
        const q = this.route.snapshot.queryParamMap.get('q');
        if (q?.trim()) setTimeout(() => this.scrollToFirstMatch(q.trim()), 100);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  private getBlockSearchText(block: NoteBlock): string {
    const d = block.data ?? {};
    if (block.type === 'text') {
      if (typeof d['content'] === 'string') return d['content'];
      const doc = d['doc'] as { content?: Array<{ text?: string; content?: Array<{ text?: string }> }> } | undefined;
      if (doc?.content) {
        const parts: string[] = [];
        for (const node of doc.content) {
          if (node.text) parts.push(node.text);
          for (const c of node.content ?? []) {
            if (typeof (c as { text?: string }).text === 'string') parts.push((c as { text: string }).text);
          }
        }
        return parts.join(' ');
      }
      return '';
    }
    if (block.type === 'code' && typeof d['raw_code'] === 'string') return d['raw_code'];
    return '';
  }

  private scrollToFirstMatch(q: string): void {
    const list = this.blocks();
    const lower = q.toLowerCase();
    for (const block of list) {
      const text = this.getBlockSearchText(block).toLowerCase();
      if (text.includes(lower)) {
        const el = document.querySelector(`[data-block-id="${block.id}"]`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        return;
      }
    }
  }

  onBlockContentChange(block: NoteBlock, data: Record<string, unknown>): void {
    this.notesService
      .updateBlock(block.note_id, block.id, { data })
      .subscribe({
        next: (updated: NoteBlock) => {
          this.blocks.update((list) =>
            list.map((b) => (b.id === updated.id ? updated : b))
          );
        },
      });
  }

  getNoteLinkTarget(block: NoteBlock): string {
    const v = block.data?.['target_note_id'];
    return typeof v === 'string' ? v : '';
  }

  getNoteLinkDisplay(block: NoteBlock): 'card' | 'inline' {
    const v = block.data?.['display'];
    return v === 'inline' ? 'inline' : 'card';
  }

  moveBlockUp(block: NoteBlock): void {
    const list = this.sortedBlocks();
    const idx = list.findIndex((b) => b.id === block.id);
    if (idx <= 0) return;
    const prev = list[idx - 1];
    const newPos = (parseFloat(prev.position) + parseFloat(block.position)) / 2;
    this.notesService.updateBlock(block.note_id, block.id, { position: String(newPos) }).subscribe({
      next: (updated) => {
        this.blocks.update((list) => list.map((b) => (b.id === updated.id ? updated : b)));
      },
    });
  }

  moveBlockDown(block: NoteBlock): void {
    const list = this.sortedBlocks();
    const idx = list.findIndex((b) => b.id === block.id);
    if (idx < 0 || idx >= list.length - 1) return;
    const next = list[idx + 1];
    const newPos = (parseFloat(block.position) + parseFloat(next.position)) / 2;
    this.notesService.updateBlock(block.note_id, block.id, { position: String(newPos) }).subscribe({
      next: (updated) => {
        this.blocks.update((list) => list.map((b) => (b.id === updated.id ? updated : b)));
      },
    });
  }

  rebalanceBlocks(): void {
    const n = this.note();
    if (!n) return;
    this.notesService.rebalanceBlocks(n.id).subscribe({
      next: () => this.loadBlocks(n.id),
    });
  }

  addBlock(type: string, data: Record<string, unknown> = {}): void {
    const n = this.note();
    if (!n) return;
    const list = this.blocks();
    const maxPos =
      list.length === 0
        ? 1
        : Math.max(...list.map((b) => parseFloat(b.position))) + 1;
    this.notesService
      .createBlock(n.id, type, String(maxPos), data)
      .subscribe({
        next: (created: NoteBlock) => {
          this.blocks.update((list) => [...list, created]);
        },
      });
  }

  deleteNote(): void {
    const n = this.note();
    if (!n || n.is_about_note) return;
    if (!confirm('Delete this note?')) return;
    const noteId = n.id;
    this.notesService.delete(noteId).subscribe({
      next: () => {
        this.recentService.remove(noteId);
        this.router.navigate(['/home']);
      },
      error: (err) => alert(err?.error?.error ?? 'Failed to delete note'),
    });
  }
}
