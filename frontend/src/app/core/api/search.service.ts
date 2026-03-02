import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';

export type SearchHit =
  | { type: 'folder'; id: number; title: string; path: string | null }
  | { type: 'note'; id: string; title: string; folder_id: number };

const BASE = `${environment.apiUrl}/api/search`;

@Injectable({ providedIn: 'root' })
export class SearchService {
  constructor(private http: HttpClient) {}

  search(q: string): Observable<SearchHit[]> {
    return this.http.get<SearchHit[]>(BASE, { params: { q: q.trim() } });
  }
}
