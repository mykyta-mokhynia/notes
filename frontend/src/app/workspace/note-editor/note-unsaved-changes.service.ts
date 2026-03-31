import { Injectable, signal } from '@angular/core';
import type { JSONContent } from '@tiptap/core';

interface NoteUnsavedState {
  dirty: boolean;
  saving: boolean;
  error: string | null;
}

type FlushHandler = () => Promise<boolean>;
const DRAFT_KEY_PREFIX = 'notes:draft:';

@Injectable({ providedIn: 'root' })
export class NoteUnsavedChangesService {
  private readonly handlers = new Map<string, FlushHandler>();
  private readonly state = signal<Record<string, NoteUnsavedState>>({});

  private draftKey(noteId: string): string {
    return `${DRAFT_KEY_PREFIX}${noteId}`;
  }

  register(noteId: string, handler: FlushHandler): void {
    this.handlers.set(noteId, handler);
  }

  unregister(noteId: string): void {
    this.handlers.delete(noteId);
    this.clearState(noteId);
  }

  setState(noteId: string, next: NoteUnsavedState): void {
    this.state.update((current) => ({
      ...current,
      [noteId]: next,
    }));
  }

  clearState(noteId: string): void {
    this.state.update((current) => {
      if (!(noteId in current)) return current;
      const clone = { ...current };
      delete clone[noteId];
      return clone;
    });
  }

  getState(noteId: string): NoteUnsavedState {
    const current = this.state()[noteId];
    if (current) return current;
    return { dirty: this.hasDraft(noteId), saving: false, error: null };
  }

  async flushNote(noteId: string): Promise<boolean> {
    const handler = this.handlers.get(noteId);
    if (!handler) return !this.hasDraft(noteId);
    return handler();
  }

  saveDraft(noteId: string, doc: JSONContent): void {
    try {
      localStorage.setItem(this.draftKey(noteId), JSON.stringify(doc));
    } catch {}
  }

  readDraft(noteId: string): JSONContent | null {
    try {
      const raw = localStorage.getItem(this.draftKey(noteId));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as JSONContent;
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }

  hasDraft(noteId: string): boolean {
    try {
      return localStorage.getItem(this.draftKey(noteId)) !== null;
    } catch {
      return false;
    }
  }

  clearDraft(noteId: string): void {
    try {
      localStorage.removeItem(this.draftKey(noteId));
    } catch {}
  }
}
