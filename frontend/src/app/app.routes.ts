import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'home' },
  {
    path: 'home',
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
    ],
  },
];
