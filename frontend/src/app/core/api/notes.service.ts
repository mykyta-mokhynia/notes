import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';

export type NoteVisibility = 'PRIVATE' | 'PUBLIC';

export interface Note {
  id: string;
  folder_id: number;
  title: string;
  position: string;
  visibility: NoteVisibility;
  created_at: string;
  updated_at: string;
  search_dirty?: boolean;
  /** True when this note is the About note of a space (cannot be deleted). */
  is_about_note?: boolean;
}

export interface NoteBlock {
  id: string;
  note_id: string;
  type: string;
  position: string;
  version: number;
  data: Record<string, unknown>;
}

const BASE = `${environment.apiUrl}/api/notes`;

@Injectable({ providedIn: 'root' })
export class NotesService {
  constructor(private http: HttpClient) {}

  listByFolder(folderId: number): Observable<Note[]> {
    return this.http.get<Note[]>(BASE, { params: { folder_id: folderId } });
  }

  get(id: string): Observable<Note> {
    return this.http.get<Note>(`${BASE}/${id}`);
  }

  create(
    folderId: number,
    title: string,
    visibility: NoteVisibility = 'PRIVATE',
    position?: string
  ): Observable<Note> {
    return this.http.post<Note>(BASE, {
      folder_id: folderId,
      title,
      visibility,
      position,
    });
  }

  update(
    id: string,
    data: { title?: string; visibility?: NoteVisibility; position?: string }
  ): Observable<Note> {
    return this.http.patch<Note>(`${BASE}/${id}`, data);
  }

  move(noteId: string, newFolderId: number, newPosition: string): Observable<Note> {
    return this.http.patch<Note>(`${BASE}/move`, {
      note_id: noteId,
      new_folder_id: newFolderId,
      new_position: newPosition,
    });
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${BASE}/${id}`);
  }

  listBlocks(noteId: string): Observable<NoteBlock[]> {
    return this.http.get<NoteBlock[]>(`${BASE}/${noteId}/blocks`);
  }

  createBlock(
    noteId: string,
    type: string,
    position: string,
    data?: Record<string, unknown>
  ): Observable<NoteBlock> {
    return this.http.post<NoteBlock>(`${BASE}/${noteId}/blocks`, {
      type,
      position,
      data: data ?? {},
    });
  }

  updateBlock(
    noteId: string,
    blockId: string,
    data: Partial<{ type: string; position: string; data: Record<string, unknown>; version: number }>
  ): Observable<NoteBlock> {
    return this.http.patch<NoteBlock>(`${BASE}/${noteId}/blocks/${blockId}`, data);
  }

  deleteBlock(noteId: string, blockId: string): Observable<void> {
    return this.http.delete<void>(`${BASE}/${noteId}/blocks/${blockId}`);
  }

  rebalanceBlocks(noteId: string): Observable<void> {
    return this.http.post<void>(`${BASE}/${noteId}/blocks/rebalance`, {});
  }
}
