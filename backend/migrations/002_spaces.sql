-- Spaces: each space has a root folder and an "about" note
CREATE TABLE spaces (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  root_folder_id INT NOT NULL UNIQUE REFERENCES folders(id) ON DELETE CASCADE,
  about_note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE
);

CREATE INDEX idx_spaces_root_folder_id ON spaces(root_folder_id);
