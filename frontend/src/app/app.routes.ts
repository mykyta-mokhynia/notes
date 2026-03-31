import { Routes } from '@angular/router';
import {
  accountGuard,
  adminGuard,
  homeGuard,
  loginGuard,
  onboardingGuard,
} from './core/auth/auth.guards';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'home' },
  {
    path: 'login',
    canActivate: [loginGuard],
    loadComponent: () =>
      import('./auth/login/login').then((m) => m.LoginComponent),
  },
  {
    path: 'switch-profile',
    loadComponent: () =>
      import('./auth/switch-profile/switch-profile').then(
        (m) => m.SwitchProfileComponent
      ),
  },
  {
    path: 'forgot-password',
    canActivate: [loginGuard],
    loadComponent: () =>
      import('./auth/forgot-password/forgot-password').then(
        (m) => m.ForgotPasswordComponent
      ),
  },
  {
    path: 'reset-password',
    canActivate: [loginGuard],
    loadComponent: () =>
      import('./auth/reset-password/reset-password').then(
        (m) => m.ResetPasswordComponent
      ),
  },
  {
    path: 'onboarding',
    canActivate: [onboardingGuard],
    loadComponent: () =>
      import('./auth/onboarding/onboarding').then((m) => m.OnboardingComponent),
  },
  {
    path: 'account',
    canActivate: [accountGuard],
    loadComponent: () =>
      import('./auth/account/account').then((m) => m.AccountComponent),
  },
  {
    path: 'admin',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./admin/admin').then((m) => m.AdminComponent),
  },
  {
    path: 'home',
    canActivate: [homeGuard],
    loadComponent: () =>
      import('./workspace/workspace').then((m) => m.WorkspaceComponent),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./workspace/workspace-empty/workspace-empty').then(
            (m) => m.WorkspaceEmptyComponent
          ),
      },
      {
        path: 'notes/:id',
        loadComponent: () =>
          import('./workspace/note-editor/note-editor').then(
            (m) => m.NoteEditorComponent
          ),
      },
      {
        path: 'recent',
        loadComponent: () =>
          import('./workspace/recent-pages/recent-pages').then(
            (m) => m.RecentPagesComponent
          ),
      },
    ],
  },
];
