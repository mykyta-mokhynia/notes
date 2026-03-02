import { Component, input, output, effect } from '@angular/core';
import { NotesService, Note } from '../../core/api/notes.service';
import { CommonModule } from '@angular/common';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { NoteDragService } from '../drag/note-drag.service';
import { FavouriteService } from '../../core/sidebar/favourite.service';
import { IconPageComponent } from '../icons/icon-page';

/** Delay before showing loading message (avoids flicker on fast loads). */
const LOADING_MESSAGE_DELAY_MS = 180;

@Component({
  selector: 'app-notes-list',
  standalone: true,
  imports: [CommonModule, DragDropModule, IconPageComponent],
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

  onToggleFavourite(e: Event, note: Note): void {
    e.stopPropagation();
    this.favouriteService.toggleNote(note.id);
  }

  onNoteDrop(event: CdkDragDrop<Note[]>): void {
    if (event.previousContainer !== event.container) return;
    moveItemInArray(this.notes, event.previousIndex, event.currentIndex);
    const note = event.item.data as Note;
    const newPosition = String(event.currentIndex + 1);
    this.noteDragService.scheduleMove(note.id, this.folderId(), newPosition);
  }

  load(folderId: number): void {
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
