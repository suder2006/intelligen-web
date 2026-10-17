-- Tag each skill activity with the program, term and month it belongs to, so
-- grading screens show only that program's activities. Existing rows keep nulls
-- and are treated as matching every program/term/month.

alter table public.skill_activities
  add column if not exists program text,
  add column if not exists term text,
  add column if not exists month text;
