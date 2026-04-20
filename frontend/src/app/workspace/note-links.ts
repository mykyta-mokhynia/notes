import type { Note } from '../core/api/notes.service';
import type { Space } from '../core/api/spaces.service';

const TOKEN_SEPARATOR = '--';

function slugify(value: string): string {
  const base = value
    .toLowerCase()
    .trim()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || 'item';
}

export function buildSpaceToken(space: Pick<Space, 'id' | 'name'>): string {
  return `${slugify(space.name)}${TOKEN_SEPARATOR}${space.id}`;
}

export function buildNoteToken(note: Pick<Note, 'id' | 'title'>): string {
  return `${slugify(note.title || 'note')}${TOKEN_SEPARATOR}${note.id}`;
}

export function parseNoteIdToken(rawToken: string | null | undefined): string | null {
  if (!rawToken) return null;
  const token = decodeURIComponent(rawToken).trim();
  if (!token) return null;
  const separatorIndex = token.lastIndexOf(TOKEN_SEPARATOR);
  if (separatorIndex === -1) return token;
  const idPart = token.slice(separatorIndex + TOKEN_SEPARATOR.length).trim();
  return idPart || token;
}

export function parseSpaceIdToken(rawToken: string | null | undefined): number | null {
  if (!rawToken) return null;
  const token = decodeURIComponent(rawToken).trim();
  if (!token) return null;
  const direct = Number.parseInt(token, 10);
  if (Number.isFinite(direct)) return direct;
  const separatorIndex = token.lastIndexOf(TOKEN_SEPARATOR);
  if (separatorIndex === -1) return null;
  const idPart = token.slice(separatorIndex + TOKEN_SEPARATOR.length).trim();
  const parsed = Number.parseInt(idPart, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function resolveSpaceIdToken(rawToken: string | null | undefined, spaces: Space[]): number | null {
  const parsedId = parseSpaceIdToken(rawToken);
  if (parsedId !== null) return parsedId;
  if (!rawToken) return null;
  const token = decodeURIComponent(rawToken).trim().toLowerCase();
  if (!token) return null;
  const bySlug = spaces.find((space) => slugify(space.name) === token);
  return bySlug?.id ?? null;
}
