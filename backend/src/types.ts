export type NoteVisibility = 'PRIVATE' | 'PUBLIC';

export type UserRole = 'ADMIN' | 'USER' | 'GUEST';
export type CommentAuthorType = 'USER' | 'GUEST';

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
  created_by_user_id: number | null;
  creator_nickname: string | null;
  creator_avatar_initials: string | null;
  creator_avatar_color: string | null;
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

export interface NoteComment {
  id: string;
  note_id: string;
  author_id: number;
  author_type: CommentAuthorType;
  author_role: UserRole;
  nickname: string;
  avatar_initials: string;
  avatar_color: string;
  content: string;
  created_at: Date;
  updated_at: Date;
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
  created_by_user_id: number | null;
  creator_nickname: string | null;
  creator_avatar_initials: string | null;
  creator_avatar_color: string | null;
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

export interface NoteCommentRow {
  id: string;
  note_id: string;
  author_id: number;
  author_type: CommentAuthorType;
  author_role: UserRole;
  nickname: string;
  avatar_initials: string;
  avatar_color: string;
  content: string;
  created_at: Date;
  updated_at: Date;
}

export interface Space {
  id: number;
  name: string;
  root_folder_id: number;
  about_note_id: string | null;
  visibility: NoteVisibility;
  avatar_key: number;
}

export interface SpaceRow {
  id: number;
  name: string;
  root_folder_id: number;
  about_note_id: string | null;
  visibility: NoteVisibility;
  avatar_key: number;
}

export interface User {
  id: number;
  email: string | null;
  password_hash: string | null;
  role: UserRole;
  google_id: string | null;
  nickname: string | null;
  avatar_initials: string | null;
  avatar_color: string | null;
  profile_completed: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface UserRow {
  id: number;
  email: string | null;
  password_hash: string | null;
  role: UserRole;
  google_id: string | null;
  nickname: string | null;
  avatar_initials: string | null;
  avatar_color: string | null;
  profile_completed: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface AuthenticatedUser {
  id: number;
  email: string | null;
  nickname: string | null;
  avatar_initials: string | null;
  avatar_color: string | null;
  profile_completed: boolean;
  has_password?: boolean;
  has_google?: boolean;
  role: UserRole;
}
