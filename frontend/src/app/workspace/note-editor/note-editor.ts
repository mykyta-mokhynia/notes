import { Component, OnInit, OnDestroy, signal, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NotesService, Note, NoteBlock } from '../../core/api/notes.service';
import { RecentService } from '../../core/sidebar/recent.service';
import { FavouriteService } from '../../core/sidebar/favourite.service';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { ViewerAccessService } from '../../core/access/viewer-access.service';
import { UnifiedNoteEditorComponent } from './unified-note-editor';

@Component({
  selector: 'app-note-editor',
  standalone: true,
  imports: [CommonModule, UnifiedNoteEditorComponent],
  templateUrl: './note-editor.html',
  styleUrl: './note-editor.scss',
})
export class NoteEditorComponent implements OnInit, OnDestroy {
  protected readonly access = inject(ViewerAccessService);
  note = signal<Note | null>(null);
  blocks = signal<NoteBlock[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  private sub?: Subscription;

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

  hasPublicCreator(): boolean {
    const current = this.note();
    return current?.visibility === 'PUBLIC' && !!current.creator_nickname;
  }

  creatorLabel(): string {
    const current = this.note();
    return current?.creator_nickname?.trim() || 'Unknown';
  }

  creatorInitials(): string {
    const current = this.note();
    const initials = current?.creator_avatar_initials?.trim();
    if (initials) return initials;
    return this.creatorLabel().slice(0, 2).toUpperCase();
  }

  creatorColor(): string {
    return this.note()?.creator_avatar_color || '#8f9ab3';
  }

  handleBodyUpdatedAt(updatedAt: string): void {
    this.note.update((current) =>
      current
        ? {
            ...current,
            updated_at: updatedAt,
          }
        : current
    );
  }

}
