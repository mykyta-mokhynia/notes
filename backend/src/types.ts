export type NoteVisibility = 'PRIVATE' | 'PUBLIC';

export interface Folder {
  id: number;
  parent_id: number | null;
  title: string;
  position: string;
  path: string | null;
}

export interface Note {
  id: string;
  folder_id: number;
  title: string;
  position: string;
  visibility: NoteVisibility;
  created_at: Date;
  updated_at: Date;
  search_dirty?: boolean;
}

export interface NoteBlock {
  id: string;
  note_id: string;
  type: string;
  position: string;
  version: number;
  data: Record<string, unknown>;
}

export interface FolderRow {
  id: number;
  parent_id: number | null;
  title: string;
  position: string;
  path: string | null;
}

export interface NoteRow {
  id: string;
  folder_id: number;
  title: string;
  position: string;
  visibility: NoteVisibility;
  created_at: Date;
  updated_at: Date;
  search_dirty: boolean;
}

export interface NoteBlockRow {
  id: string;
  note_id: string;
  type: string;
  position: string;
  version: number;
  data: Record<string, unknown>;
}

export interface Space {
  id: number;
  name: string;
  root_folder_id: number;
  about_note_id: string | null;
}

export interface SpaceRow {
  id: number;
  name: string;
  root_folder_id: number;
  about_note_id: string | null;
}
