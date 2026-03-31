import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

const STORAGE_KEY = 'notes_recent';
export const MAX_RECENT_ITEMS = 50;
export const SIDEBAR_RECENT_ITEMS = 6;

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

  private normalize(items: RecentItem[]): RecentItem[] {
    const sorted = [...items].sort((a, b) => b.openedAt - a.openedAt);
    const unique: RecentItem[] = [];
    const seenIds = new Set<string>();

    for (const item of sorted) {
      if (seenIds.has(item.id)) continue;
      seenIds.add(item.id);
      unique.push(item);
      if (unique.length >= MAX_RECENT_ITEMS) break;
    }

    return unique;
  }

  private load(): RecentItem[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return [];
      const validItems = parsed
        .filter((item): item is RecentItem => {
          const typed = item as Partial<RecentItem>;
          return (
            typeof typed?.id === 'string' &&
            typeof typed?.title === 'string' &&
            typeof typed?.openedAt === 'number'
          );
        });
      const normalizedItems = this.normalize(validItems);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizedItems));
      return normalizedItems;
    } catch {
      return [];
    }
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.items));
    } catch {}
  }

  private ensureNormalized(): void {
    const normalized = this.normalize(this.items);
    if (normalized.length !== this.items.length) {
      this.items = normalized;
      this.save();
      return;
    }
    for (let i = 0; i < normalized.length; i += 1) {
      const prev = this.items[i];
      const next = normalized[i];
      if (
        prev?.id !== next?.id ||
        prev?.title !== next?.title ||
        prev?.openedAt !== next?.openedAt
      ) {
        this.items = normalized;
        this.save();
        return;
      }
    }
  }

  getItems(limit?: number): RecentItem[] {
    this.ensureNormalized();
    if (typeof limit === 'number' && limit > 0) {
      return this.items.slice(0, limit);
    }
    return [...this.items];
  }

  add(noteId: string, title: string): void {
    const now = Date.now();
    const candidateItems = [
      { id: noteId, title: title || 'Untitled', openedAt: now },
      ...this.items,
    ];
    this.items = this.normalize(candidateItems);
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
