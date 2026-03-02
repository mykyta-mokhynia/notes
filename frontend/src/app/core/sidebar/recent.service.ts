import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

const STORAGE_KEY = 'notes_recent';
const MAX_ITEMS = 15;

export interface RecentItem {
  id: string;
  title: string;
  openedAt: number;
}

@Injectable({ providedIn: 'root' })
export class RecentService {
  private items: RecentItem[] = this.load();
  /** Emit after add to refresh sidebar list. */
  readonly refresh$ = new Subject<void>();

  private load(): RecentItem[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as RecentItem[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.items));
    } catch {}
  }

  getItems(): RecentItem[] {
    return [...this.items];
  }

  add(noteId: string, title: string): void {
    const now = Date.now();
    this.items = this.items.filter((i) => i.id !== noteId);
    this.items.unshift({ id: noteId, title: title || 'Untitled', openedAt: now });
    if (this.items.length > MAX_ITEMS) this.items = this.items.slice(0, MAX_ITEMS);
    this.save();
    this.refresh$.next();
  }

  /** Remove a note from recent (e.g. after it was deleted). */
  remove(noteId: string): void {
    const prev = this.items.length;
    this.items = this.items.filter((i) => i.id !== noteId);
    if (this.items.length !== prev) {
      this.save();
      this.refresh$.next();
    }
  }
}
