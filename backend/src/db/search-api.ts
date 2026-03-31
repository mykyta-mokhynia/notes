import { query } from './index';

export interface SearchFolderHit {
  type: 'folder';
  id: number;
  title: string;
  path: string | null;
}

export interface SearchNoteHit {
  type: 'note';
  id: string;
  title: string;
  folder_id: number;
}

export type SearchHit = SearchFolderHit | SearchNoteHit;

/**
 * Search folders by title (ilike) and notes by title (ilike) and by content (FTS on searchable_tsv).
 * Returns combined list: folders and notes matching the query.
 */
export async function searchFoldersAndNotes(
  q: string,
  includePrivate = true
): Promise<SearchHit[]> {
  const term = q.trim();
  if (!term) return [];
  const pattern = `%${term.replace(/%/g, '\\%').replace(/_/g, '\\_')}%`;
  const tsQuery = term.split(/\s+/).filter(Boolean).map((w) => w.replace(/'/g, "''")).join(' & ');
  const folderVisibility = includePrivate
    ? ''
    : `AND EXISTS (
        SELECT 1
        FROM spaces s
        INNER JOIN folders root ON root.id = s.root_folder_id
        WHERE s.visibility = 'PUBLIC'
          AND folders.path IS NOT NULL
          AND root.path IS NOT NULL
          AND folders.path <@ root.path
      )`;
  const noteVisibility = includePrivate ? '' : `AND visibility = 'PUBLIC'`;

  const [folderRows, noteTitleRows, noteContentRows] = await Promise.all([
    query<{ id: number; title: string; path: string | null }>(
      `SELECT id, title, path FROM folders WHERE title ILIKE $1 ${folderVisibility} ORDER BY path`,
      [pattern]
    ),
    query<{ id: string; title: string; folder_id: number }>(
      `SELECT id, title, folder_id FROM notes WHERE title ILIKE $1 ${noteVisibility} ORDER BY updated_at DESC`,
      [pattern]
    ),
    tsQuery
      ? query<{ id: string; title: string; folder_id: number }>(
          `SELECT id, title, folder_id FROM notes
           WHERE searchable_tsv @@ plainto_tsquery('simple', $1)
             ${noteVisibility}
           ORDER BY ts_rank(searchable_tsv, plainto_tsquery('simple', $1)) DESC`,
          [term.replace(/'/g, "''")]
        )
      : { rows: [] as { id: string; title: string; folder_id: number }[] },
  ]);

  const seenNotes = new Set<string>();
  const result: SearchHit[] = [];

  for (const r of folderRows.rows) {
    result.push({ type: 'folder', id: r.id, title: r.title, path: r.path });
  }
  for (const r of noteTitleRows.rows) {
    if (!seenNotes.has(r.id)) {
      seenNotes.add(r.id);
      result.push({ type: 'note', id: r.id, title: r.title, folder_id: r.folder_id });
    }
  }
  for (const r of noteContentRows.rows) {
    if (!seenNotes.has(r.id)) {
      seenNotes.add(r.id);
      result.push({ type: 'note', id: r.id, title: r.title, folder_id: r.folder_id });
    }
  }

  return result;
}
