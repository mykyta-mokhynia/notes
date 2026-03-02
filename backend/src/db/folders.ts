import { query } from './index';
import type { Folder, FolderRow } from '../types';

const FOLDER_COLS = 'id, parent_id, title, position, path';

function rowToFolder(r: FolderRow): Folder {
  return {
    id: r.id,
    parent_id: r.parent_id,
    title: r.title,
    position: r.position,
    path: r.path,
  };
}

export async function listFoldersTree(): Promise<Folder[]> {
  const { rows } = await query<FolderRow>(
    `SELECT ${FOLDER_COLS} FROM folders ORDER BY path`
  );
  return rows.map(rowToFolder);
}

export async function getFolderById(id: number): Promise<Folder | null> {
  const { rows } = await query<FolderRow>(
    `SELECT ${FOLDER_COLS} FROM folders WHERE id = $1`,
    [id]
  );
  return rows[0] ? rowToFolder(rows[0]) : null;
}

export async function createFolder(
  parentId: number | null,
  title: string,
  position: string
): Promise<Folder> {
  const { rows } = await query<FolderRow>(
    `INSERT INTO folders (parent_id, title, position) VALUES ($1, $2, $3) RETURNING ${FOLDER_COLS}`,
    [parentId, title, position]
  );
  const created = rowToFolder(rows[0]);
  // Trigger sets path; refetch to get path (or we could compute it)
  const refetched = await getFolderById(created.id);
  return refetched ?? created;
}

export async function updateFolder(
  id: number,
  data: { title?: string; position?: string }
): Promise<Folder | null> {
  const updates: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  if (data.title !== undefined) {
    updates.push(`title = $${i++}`);
    values.push(data.title);
  }
  if (data.position !== undefined) {
    updates.push(`position = $${i++}`);
    values.push(data.position);
  }
  if (updates.length === 0) return getFolderById(id);
  values.push(id);
  const { rows } = await query<FolderRow>(
    `UPDATE folders SET ${updates.join(', ')} WHERE id = $${i} RETURNING ${FOLDER_COLS}`,
    values
  );
  return rows[0] ? rowToFolder(rows[0]) : null;
}

/** Delete folder and all descendants (CASCADE). Notes in folder and descendants are CASCADE deleted. */
export async function deleteFolder(id: number): Promise<boolean> {
  const result = await query('DELETE FROM folders WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
}

/**
 * Move folder to new parent. Updates path of the folder and all descendants (ltree prefix replace).
 */
export async function moveFolder(
  folderId: number,
  newParentId: number | null
): Promise<Folder | null> {
  const folder = await getFolderById(folderId);
  if (!folder || !folder.path) return null;

  const oldPath = folder.path;
  let newPath: string;
  if (newParentId === null) {
    newPath = `f${folderId}`;
  } else {
    const parent = await getFolderById(newParentId);
    if (!parent || !parent.path) return null;
    newPath = `${parent.path}.f${folderId}`;
  }
  if (oldPath === newPath) return folder;

  // Move folder: update parent_id (path will be updated in same statement via expression)
  await query(
    `UPDATE folders SET parent_id = $1, path = $2::ltree WHERE id = $3`,
    [newParentId, newPath, folderId]
  );

  // Update all descendants: replace prefix oldPath with newPath
  await query(
    `UPDATE folders
     SET path = $1::ltree || subpath(path, nlevel($2::ltree))
     WHERE path <@ $2::ltree AND path != $2::ltree`,
    [newPath, oldPath]
  );

  return getFolderById(folderId);
}
