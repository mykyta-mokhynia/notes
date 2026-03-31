# PROJECT_STRUCTURE

```
notes/
├── package.json
├── README.md
├── AI_INSTRUCTIONS.md
├── AI_LOGS.md
├── PROJECT_STRUCTURE.md
├── backend/
│   ├── migrations/
│   │   ├── 006_spaces_avatar_key.sql
│   │   ├── 007_users.sql
│   │   ├── 008_auth_sessions.sql
│   │   ├── 009_password_reset_tokens.sql
│   │   ├── 010_note_comments.sql
│   │   ├── 011_refresh_token_profiles.sql
│   │   └── 012_note_creators.sql
│   └── src/
│       ├── index.ts
│       ├── config.ts
│       ├── express.d.ts
│       ├── types.ts
│       ├── auth/
│       │   ├── google.ts
│       │   ├── middleware.ts
│       │   ├── password.ts
│       │   └── token.ts
│       ├── mail/
│       │   └── password-reset.ts
│       ├── db/
│       │   ├── index.ts
│       │   ├── migrate.ts
│       │   ├── folders.ts
│       │   ├── notes.ts
│       │   ├── blocks.ts
│       │   ├── spaces.ts
│       │   ├── search.ts
│       │   ├── search-api.ts
│       │   ├── users.ts
│       │   ├── refresh-tokens.ts
│       │   ├── password-reset-tokens.ts
│       │   ├── comments.ts
│       │   └── seed-admin.ts
│       └── routes/
│           ├── admin.ts
│           ├── auth.ts
│           ├── folders.ts
│           ├── notes.ts
│           ├── spaces.ts
│           └── search.ts
└── frontend/
    └── src/app/
        ├── admin/
        │   └── admin.ts
        ├── auth/
        │   ├── account/
        │   │   └── account.ts
        │   ├── login/
        │   │   └── login.ts
        │   ├── switch-profile/
        │   │   └── switch-profile.ts
        │   ├── forgot-password/
        │   │   └── forgot-password.ts
        │   ├── onboarding/
        │   │   └── onboarding.ts
        │   └── reset-password/
        │       └── reset-password.ts
        ├── core/
        │   ├── access/
        │   │   └── viewer-access.service.ts
        │   ├── auth/
        │   │   ├── auth-error-message.ts
        │   │   ├── google-auth.service.ts
        │   │   ├── auth.interceptor.ts
        │   │   ├── auth.service.ts
        │   │   └── auth.guards.ts
        │   ├── api/
        │   │   ├── admin.service.ts
        │   │   ├── folders.service.ts
        │   │   ├── notes.service.ts
        │   │   ├── spaces.service.ts
        │   │   └── search.service.ts
        │   └── sidebar/
        │       ├── favourite.service.ts
        │       ├── recent.service.ts
        │       └── recent-grouping.ts
        ├── search-bar/
        ├── home/
        └── workspace/
            ├── workspace.ts
            ├── workspace.html
            ├── workspace.scss
            ├── workspace-empty/
            ├── drag/
            │   ├── folder-drag.service.ts
            │   └── note-drag.service.ts
            ├── icons/
            │   ├── icon-docs.ts
            │   └── icon-space-avatar.ts
            ├── folder-tree/
            │   ├── folder-tree.ts
            │   ├── folder-tree.html
            │   ├── folder-tree.scss
            │   ├── folder-tree-item.ts
            │   ├── folder-tree-item.html
            │   └── folder-tree-item.scss
            ├── notes-list/
            │   ├── notes-list.ts
            │   ├── notes-list.html
            │   └── notes-list.scss
            ├── note-editor/
            │   ├── note-editor.ts
            │   ├── note-editor.html
            │   ├── note-editor.scss
            │   ├── note-unsaved-changes.service.ts
            │   ├── unified-note-editor.ts
            │   ├── block-text/
            │   ├── block-code/
            │   └── note-reference-card/
            ├── recent-pages/
            │   └── recent-pages.ts
            └── sidebar/
                ├── sidebar-about.ts
                ├── sidebar-recent.ts
                ├── sidebar-favourite.ts
                ├── sidebar-section.ts
                ├── sidebar-spaces.ts
                ├── sidebar-spaces.html
                ├── sidebar-spaces.scss
                ├── create-space-modal/
                │   └── create-space-modal.ts
                ├── edit-space-modal/
                │   └── edit-space-modal.ts
                └── delete-space-modal/
```

## File Relationships

- **Backend entrypoint:** `backend/src/index.ts` mounts `auth`, `admin`, `folders`, `notes`, `spaces`, `search` routes and applies `optionalAuth` before APIs that can vary behavior by identity.
- **Backend auth flow:** `routes/auth.ts` handles register/login/guest/google/refresh/logout/onboarding/password reset plus browser profile listing/clearing, `auth/google.ts` verifies Google `id_token` credentials, `auth/token.ts` issues/verifies access tokens and opaque token material, `auth/middleware.ts` resolves request identity and admin capability, `db/users.ts` persists admin/user/guest identities plus Google links, `db/refresh-tokens.ts` persists revocable refresh sessions keyed by `profile_key`, `011_refresh_token_profiles.sql` extends refresh session storage for multi-profile browser switching, `db/password-reset-tokens.ts` persists one-time password reset tokens, and `mail/password-reset.ts` turns reset tokens into SMTP-delivered emails or dev preview links.
- **Comments flow:** `routes/notes.ts` exposes note comment reads/writes and `db/comments.ts` stores snapshot author data per comment, but the current `note-editor` no longer renders the legacy comments UI because note comments will be reintroduced through a separate redesigned surface later.
- **Admin flow:** `routes/admin.ts` exposes admin-only user and comment moderation endpoints, `core/api/admin.service.ts` consumes them on the frontend, and `admin/admin.ts` renders the admin panel for user overview and comment deletion.
- **Backend data flow:** `routes/*` -> `auth/middleware.ts` (when needed) -> `db/*` -> `db/index.ts` (PostgreSQL pool).
- **Frontend entrypoint:** `frontend/src/main.ts` -> `app.config.ts` (Router + HttpClient) -> `app.routes.ts`; root `app.ts` / `app.html` / `app.scss` also own the header profile menu, browser-persisted theme selection, and route-aware centered auth layout.
- **Frontend auth flow:** `core/auth/auth.service.ts` owns the current identity, active browser `profile_key`, saved browser profile list, in-memory access token, and auth capability status from `/api/auth/status`; `core/auth/google-auth.service.ts` loads and renders Google Identity Services; `core/auth/auth-error-message.ts` maps backend auth error codes into UI copy; `auth.interceptor.ts` attaches the access token and refresh-capable credentials to API calls while leaving browser-profile endpoints public; `auth.guards.ts` redirects incomplete sessions but allows `/login?addAccount=1`; `auth/switch-profile/switch-profile.ts` is the dedicated saved-profile chooser with browser-session clearing and the entry point for switching accounts; `auth/login/login.ts` handles sign in/sign up/guest/Google entry plus add-account mode; `auth/account/account.ts` manages profile/password/Google-link settings for non-guest accounts; `auth/forgot-password/forgot-password.ts` starts reset requests and surfaces SMTP/configuration failures while still showing dev preview links when available; `auth/reset-password/reset-password.ts` applies reset tokens; `auth/onboarding/onboarding.ts` completes required nickname setup; and `viewer-access.service.ts` exposes derived UI permissions.
- **Workspace route tree:** `/login` opens auth entry and `/login?addAccount=1` allows adding another saved profile, `/switch-profile` opens the dedicated saved-profile switcher, `/forgot-password` starts password reset, `/reset-password?token=...` applies a reset token, `/onboarding` completes required nickname setup for non-guest accounts, `/home` -> `workspace/*`; `/home/notes/:id` opens note editor; `/home/recent` opens full recent pages list.
- **Sidebar composition:** `workspace.ts` composes `sidebar-about`, `sidebar-recent`, `sidebar-favourite`, `sidebar-spaces`.
- **Recent flow:** `note-editor` writes opened notes to `RecentService`; `sidebar-recent` shows a capped preview and links to `/home/recent`; `recent-pages` renders the full capped history grouped by date.
- **Unified note editor flow:** `note-editor.html` places `app-unified-note-editor` before the note header so the editing toolbar can render above the title while the editable surface still stays below note metadata. `unified-note-editor.ts` owns the single TipTap body editor, top-right editor controls, grouped toolbar state, legacy block-to-document conversion, and the toolbar/menu interaction logic. The top-right controls now use an explicit `Edit -> Cancel / Update` flow instead of the previous single editing toggle, so body changes are committed through the `Update` action and `Cancel` restores the last persisted document snapshot. `note-unsaved-changes.service.ts` tracks per-note dirty/saving/error state, stores local draft JSON in browser storage, restores drafts after reload/navigation, and exposes a flush hook so external UI actions can force-save the current note body before publishing it. Shared toolbar and editor-surface presentation now lives in `frontend/src/styles.scss` to keep the component style budget under Angular limits. The editor loads `note_blocks` through `notes.service.ts`, prefers a canonical `rich_text` body block stored as TipTap JSON in `data.doc`, collapses legacy `text` / `code` / `note_link` blocks into one editor document for compatibility, and persists the unified document back through the existing block routes. Public note headers now also consume creator profile metadata from the note payload so they can render a compact avatar plus `by <nickname>` line without deriving author data from the body. `db/search.ts` must flatten the richer TipTap document so note search keeps indexing note body text.
- **Note publish guard flow:** `notes-list.ts` now checks `note-unsaved-changes.service.ts` before toggling note visibility; if the open note has unsaved body edits, the list requests a flush first and only applies `PUBLIC/PRIVATE` after the editor save succeeds.
- **Note creator flow:** `012_note_creators.sql` adds an optional `notes.created_by_user_id` link to `users`, `routes/notes.ts` stamps new user-created notes with the authenticated admin id, `db/notes.ts` joins the creator profile into note reads, and `frontend/core/api/notes.service.ts` exposes that metadata to `note-editor` for compact public-note attribution.
- **Viewer capability flow:** `viewer-access.service` mirrors `AuthService` capabilities and exposes shared UI permissions such as `isGuest`, `isAuthenticated`, `isAdmin`, `canEdit`, and `canDrag`, which are consumed by `folder-tree`, `folder-tree-item`, `notes-list`, `note-editor`, and `sidebar-spaces`.
- **Space avatar flow:** `create-space-modal` and `edit-space-modal` select `avatar_key` (1..12), `spaces.service` sends it to backend, `spaces` route/db persist it, and `sidebar-spaces` renders the selected icon via `icon-space-avatar`.
- **Space-isolated content flow:** `sidebar-spaces` controls active `space` and active folder, passes `rootFolderId` + `selectedFolderId` to `folder-tree`. `folder-tree-item` renders nested folders and their `notes-list` inline per folder, so collapse/expand and note visibility are scoped to each folder instance.
- **Drag flow:** `sidebar-spaces` provides the shared `cdkDropListGroup` for a space, `folder-tree` handles folder root moves, `folder-tree-item` handles folder nesting plus note-hover auto-expand, and `notes-list` handles note reorder/move and schedules persistence through `note-drag.service`.
- **Create flow in sidebar:** `Content (+)` and folder `(+)` open popover actions (`Folder` / `Page`) and create directly in the bound target folder (`space.root_folder_id` for Content or current folder for folder row).
