-- Enable ltree for folder paths (segment = folder id: f1.f2.f3)
CREATE EXTENSION IF NOT EXISTS ltree;

-- Visibility for notes
CREATE TYPE note_visibility AS ENUM ('PRIVATE', 'PUBLIC');

-- Folders: tree with path (ltree), segment = 'f'||id
CREATE TABLE folders (
  id SERIAL PRIMARY KEY,
  parent_id INT REFERENCES folders(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  position NUMERIC(20,10) NOT NULL DEFAULT 1,
  path LTREE
);

CREATE INDEX idx_folders_path ON folders USING GIST (path);
CREATE INDEX idx_folders_parent_id ON folders(parent_id);

-- Trigger: set path on folder insert/update
CREATE OR REPLACE FUNCTION folders_set_path()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.parent_id IS NULL THEN
    NEW.path := ('f' || NEW.id)::ltree;
  ELSE
    NEW.path := (SELECT path FROM folders WHERE id = NEW.parent_id) || ('f' || NEW.id)::ltree;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Run after insert to set path from id (id is known only after insert)
CREATE OR REPLACE FUNCTION folders_after_insert()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.parent_id IS NULL THEN
    UPDATE folders SET path = ('f' || NEW.id)::ltree WHERE id = NEW.id;
  ELSE
    UPDATE folders SET path = (SELECT path FROM folders WHERE id = NEW.parent_id) || ('f' || NEW.id)::ltree WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER folders_after_insert_trigger
  AFTER INSERT ON folders
  FOR EACH ROW
  EXECUTE PROCEDURE folders_after_insert();

-- Notes: metadata, searchable_tsv, search_dirty
CREATE TABLE notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id INT NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  position NUMERIC(20,10) NOT NULL DEFAULT 1,
  visibility note_visibility NOT NULL DEFAULT 'PRIVATE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  searchable_tsv TSVECTOR,
  search_dirty BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX idx_notes_folder_id ON notes(folder_id);
CREATE INDEX idx_notes_searchable_tsv ON notes USING GIN (searchable_tsv);

-- Note blocks: type, position (numeric), version, data (jsonb)
CREATE TABLE note_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  position NUMERIC(20,10) NOT NULL,
  version INT NOT NULL DEFAULT 1,
  data JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX idx_note_blocks_note_id ON note_blocks(note_id);
CREATE INDEX idx_note_blocks_note_position ON note_blocks(note_id, position);

-- Optional: graph relations for backlinks / note links
CREATE TABLE note_relations (
  source_note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  target_note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  PRIMARY KEY (source_note_id, target_note_id),
  CHECK (source_note_id != target_note_id)
);

CREATE INDEX idx_note_relations_target ON note_relations(target_note_id);
