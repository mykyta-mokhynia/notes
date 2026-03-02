# PROJECT_STRUCTURE

```
notes/
├── package.json
├── README.md
├── AI_INSTRUCTIONS.md
├── AI_LOGS.md
├── PROJECT_STRUCTURE.md
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── nodemon.json
│   ├── .env.example
│   ├── .gitignore
│   ├── migrations/
│   │   └── 001_initial.sql
│   └── src/
│       ├── index.ts
│       ├── config.ts
│       ├── types.tsм
│       ├── db/
│       │   ├── index.ts
│       │   ├── migrate.ts
│       │   ├── folders.ts
│       │   ├── notes.ts
│       │   ├── blocks.ts
│       │   ├── search.ts
│       │   └── search-api.ts
│       └── routes/
│           ├── folders.ts
│           ├── notes.ts
│           └── search.ts
└── frontend/
    ├── package.json
    ├── angular.json
    ├── tsconfig.json
    ├── tsconfig.app.json
    ├── public/
    │   └── .gitkeep
    └── src/
        ├── main.ts
        ├── index.html
        ├── styles.scss
        ├── environments/
        │   ├── environment.ts
        │   └── environment.prod.ts
        └── app/
            ├── app.ts
            ├── app.html
            ├── app.scss
            ├── app.config.ts
            ├── app.routes.ts
            ├── core/
            │   └── api/
            │       ├── folders.service.ts
            │       ├── notes.service.ts
            │       └── search.service.ts
            ├── search-bar/
            │   ├── search-bar.ts
            │   ├── search-bar.html
            │   └── search-bar.scss
            ├── workspace/
            │   ├── drag/
            │   │   ├── folder-drag.service.ts
            │   │   └── note-drag.service.ts
            │   ├── workspace.ts
            │   ├── workspace.html
            │   ├── workspace.scss
            │   ├── workspace-empty/
            │   │   └── workspace-empty.ts
            │   ├── folder-tree/
            │   │   ├── folder-tree.ts
            │   │   ├── folder-tree.html
            │   │   ├── folder-tree.scss
            │   │   ├── folder-tree-item.ts
            │   │   ├── folder-tree-item.html
            │   │   └── folder-tree-item.scss
            │   ├── notes-list/
            │   │   ├── notes-list.ts
            │   │   ├── notes-list.html
            │   │   └── notes-list.scss
            │   └── note-editor/
            │       ├── note-editor.ts
            │       ├── note-editor.html
            │       ├── note-editor.scss
            │       ├── block-text/
            │       │   ├── block-text.ts
            │       │   ├── block-text.html
            │       │   └── block-text.scss
            │       ├── block-code/
            │       └── note-reference-card/
            └── home/
                ├── home.ts
                ├── home.html
                └── home.scss
```

## File Relationships

- **Backend entry:** `backend/src/index.ts` — loads config (dotenv), Express with CORS, helmet, JSON body. Mounts `/api/folders`, `/api/notes`, `/api/search`. Health at `/api/health`.
- **Backend data:** `config.ts` → `db/index.ts` (pg pool). `db/folders.ts`, `db/notes.ts`, `db/blocks.ts` use `db/index` for queries. Routes use db modules.
- **Migrations:** `backend/migrations/*.sql` applied by `npm run migrate` (ts-node `src/db/migrate.ts`). Requires `DATABASE_URL`.
- **Frontend entry:** `main.ts` → App. `app.config.ts`: Router, HttpClient. `app.routes.ts`: `/` → `/home`; `/home` loads Workspace with children `''` (empty), `notes/:id` (NoteEditor).
- **Frontend data flow:** `core/api` (folders, notes, search). App nav includes SearchBarComponent (GET /api/search, debounce). Workspace: FolderTreeComponent (CDK drag, FolderDragService), NotesListComponent (CDK drag, NoteDragService). NoteEditor: TipTap text block, block-code, note_link (NoteReferenceCard), ↑↓ reorder + rebalance, scroll-to-first-match from search. Routes: query `folder` preselects folder, query `q` on note opens with scroll-to-match.
- **Root:** `package.json` runs backend via `npm run dev:backend`, frontend via `npm run dev:frontend`.
