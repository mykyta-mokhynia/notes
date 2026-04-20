import { Component, OnInit, OnDestroy, signal, inject, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NotesService, Note, NoteBlock } from '../../core/api/notes.service';
import { SpacesService, Space } from '../../core/api/spaces.service';
import { FoldersService, Folder } from '../../core/api/folders.service';
import { RecentService } from '../../core/sidebar/recent.service';
import { FavouriteService } from '../../core/sidebar/favourite.service';
import { CommonModule } from '@angular/common';
import { firstValueFrom, Subscription } from 'rxjs';
import { ViewerAccessService } from '../../core/access/viewer-access.service';
import { UnifiedNoteEditorComponent } from './unified-note-editor';
import { buildNoteToken, buildSpaceToken, parseNoteIdToken } from '../note-links';

@Component({
  selector: 'app-note-editor',
  standalone: true,
  imports: [CommonModule, UnifiedNoteEditorComponent],
  templateUrl: './note-editor.html',
  styleUrl: './note-editor.scss',
})
export class NoteEditorComponent implements OnInit, OnDestroy {
  protected readonly access = inject(ViewerAccessService);
  @ViewChild(UnifiedNoteEditorComponent) private unifiedEditor?: UnifiedNoteEditorComponent;
  note = signal<Note | null>(null);
  blocks = signal<NoteBlock[]>([]);
  titleDraft = signal('');
  visibilityDraft = signal<'PUBLIC' | 'PRIVATE'>('PRIVATE');
  titleSaving = signal(false);
  isEditorEditing = signal(false);
  loading = signal(true);
  error = signal<string | null>(null);
  private sub?: Subscription;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private notesService: NotesService,
    private spacesService: SpacesService,
    private foldersService: FoldersService,
    private recentService: RecentService,
    private favouriteService: FavouriteService
  ) {}

  ngOnInit(): void {
    this.sub = this.route.paramMap.subscribe((params) => {
      const id = parseNoteIdToken(params.get('id'));
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
        this.titleDraft.set(n.title ?? '');
        this.visibilityDraft.set(n.visibility);
        this.isEditorEditing.set(false);
        void this.ensurePrettyRoute(n);
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

  handleEditingChange(isEditing: boolean): void {
    this.isEditorEditing.set(isEditing);
    const current = this.note();
    if (current) {
      this.titleDraft.set(current.title ?? '');
      this.visibilityDraft.set(current.visibility);
    }
  }

  updateTitleDraft(value: string): void {
    this.titleDraft.set(value);
  }

  handleTitleInputKeydown(event: KeyboardEvent): void {
    if (!this.isEditorEditing()) return;
    const key = event.key.toLowerCase();
    const isModPressed = event.metaKey || event.ctrlKey;
    if (isModPressed && key === 's') {
      event.preventDefault();
      void this.unifiedEditor?.updateEditing();
      return;
    }
    if (!isModPressed && !event.altKey && !event.shiftKey && key === 'escape') {
      event.preventDefault();
      this.unifiedEditor?.cancelEditing();
    }
  }

  setVisibilityDraft(value: 'PUBLIC' | 'PRIVATE'): void {
    this.visibilityDraft.set(value);
  }

  saveHeaderOnUpdate(): void {
    if (!this.access.canEdit() || this.titleSaving()) return;
    const current = this.note();
    if (!current) return;
    const newTitle = this.titleDraft().trim();
    const newVisibility = this.visibilityDraft();
    if (!newTitle) {
      this.titleDraft.set(current.title ?? '');
      this.visibilityDraft.set(current.visibility);
      return;
    }
    const changedTitle = newTitle !== current.title;
    const changedVisibility = newVisibility !== current.visibility;
    if (!changedTitle && !changedVisibility) {
      return;
    }
    this.titleSaving.set(true);
    this.notesService.update(current.id, { title: newTitle, visibility: newVisibility }).subscribe({
      next: (updated) => {
        this.note.set(updated);
        this.titleDraft.set(updated.title ?? '');
        this.visibilityDraft.set(updated.visibility);
        void this.ensurePrettyRoute(updated);
        this.recentService.add(updated.id, updated.title);
        this.titleSaving.set(false);
      },
      error: () => {
        this.titleDraft.set(current.title ?? '');
        this.visibilityDraft.set(current.visibility);
        this.titleSaving.set(false);
        alert('Failed to update note details');
      },
    });
  }

  private async ensurePrettyRoute(note: Note): Promise<void> {
    const currentToken = this.route.snapshot.paramMap.get('id') ?? '';
    const currentResolvedNoteId = parseNoteIdToken(currentToken);
    if (currentResolvedNoteId !== note.id) {
      return;
    }
    const desiredToken = buildNoteToken(note);
    const currentQuery = this.route.snapshot.queryParamMap;

    const [spaces, folders] = await Promise.all([
      firstValueFrom(this.spacesService.list()),
      firstValueFrom(this.foldersService.getTree()),
    ]);
    const targetSpace = this.findSpaceForFolder(note.folder_id, spaces, folders);
    const desiredSpaceToken = targetSpace ? buildSpaceToken(targetSpace) : null;
    const nextQueryParams: Record<string, string> = {};
    for (const key of currentQuery.keys) {
      if (key === 'space') continue;
      const value = currentQuery.get(key);
      if (value != null) {
        nextQueryParams[key] = value;
      }
    }
    if (desiredSpaceToken) {
      nextQueryParams['space'] = desiredSpaceToken;
    }
    const currentSpace = currentQuery.get('space');
    if (currentToken === desiredToken && currentSpace === desiredSpaceToken) {
      return;
    }
    await this.router.navigate(['/home', 'notes', desiredToken], {
      queryParams: nextQueryParams,
      replaceUrl: true,
    });
  }

  private findSpaceForFolder(folderId: number, spaces: Space[], folders: Folder[]): Space | null {
    const folderMap = new Map(folders.map((folder) => [folder.id, folder]));
    let current = folderMap.get(folderId) ?? null;
    while (current) {
      const space = spaces.find((candidate) => candidate.root_folder_id === current!.id);
      if (space) {
        return space;
      }
      if (current.parent_id == null) {
        return null;
      }
      current = folderMap.get(current.parent_id) ?? null;
    }
    return null;
  }

}
