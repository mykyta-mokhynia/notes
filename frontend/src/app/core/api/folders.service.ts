import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';

export interface Folder {
  id: number;
  parent_id: number | null;
  title: string;
  position: string;
  path: string | null;
}

const BASE = `${environment.apiUrl}/api/folders`;

@Injectable({ providedIn: 'root' })
export class FoldersService {
  constructor(private http: HttpClient) {}

  getTree(): Observable<Folder[]> {
    return this.http.get<Folder[]>(BASE);
  }

  get(id: number): Observable<Folder> {
    return this.http.get<Folder>(`${BASE}/${id}`);
  }

  create(parentId: number | null, title: string, position?: string): Observable<Folder> {
    return this.http.post<Folder>(BASE, {
      parent_id: parentId,
      title,
      position: position ?? '1',
    });
  }

  update(id: number, data: { title?: string; position?: string }): Observable<Folder> {
    return this.http.patch<Folder>(`${BASE}/${id}`, data);
  }

  move(id: number, newParentId: number | null): Observable<Folder> {
    return this.http.patch<Folder>(`${BASE}/${id}/move`, { new_parent_id: newParentId });
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${BASE}/${id}`);
  }
}
