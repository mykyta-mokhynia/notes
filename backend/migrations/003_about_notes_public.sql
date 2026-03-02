-- Make all space about notes public
UPDATE notes
SET visibility = 'PUBLIC'
WHERE id IN (SELECT about_note_id FROM spaces);
