-- Album videos have no photo, so photo_url must be optional.
-- Video rows carry video_url, plus thumbnail_url for the poster frame the
-- admin album uploader captures from the file.
alter table public.classroom_moments
  alter column photo_url drop not null;
