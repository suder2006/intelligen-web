-- progress_ratings RLS. Replaces the open policies, which let anon read
-- every child's ratings. The table has no school_id; the school comes from
-- the student (progress_ratings.student_id -> students.school_id).
--   school_admin, center_head: full access to their own school's ratings
--   super_admin:               full access to every school's ratings
--   teacher, staff:            read, create and update their own school's ratings
--                              (the teacher screens upsert, which needs all three)
--   parent:                    read their own children's ratings, via parent_students
--   anon:                      no access (every policy is for authenticated only)

begin;

-- Drop every existing policy on the table so this file is the whole picture.
do $$
declare p record;
begin
  for p in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'progress_ratings'
  loop
    execute format('drop policy %I on public.progress_ratings', p.policyname);
  end loop;
end $$;

alter table public.progress_ratings enable row level security;

-- Policies look up rows by student_id.
create index if not exists progress_ratings_student_id_idx
  on public.progress_ratings (student_id);

create policy "progress_ratings_admin_all" on public.progress_ratings
  for all to authenticated
  using (exists (
    select 1 from public.students s
    join public.profiles pr on pr.school_id = s.school_id
    where s.id = progress_ratings.student_id
      and pr.id = auth.uid()
      and pr.role in ('school_admin', 'center_head')
  ))
  with check (exists (
    select 1 from public.students s
    join public.profiles pr on pr.school_id = s.school_id
    where s.id = progress_ratings.student_id
      and pr.id = auth.uid()
      and pr.role in ('school_admin', 'center_head')
  ));

create policy "progress_ratings_super_admin_all" on public.progress_ratings
  for all to authenticated
  using (exists (
    select 1 from public.profiles pr
    where pr.id = auth.uid() and pr.role = 'super_admin'
  ))
  with check (exists (
    select 1 from public.profiles pr
    where pr.id = auth.uid() and pr.role = 'super_admin'
  ));

create policy "progress_ratings_teacher_select" on public.progress_ratings
  for select to authenticated
  using (exists (
    select 1 from public.students s
    join public.profiles pr on pr.school_id = s.school_id
    where s.id = progress_ratings.student_id
      and pr.id = auth.uid()
      and pr.role in ('teacher', 'staff')
  ));

create policy "progress_ratings_teacher_insert" on public.progress_ratings
  for insert to authenticated
  with check (exists (
    select 1 from public.students s
    join public.profiles pr on pr.school_id = s.school_id
    where s.id = progress_ratings.student_id
      and pr.id = auth.uid()
      and pr.role in ('teacher', 'staff')
  ));

create policy "progress_ratings_teacher_update" on public.progress_ratings
  for update to authenticated
  using (exists (
    select 1 from public.students s
    join public.profiles pr on pr.school_id = s.school_id
    where s.id = progress_ratings.student_id
      and pr.id = auth.uid()
      and pr.role in ('teacher', 'staff')
  ))
  with check (exists (
    select 1 from public.students s
    join public.profiles pr on pr.school_id = s.school_id
    where s.id = progress_ratings.student_id
      and pr.id = auth.uid()
      and pr.role in ('teacher', 'staff')
  ));

create policy "progress_ratings_parent_select" on public.progress_ratings
  for select to authenticated
  using (exists (
    select 1 from public.parent_students ps
    where ps.student_id = progress_ratings.student_id
      and ps.parent_id = auth.uid()
  ));

commit;
