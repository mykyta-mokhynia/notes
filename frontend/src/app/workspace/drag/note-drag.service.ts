import { Injectable } from '@angular/core';
import { NotesService } from '../../core/api/notes.service';
import { Subject, Observable } from 'rxjs';
import { debounceTime, switchMap, share } from 'rxjs/operators';

export interface PendingNoteMove {
  noteId: string;
  newFolderId: number;
  newPosition: string;
}

@Injectable({ providedIn: 'root' })
export class NoteDragService {
  private pending = new Subject<PendingNoteMove>();
  private readonly DEBOUNCE_MS = 400;

  /** Emits after a move was sent to API (for refetching notes list). */
  readonly moveDone: Observable<unknown>;

  constructor(private notesService: NotesService) {
    this.moveDone = this.pending.pipe(
      debounceTime(this.DEBOUNCE_MS),
      switchMap((m) => this.notesService.move(m.noteId, m.newFolderId, m.newPosition)),
      share()
    );
    this.moveDone.subscribe({ error: () => console.error('Note move failed') });
  }

  scheduleMove(noteId: string, newFolderId: number, newPosition: string): void {
    this.pending.next({ noteId, newFolderId, newPosition });
  }
}
