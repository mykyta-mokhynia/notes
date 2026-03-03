import {
  Component,
  input,
  Input,
  output,
  effect,
  signal,
  computed,
  HostListener,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { NotesService, Note } from '../../core/api/notes.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { NoteDragService } from '../drag/note-drag.service';
import { FavouriteService } from '../../core/sidebar/favourite.service';
import { IconContentComponent } from '../icons/icon-content';
import { IconEllipsisComponent } from '../icons/icon-ellipsis';
import { IconEyeSlashComponent } from '../icons/icon-eye-slash';
import { IconEyeComponent } from '../icons/icon-eye';
import { IconStarEmptyComponent } from '../icons/icon-star-empty';
import { IconStarFullComponent } from '../icons/icon-star-full';
import { IconTrashComponent } from '../icons/icon-trash';

/** Delay before showing loading message (avoids flicker on fast loads). */
const LOADING_MESSAGE_DELAY_MS = 180;

@Component({
  selector: 'app-notes-list',
  standalone: true,
  inputs: ['noteIdBeingRenamed'],
  imports: [
    CommonModule,
    FormsModule,
    DragDropModule,
    IconContentComponent,
    IconEllipsisComponent,
    IconEyeSlashComponent,
    IconEyeComponent,
    IconStarEmptyComponent,
    IconStarFullComponent,
    IconTrashComponent,
  ],
  templateUrl: './notes-list.html',
  styleUrl: './notes-list.scss',
})
export class NotesListComponent {
  folderId = input.required<number>();
  selectNote = output<string>();
  /** When false, the "New note" button is hidden (e.g. when using shared Create dropdown). */
  showCreateButton = input<boolean>(true);
  /** When set, this note is hidden from the list (e.g. About note shown only in About row). */
  excludeNoteId = input<string | null>(null);
  /** When set, this note is shown in rename mode (inline input). */
  @Input() noteIdBeingRenamed: string | null = null;
  /** Emitted when rename is done (submit or cancel) so parent clears noteIdBeingRenamed. */
  noteRenamed = output<void>();

  noteMenuOpenId = signal<string | null>(null);
  noteMenuPosition = signal<{ top: number; left: number } | null>(null);

  noteMenuNote = computed(() => {
    const id = this.noteMenuOpenId();
    return id ? this.notes.find((n) => n.id === id) ?? null : null;
  });

  /** Value in the rename input. */
  renameTitle = '';

  @ViewChild('noteRenameInput') set noteRenameInputRef(el: ElementRef<HTMLInputElement> | undefined) {
    if (el?.nativeElement && this.noteIdBeingRenamed) {
      const note = this.notes.find((n) => n.id === this.noteIdBeingRenamed);
      if (note) this.renameTitle = note.title ?? '';
      setTimeout(() => {
        el.nativeElement.focus();
        el.nativeElement.select();
      }, 0);
    }
  }

  notes: Note[] = [];
  loading = true;
  /** Only true after LOADING_MESSAGE_DELAY_MS so fast loads don't flash "Loading…". */
  showLoadingMessage = false;
  error: string | null = null;
  private loadingDelayId: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private notesService: NotesService,
    private noteDragService: NoteDragService,
    public favouriteService: FavouriteService
  ) {
    effect(() => {
      const id = this.folderId();
      this.load(id);
    });
  }

  private clearLoadingDelay(): void {
    if (this.loadingDelayId != null) {
      clearTimeout(this.loadingDelayId);
      this.loadingDelayId = null;
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (target?.closest?.('.note-menu-wrap') == null && target?.closest?.('.note-context-menu') == null) {
      this.noteMenuOpenId.set(null);
      this.noteMenuPosition.set(null);
    }
  }

  toggleNoteMenu(noteId: string, event: Event): void {
    event.stopPropagation();
    const btn = (event.target as HTMLElement).closest('button') as HTMLElement;
    const rect = btn?.getBoundingClientRect();
    if (this.noteMenuOpenId() === noteId) {
      this.noteMenuOpenId.set(null);
      this.noteMenuPosition.set(null);
    } else {
      this.noteMenuOpenId.set(noteId);
      this.noteMenuPosition.set(rect ? { top: rect.bottom + 4, left: rect.left } : null);
    }
  }

  onToggleVisibility(note: Note): void {
    const next = note.visibility === 'PUBLIC' ? 'PRIVATE' : 'PUBLIC';
    this.notesService.update(note.id, { visibility: next }).subscribe({
      next: (updated) => {
        const i = this.notes.findIndex((n) => n.id === updated.id);
        if (i >= 0) this.notes = [...this.notes.slice(0, i), updated, ...this.notes.slice(i + 1)];
        this.noteMenuOpenId.set(null);
        this.noteMenuPosition.set(null);
      },
      error: () => {},
    });
  }

  onToggleFavouriteMenu(noteId: string): void {
    this.favouriteService.toggleNote(noteId);
    this.noteMenuOpenId.set(null);
    this.noteMenuPosition.set(null);
  }

  onDeleteNote(note: Note): void {
    if (!confirm('Delete this note?')) return;
    this.notesService.delete(note.id).subscribe({
      next: () => {
        this.notes = this.notes.filter((n) => n.id !== note.id);
        this.noteMenuOpenId.set(null);
        this.noteMenuPosition.set(null);
      },
      error: () => alert('Failed to delete note'),
    });
  }

  onNoteDrop(event: CdkDragDrop<Note[]>): void {
    if (event.previousContainer !== event.container) return;
    moveItemInArray(this.notes, event.previousIndex, event.currentIndex);
    const note = event.item.data as Note;
    const newPosition = String(event.currentIndex + 1);
    this.noteDragService.scheduleMove(note.id, this.folderId(), newPosition);
  }

  /** Reload notes. If folderId is passed, load that folder (e.g. after creating a note in that folder). */
  refresh(folderId?: number): void {
    this.load(folderId ?? this.folderId());
  }

  private load(folderId: number): void {
    this.clearLoadingDelay();
    this.loading = true;
    this.showLoadingMessage = false;
    this.error = null;
    this.loadingDelayId = setTimeout(() => {
      this.loadingDelayId = null;
      this.showLoadingMessage = true;
    }, LOADING_MESSAGE_DELAY_MS);
    this.notesService.listByFolder(folderId).subscribe({
      next: (list: Note[]) => {
        this.clearLoadingDelay();
        const exclude = this.excludeNoteId();
        this.notes = exclude ? list.filter((n) => n.id !== exclude) : list;
        this.loading = false;
        this.showLoadingMessage = false;
      },
      error: (err: { message?: string }) => {
        this.clearLoadingDelay();
        this.error = err?.message ?? 'Failed to load notes';
        this.loading = false;
        this.showLoadingMessage = false;
      },
    });
  }

  onNoteClick(note: Note): void {
    this.selectNote.emit(note.id);
  }

  isNoteRenaming(note: Note): boolean {
    const id = this.noteIdBeingRenamed;
    return id != null && id === note.id;
  }

  submitNoteRename(note: Note): void {
    const newTitle = (this.renameTitle || note.title).trim();
    if (newTitle && newTitle !== note.title) {
      this.notesService.update(note.id, { title: newTitle }).subscribe({
        next: (updated) => {
          const i = this.notes.findIndex((n) => n.id === updated.id);
          if (i >= 0) this.notes = [...this.notes.slice(0, i), updated, ...this.notes.slice(i + 1)];
        },
        error: () => {},
      });
    }
    this.renameTitle = '';
    this.noteRenamed.emit();
  }

  cancelNoteRename(): void {
    this.renameTitle = '';
    this.noteRenamed.emit();
  }

  onCreateNote(): void {
    const title = prompt('Note title');
    if (!title?.trim()) return;
    this.notesService.create(this.folderId(), title.trim()).subscribe({
      next: (created: Note) => {
        this.notes = [...this.notes, created];
        this.selectNote.emit(created.id);
      },
      error: () => alert('Failed to create note'),
    });
  }
}
