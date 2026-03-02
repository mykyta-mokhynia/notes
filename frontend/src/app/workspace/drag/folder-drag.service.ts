import { Injectable } from '@angular/core';
import { FoldersService } from '../../core/api/folders.service';
import { Subject, Observable } from 'rxjs';
import { debounceTime, switchMap, share } from 'rxjs/operators';

export interface PendingFolderMove {
  folderId: number;
  newParentId: number | null;
}

@Injectable({ providedIn: 'root' })
export class FolderDragService {
  private pending = new Subject<PendingFolderMove>();
  private readonly DEBOUNCE_MS = 400;

  /** Emits after a move was sent to API (for refetching tree). */
  readonly moveDone: Observable<unknown>;

  constructor(private foldersService: FoldersService) {
    this.moveDone = this.pending.pipe(
      debounceTime(this.DEBOUNCE_MS),
      switchMap((move) => this.foldersService.move(move.folderId, move.newParentId)),
      share()
    );
    this.moveDone.subscribe({ error: () => console.error('Folder move failed') });
  }

  scheduleMove(folderId: number, newParentId: number | null): void {
    this.pending.next({ folderId, newParentId });
  }
}
