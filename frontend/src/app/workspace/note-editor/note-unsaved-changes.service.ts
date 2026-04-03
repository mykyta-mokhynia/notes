import { Injectable, signal } from '@angular/core';
import type { JSONContent } from '@tiptap/core';
import { firstValueFrom } from 'rxjs';
import { NotesService } from '../../core/api/notes.service';

interface NoteUnsavedState {
  dirty: boolean;
  saving: boolean;
  error: string | null;
}

type FlushHandler = () => Promise<boolean>;
const DRAFT_SAVE_DEBOUNCE_MS = 700;

@Injectable({ providedIn: 'root' })
export class NoteUnsavedChangesService {
  constructor(private readonly notesService: NotesService) {}

  private readonly handlers = new Map<string, FlushHandler>();
  private readonly state = signal<Record<string, NoteUnsavedState>>({});
  private readonly draftCache = new Map<string, JSONContent>();
  private readonly draftSaveTimers = new Map<string, number>();
  private readonly draftSaveInFlight = new Map<string, Promise<void>>();

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
    this.draftCache.set(noteId, doc);
    const prevTimerId = this.draftSaveTimers.get(noteId);
    if (prevTimerId !== undefined) {
      window.clearTimeout(prevTimerId);
    }
    const timerId = window.setTimeout(() => {
      this.draftSaveTimers.delete(noteId);
      void this.flushDraftToServer(noteId);
    }, DRAFT_SAVE_DEBOUNCE_MS);
    this.draftSaveTimers.set(noteId, timerId);
  }

  async readDraft(noteId: string): Promise<JSONContent | null> {
    const cached = this.draftCache.get(noteId);
    try {
      const response = await firstValueFrom(this.notesService.getDraft(noteId));
      if (response?.doc && typeof response.doc === 'object' && !Array.isArray(response.doc)) {
        const doc = response.doc as JSONContent;
        this.draftCache.set(noteId, doc);
        return doc;
      }
      this.draftCache.delete(noteId);
      return null;
    } catch {
      return cached ?? null;
    }
  }

  hasDraft(noteId: string): boolean {
    return this.draftCache.has(noteId);
  }

  clearDraft(noteId: string): void {
    this.draftCache.delete(noteId);
    const timerId = this.draftSaveTimers.get(noteId);
    if (timerId !== undefined) {
      window.clearTimeout(timerId);
      this.draftSaveTimers.delete(noteId);
    }
    void firstValueFrom(this.notesService.clearDraft(noteId)).catch(() => undefined);
  }

  private async flushDraftToServer(noteId: string): Promise<void> {
    const cached = this.draftCache.get(noteId);
    if (!cached) return;
    const inFlight = this.draftSaveInFlight.get(noteId);
    if (inFlight) {
      await inFlight;
      return;
    }
    const sentSignature = JSON.stringify(cached);
    const request = firstValueFrom(
      this.notesService.saveDraft(noteId, cached as Record<string, unknown>)
    )
      .catch(() => undefined)
      .then(() => undefined)
      .finally(() => {
        this.draftSaveInFlight.delete(noteId);
      });
    this.draftSaveInFlight.set(noteId, request);
    await request;
    const latest = this.draftCache.get(noteId);
    if (latest && JSON.stringify(latest) !== sentSignature) {
      void this.flushDraftToServer(noteId);
    }
  }
}
