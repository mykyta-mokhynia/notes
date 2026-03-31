import { Injectable, computed, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, finalize, map, shareReplay, switchMap, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface AuthUser {
  id: number;
  email: string | null;
  role: 'ADMIN' | 'USER' | 'GUEST';
  nickname: string | null;
  avatar_initials: string | null;
  avatar_color: string | null;
  profile_completed: boolean;
  has_password: boolean;
  has_google: boolean;
}

interface AuthResponse {
  access_token: string;
  user: AuthUser;
  profile_key?: string;
}

interface AuthStatusResponse {
  has_admin: boolean;
  google_auth_enabled: boolean;
}

export interface BrowserProfile extends AuthUser {
  profile_key: string;
}

interface BrowserProfilesResponse {
  profiles: BrowserProfile[];
}

export interface ForgotPasswordResponse {
  ok: boolean;
  email_sent?: boolean;
  reset_token?: string;
  reset_url?: string;
}

const BASE = `${environment.apiUrl}/api/auth`;
const ACTIVE_PROFILE_STORAGE_KEY = 'notes-active-profile';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly accessTokenSignal = signal<string | null>(null);
  private readonly activeProfileKeySignal = signal<string | null>(this.readStoredActiveProfileKey());
  private initRequest$: Observable<AuthUser | null> | null = null;

  readonly user = signal<AuthUser | null>(null);
  readonly browserProfiles = signal<BrowserProfile[]>([]);
  readonly hasAdmin = signal<boolean | null>(null);
  readonly googleAuthEnabled = signal<boolean | null>(null);
  readonly ready = signal(false);

  readonly activeProfileKey = computed(() => this.activeProfileKeySignal());
  readonly isAuthenticated = computed(() => this.user() !== null);
  readonly isGuest = computed(() => this.user()?.role === 'GUEST');
  readonly isAdmin = computed(() => this.user()?.role === 'ADMIN');
  readonly canEdit = computed(() => this.isAdmin());
  readonly canDrag = computed(() => this.canEdit());
  readonly canComment = computed(() => this.isAuthenticated());
  readonly needsOnboarding = computed(() => {
    const user = this.user();
    return !!user && user.role !== 'GUEST' && !user.profile_completed;
  });

  constructor(private http: HttpClient) {}

  initialize(): void {
    this.ensureInitialized().subscribe();
  }

  ensureInitialized(): Observable<AuthUser | null> {
    if (this.ready()) {
      return of(this.user());
    }
    if (this.initRequest$) {
      return this.initRequest$;
    }

    this.refreshStatus().subscribe();
    this.initRequest$ = this.restoreSavedSession().pipe(
      tap(() => this.ready.set(true)),
      finalize(() => {
        this.initRequest$ = null;
      }),
      shareReplay(1)
    );
    return this.initRequest$;
  }

  accessToken(): string | null {
    return this.accessTokenSignal();
  }

  createProfileKey(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }
    return `profile_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }

  refreshStatus(): Observable<boolean> {
    return this.http.get<AuthStatusResponse>(`${BASE}/status`).pipe(
      tap((response) => {
        this.hasAdmin.set(response.has_admin);
        this.googleAuthEnabled.set(response.google_auth_enabled);
      }),
      map((response) => response.has_admin),
      catchError(() => {
        this.hasAdmin.set(true);
        this.googleAuthEnabled.set(false);
        return of(true);
      })
    );
  }

  register(email: string, password: string): Observable<AuthUser> {
    const profileKey = this.createProfileKey();
    return this.http
      .post<AuthResponse>(`${BASE}/register`, { email, password, profile_key: profileKey })
      .pipe(
        tap((response) => {
          this.hasAdmin.set(true);
          this.applySession(response, profileKey);
        }),
        switchMap((response) =>
          this.reloadBrowserProfiles().pipe(map(() => response.user))
        )
      );
  }

  login(email: string, password: string, profileKey?: string): Observable<AuthUser> {
    const nextProfileKey = profileKey ?? this.activeProfileKeySignal() ?? this.createProfileKey();
    return this.http
      .post<AuthResponse>(`${BASE}/login`, { email, password, profile_key: nextProfileKey })
      .pipe(
        tap((response) => this.applySession(response, nextProfileKey)),
        switchMap((response) =>
          this.reloadBrowserProfiles().pipe(map(() => response.user))
        )
      );
  }

  loginWithGoogle(credential: string, profileKey?: string): Observable<AuthUser> {
    const nextProfileKey = profileKey ?? this.activeProfileKeySignal() ?? this.createProfileKey();
    return this.http
      .post<AuthResponse>(`${BASE}/google`, { credential, profile_key: nextProfileKey })
      .pipe(
        tap((response) => this.applySession(response, nextProfileKey)),
        switchMap((response) =>
          this.reloadBrowserProfiles().pipe(map(() => response.user))
        )
      );
  }

  continueAsGuest(profileKey?: string): Observable<AuthUser> {
    const nextProfileKey = profileKey ?? this.activeProfileKeySignal() ?? this.createProfileKey();
    return this.http.post<AuthResponse>(`${BASE}/guest`, { profile_key: nextProfileKey }).pipe(
      tap((response) => this.applySession(response, nextProfileKey)),
      map((response) => response.user)
    );
  }

  refreshAccessToken(profileKey: string | null = this.activeProfileKeySignal()): Observable<AuthUser | null> {
    if (!profileKey) {
      this.clearSession();
      return of(null);
    }
    return this.http.post<AuthResponse>(`${BASE}/refresh`, { profile_key: profileKey }).pipe(
      tap((response) => this.applySession(response, profileKey)),
      map((response) => response.user),
      catchError(() => {
        if (this.activeProfileKeySignal() === profileKey) {
          this.setActiveProfileKey(null);
          this.clearSession();
        }
        this.clearSession();
        return of(null);
      })
    );
  }

  completeOnboarding(nickname: string): Observable<AuthUser> {
    return this.http
      .patch<AuthResponse>(`${BASE}/onboarding`, {
        nickname,
        profile_key: this.activeProfileKeySignal(),
      })
      .pipe(
        tap((response) => this.applySession(response)),
        map((response) => response.user)
      );
  }

  updateProfile(nickname: string): Observable<AuthUser> {
    return this.http
      .patch<AuthResponse>(`${BASE}/me/profile`, {
        nickname,
        profile_key: this.activeProfileKeySignal(),
      })
      .pipe(
        tap((response) => this.applySession(response)),
        map((response) => response.user)
      );
  }

  updatePassword(
    newPassword: string,
    currentPassword?: string
  ): Observable<AuthUser> {
    return this.http
      .post<AuthResponse>(`${BASE}/me/password`, {
        current_password: currentPassword,
        new_password: newPassword,
        profile_key: this.activeProfileKeySignal(),
      })
      .pipe(
        tap((response) => this.applySession(response)),
        switchMap((response) =>
          this.reloadBrowserProfiles().pipe(map(() => response.user))
        )
      );
  }

  linkGoogleAccount(credential: string): Observable<AuthUser> {
    return this.http
      .post<AuthResponse>(`${BASE}/me/link-google`, {
        credential,
        profile_key: this.activeProfileKeySignal(),
      })
      .pipe(
        tap((response) => this.applySession(response)),
        map((response) => response.user)
      );
  }

  unlinkGoogleAccount(): Observable<AuthUser> {
    return this.http.request<AuthResponse>('DELETE', `${BASE}/me/link-google`, {
      body: { profile_key: this.activeProfileKeySignal() },
    })
      .pipe(
        tap((response) => this.applySession(response)),
        map((response) => response.user)
      );
  }

  requestPasswordReset(email: string): Observable<ForgotPasswordResponse | null> {
    return this.http.post<ForgotPasswordResponse | null>(`${BASE}/forgot-password`, { email });
  }

  resetPassword(token: string, password: string): Observable<AuthUser> {
    const profileKey = this.activeProfileKeySignal() ?? this.createProfileKey();
    return this.http
      .post<AuthResponse>(`${BASE}/reset-password`, { token, password, profile_key: profileKey })
      .pipe(
        tap((response) => this.applySession(response, profileKey)),
        switchMap((response) =>
          this.reloadBrowserProfiles().pipe(map(() => response.user))
        )
      );
  }

  logout(profileKey: string | null = this.activeProfileKeySignal()): Observable<void> {
    if (!profileKey) {
      this.clearSession();
      this.setActiveProfileKey(null);
      return of(void 0);
    }
    return this.http.post<void>(`${BASE}/logout`, { profile_key: profileKey }).pipe(
      switchMap(() => this.afterProfileRemoval(profileKey)),
      catchError(() => {
        this.clearSession();
        this.setActiveProfileKey(null);
        return of(void 0);
      })
    );
  }

  handleUnauthorized(): void {
    this.clearSession();
    this.setActiveProfileKey(null);
    this.reloadBrowserProfiles().subscribe();
    this.ready.set(true);
  }

  reloadBrowserProfiles(): Observable<BrowserProfile[]> {
    return this.http.get<BrowserProfilesResponse>(`${BASE}/profiles`).pipe(
      tap((response) => this.browserProfiles.set(response.profiles)),
      map((response) => response.profiles),
      catchError(() => {
        this.browserProfiles.set([]);
        return of([]);
      })
    );
  }

  switchToProfile(profileKey: string): Observable<AuthUser> {
    return this.http.post<AuthResponse>(`${BASE}/refresh`, { profile_key: profileKey }).pipe(
      tap((response) => this.applySession(response, profileKey)),
      switchMap((response) =>
        this.reloadBrowserProfiles().pipe(map(() => response.user))
      )
    );
  }

  removeSavedProfile(profileKey: string): Observable<void> {
    return this.http
      .delete<void>(`${BASE}/profiles/${encodeURIComponent(profileKey)}`)
      .pipe(switchMap(() => this.afterProfileRemoval(profileKey)));
  }

  clearBrowserProfiles(): Observable<void> {
    return this.http.delete<void>(`${BASE}/profiles`).pipe(
      tap(() => {
        this.browserProfiles.set([]);
        this.clearSession();
        this.setActiveProfileKey(null);
      }),
      map(() => void 0),
      catchError(() => {
        this.browserProfiles.set([]);
        this.clearSession();
        this.setActiveProfileKey(null);
        return of(void 0);
      })
    );
  }

  private applySession(response: AuthResponse, fallbackProfileKey?: string): void {
    const profileKey = response.profile_key ?? fallbackProfileKey ?? this.activeProfileKeySignal();
    this.accessTokenSignal.set(response.access_token);
    this.user.set(response.user);
    if (profileKey) {
      this.setActiveProfileKey(profileKey);
    }
    this.ready.set(true);
  }

  private clearSession(): void {
    this.accessTokenSignal.set(null);
    this.user.set(null);
  }

  private restoreSavedSession(): Observable<AuthUser | null> {
    return this.reloadBrowserProfiles().pipe(
      switchMap((profiles) => {
        const preferredProfileKey = this.resolvePreferredProfileKey(profiles);
        if (!preferredProfileKey) {
          this.setActiveProfileKey(null);
          this.clearSession();
          return of(null);
        }

        return this.refreshAccessToken(preferredProfileKey).pipe(
          switchMap((user) => {
            if (user) {
              return of(user);
            }
            return this.reloadBrowserProfiles().pipe(map(() => null));
          })
        );
      })
    );
  }

  private resolvePreferredProfileKey(profiles: BrowserProfile[]): string | null {
    const storedProfileKey = this.activeProfileKeySignal();
    return storedProfileKey && profiles.some((profile) => profile.profile_key === storedProfileKey)
      ? storedProfileKey
      : null;
  }

  private afterProfileRemoval(profileKey: string): Observable<void> {
    const removingActiveProfile = this.activeProfileKeySignal() === profileKey;
    if (removingActiveProfile) {
      this.clearSession();
      this.setActiveProfileKey(null);
    }
    return this.reloadBrowserProfiles().pipe(map(() => void 0));
  }

  private setActiveProfileKey(profileKey: string | null): void {
    this.activeProfileKeySignal.set(profileKey);
    if (profileKey) {
      localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, profileKey);
    } else {
      localStorage.removeItem(ACTIVE_PROFILE_STORAGE_KEY);
    }
  }

  private readStoredActiveProfileKey(): string | null {
    const value = localStorage.getItem(ACTIVE_PROFILE_STORAGE_KEY)?.trim();
    return value ? value : null;
  }
}
