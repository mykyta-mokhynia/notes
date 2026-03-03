import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';

export type SpaceVisibility = 'PRIVATE' | 'PUBLIC';

export interface Space {
  id: number;
  name: string;
  root_folder_id: number;
  about_note_id: string | null;
  visibility?: SpaceVisibility;
  /** Present when listed from API (note count in this space). */
  note_count?: number;
}

const BASE = `${environment.apiUrl}/api/spaces`;

@Injectable({ providedIn: 'root' })
export class SpacesService {
  constructor(private http: HttpClient) {}

  list(): Observable<Space[]> {
    return this.http.get<Space[]>(BASE);
  }

  get(id: number): Observable<Space> {
    return this.http.get<Space>(`${BASE}/${id}`);
  }

  create(name: string): Observable<Space> {
    return this.http.post<Space>(BASE, { name });
  }

  update(id: number, data: { name?: string; visibility?: SpaceVisibility }): Observable<Space> {
    return this.http.patch<Space>(`${BASE}/${id}`, data);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${BASE}/${id}`);
  }
}
