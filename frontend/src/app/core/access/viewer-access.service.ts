import { Injectable } from '@angular/core';
import { AuthService } from '../auth/auth.service';

@Injectable({ providedIn: 'root' })
export class ViewerAccessService {
  readonly isGuest;
  readonly isAuthenticated;
  readonly isAdmin;
  readonly canEdit;
  readonly canDrag;
  readonly canComment;

  constructor(private auth: AuthService) {
    this.isGuest = this.auth.isGuest;
    this.isAuthenticated = this.auth.isAuthenticated;
    this.isAdmin = this.auth.isAdmin;
    this.canEdit = this.auth.canEdit;
    this.canDrag = this.auth.canDrag;
    this.canComment = this.auth.canComment;
  }
}
