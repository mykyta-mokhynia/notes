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
│   └── src/
│       ├── index.ts
│       ├── config.ts
│       ├── types.ts
│       ├── db/
│       │   ├── index.ts
│       │   ├── migrate.ts
│       │   ├── folders.ts
│       │   ├── notes.ts
│       │   ├── blocks.ts
│       │   ├── spaces.ts
│       │   ├── search.ts
│       │   └── search-api.ts
│       └── routes/
│           ├── folders.ts
│           ├── notes.ts
│           ├── spaces.ts
│           └── search.ts
└── frontend/
    └── src/app/
        ├── core/
        │   ├── api/
        │   │   ├── folders.service.ts
        │   │   ├── notes.service.ts
        │   │   ├── spaces.service.ts
        │   │   └── search.service.ts
        │   └── sidebar/
        │       ├── favourite.service.ts
        │       └── recent.service.ts
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
            │   ├── block-text/
            │   ├── block-code/
            │   └── note-reference-card/
            └── sidebar/
                ├── sidebar-about.ts
                ├── sidebar-recent.ts
                ├── sidebar-favourite.ts
                ├── sidebar-section.ts
                ├── sidebar-spaces.ts
                ├── sidebar-spaces.html
                ├── sidebar-spaces.scss
                ├── create-space-modal/
                ├── edit-space-modal/
                └── delete-space-modal/
```

## File Relationships

- **Backend entrypoint:** `backend/src/index.ts` mounts `folders`, `notes`, `spaces`, `search` routes.
- **Backend data flow:** `routes/*` -> `db/*` -> `db/index.ts` (PostgreSQL pool).
- **Frontend entrypoint:** `frontend/src/main.ts` -> `app.config.ts` (Router + HttpClient) -> `app.routes.ts`.
- **Workspace route tree:** `/home` -> `workspace/*`; `/home/notes/:id` opens note editor.
- **Sidebar composition:** `workspace.ts` composes `sidebar-about`, `sidebar-recent`, `sidebar-favourite`, `sidebar-spaces`.
- **Space-isolated content flow:** `sidebar-spaces` controls active `space` and active folder, passes `rootFolderId` + `selectedFolderId` to `folder-tree`. `folder-tree-item` renders nested folders and their `notes-list` inline per folder, so collapse/expand and note visibility are scoped to each folder instance.
- **Create flow in sidebar:** `Content (+)` and folder `(+)` open popover actions (`Folder` / `Page`) and create directly in the bound target folder (`space.root_folder_id` for Content or current folder for folder row).
