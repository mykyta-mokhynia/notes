import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

const STORAGE_KEY = 'notes_favourites';
export const MAX_FAVOURITES_TOTAL = 10;
export type FavouriteToggleResult = 'added' | 'removed' | 'limit_reached';

export interface Favourites {
  folderIds: number[];
  noteIds: string[];
  spaceIds: number[];
  /** noteId -> last opened timestamp (ms) for favourite notes */
  noteLastVisited?: Record<string, number>;
}

@Injectable({ providedIn: 'root' })
export class FavouriteService {
  private data: Favourites = this.load();
  /** Emit after toggle to refresh sidebar list. */
  readonly refresh$ = new Subject<void>();

  private getTotalCount(): number {
    return (
      this.data.folderIds.length +
      this.data.noteIds.length +
      this.data.spaceIds.length
    );
  }

  private canAddNewFavourite(): boolean {
    return this.getTotalCount() < MAX_FAVOURITES_TOTAL;
  }

  private load(): Favourites {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { folderIds: [], noteIds: [], spaceIds: [] };
      const parsed = JSON.parse(raw) as Favourites;
      return {
        folderIds: Array.isArray(parsed.folderIds) ? parsed.folderIds : [],
        noteIds: Array.isArray(parsed.noteIds) ? parsed.noteIds : [],
        spaceIds: Array.isArray(parsed.spaceIds) ? parsed.spaceIds : [],
        noteLastVisited:
          parsed.noteLastVisited && typeof parsed.noteLastVisited === 'object'
            ? parsed.noteLastVisited
            : {},
      };
    } catch {
      return { folderIds: [], noteIds: [], spaceIds: [] };
    }
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {}
  }

  getFavourites(): Favourites {
    return {
      ...this.data,
      folderIds: [...this.data.folderIds],
      noteIds: [...this.data.noteIds],
      spaceIds: [...this.data.spaceIds],
      noteLastVisited: this.data.noteLastVisited ? { ...this.data.noteLastVisited } : {},
    };
  }

  getNoteLastVisited(noteId: string): number | null {
    const ts = this.data.noteLastVisited?.[noteId];
    return typeof ts === 'number' ? ts : null;
  }

  setNoteLastVisited(noteId: string, timestamp: number): void {
    if (!this.data.noteLastVisited) this.data.noteLastVisited = {};
    this.data.noteLastVisited[noteId] = timestamp;
    this.save();
  }

  isFolderFavourite(folderId: number): boolean {
    return this.data.folderIds.includes(folderId);
  }

  isNoteFavourite(noteId: string): boolean {
    return this.data.noteIds.includes(noteId);
  }

  isSpaceFavourite(spaceId: number): boolean {
    return this.data.spaceIds.includes(spaceId);
  }

  toggleFolder(folderId: number): FavouriteToggleResult {
    const i = this.data.folderIds.indexOf(folderId);
    if (i >= 0) {
      this.data.folderIds.splice(i, 1);
      this.save();
      this.refresh$.next();
      return 'removed';
    }
    else {
      if (!this.canAddNewFavourite()) return 'limit_reached';
      this.data.folderIds.push(folderId);
    }
    this.save();
    this.refresh$.next();
    return 'added';
  }

  toggleNote(noteId: string): FavouriteToggleResult {
    const i = this.data.noteIds.indexOf(noteId);
    if (i >= 0) {
      this.data.noteIds.splice(i, 1);
      this.save();
      this.refresh$.next();
      return 'removed';
    }
    else {
      if (!this.canAddNewFavourite()) return 'limit_reached';
      this.data.noteIds.push(noteId);
    }
    this.save();
    this.refresh$.next();
    return 'added';
  }

  toggleSpace(spaceId: number): FavouriteToggleResult {
    const i = this.data.spaceIds.indexOf(spaceId);
    if (i >= 0) {
      this.data.spaceIds.splice(i, 1);
      this.save();
      this.refresh$.next();
      return 'removed';
    }
    else {
      if (!this.canAddNewFavourite()) return 'limit_reached';
      this.data.spaceIds.push(spaceId);
    }
    this.save();
    this.refresh$.next();
    return 'added';
  }
}
