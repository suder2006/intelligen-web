-- Learning outcomes change month to month (e.g. Colour Recognition: red in June, red and
-- blue in July), so like activities they carry the term and month they belong to.
-- Progress screens show only outcomes whose program, term and month all match.
-- Existing outcomes can't be backfilled (nothing records their month): delete them and
-- re-upload the Excel files, which re-creates them tagged.

alter table public.skill_learning_outcomes
  add column if not exists term text,
  add column if not exists month text;
