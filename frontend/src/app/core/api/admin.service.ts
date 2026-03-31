import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AdminUserSummary {
  id: number;
  email: string | null;
  role: 'ADMIN' | 'USER' | 'GUEST';
  nickname: string | null;
  avatar_initials: string | null;
  avatar_color: string | null;
  profile_completed: boolean;
  has_password: boolean;
  has_google: boolean;
  created_at: string;
  updated_at: string;
}

export interface AdminCommentSummary {
  id: string;
  note_id: string;
  note_title: string;
  author_id: number;
  author_type: 'USER' | 'GUEST';
  author_role: 'ADMIN' | 'USER' | 'GUEST';
  nickname: string;
  avatar_initials: string;
  avatar_color: string;
  content: string;
  created_at: string;
  updated_at: string;
}

const BASE = `${environment.apiUrl}/api/admin`;

@Injectable({ providedIn: 'root' })
export class AdminService {
  constructor(private http: HttpClient) {}

  listUsers(): Observable<AdminUserSummary[]> {
    return this.http.get<AdminUserSummary[]>(`${BASE}/users`);
  }

  listComments(limit = 100): Observable<AdminCommentSummary[]> {
    return this.http.get<AdminCommentSummary[]>(`${BASE}/comments`, {
      params: { limit },
    });
  }

  deleteComment(commentId: string): Observable<void> {
    return this.http.delete<void>(`${BASE}/comments/${commentId}`);
  }
}
