-- progress_reports RLS. Replaces the open "Allow all" policy, which let any
-- user (including anon) read and write every school's reports.
-- The table has no school_id; the school comes from the student
-- (progress_reports.student_id -> students.school_id).
--   school_admin, center_head: full access to their own school's reports
--   super_admin:               full access to every school's reports
--   teacher, staff:            read, create and update their own school's reports
--   parent:                    read their own children's reports, drafts included
--                              (the parent screens use drafts to keep unsent
--                              months hidden). Parents have profiles.school_id =
--                              null, so this goes through parent_students.
--   anon:                      no access (every policy is for authenticated only)

begin;

-- Drop every existing policy on the table, "Allow all" included,
-- so this file is the whole picture.
do $$
declare p record;
begin
  for p in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'progress_reports'
  loop
    execute format('drop policy %I on public.progress_reports', p.policyname);
  end loop;
end $$;

alter table public.progress_reports enable row level security;

-- Policies look up reports by student_id.
create index if not exists progress_reports_student_id_idx
  on public.progress_reports (student_id);

create policy "progress_reports_admin_all" on public.progress_reports
  for all to authenticated
  using (exists (
    select 1 from public.students s
    join public.profiles pr on pr.school_id = s.school_id
    where s.id = progress_reports.student_id
      and pr.id = auth.uid()
      and pr.role in ('school_admin', 'center_head')
  ))
  with check (exists (
    select 1 from public.students s
    join public.profiles pr on pr.school_id = s.school_id
    where s.id = progress_reports.student_id
      and pr.id = auth.uid()
      and pr.role in ('school_admin', 'center_head')
  ));

create policy "progress_reports_super_admin_all" on public.progress_reports
  for all to authenticated
  using (exists (
    select 1 from public.profiles pr
    where pr.id = auth.uid() and pr.role = 'super_admin'
  ))
  with check (exists (
    select 1 from public.profiles pr
    where pr.id = auth.uid() and pr.role = 'super_admin'
  ));

create policy "progress_reports_teacher_select" on public.progress_reports
  for select to authenticated
  using (exists (
    select 1 from public.students s
    join public.profiles pr on pr.school_id = s.school_id
    where s.id = progress_reports.student_id
      and pr.id = auth.uid()
      and pr.role in ('teacher', 'staff')
  ));

create policy "progress_reports_teacher_insert" on public.progress_reports
  for insert to authenticated
  with check (exists (
    select 1 from public.students s
    join public.profiles pr on pr.school_id = s.school_id
    where s.id = progress_reports.student_id
      and pr.id = auth.uid()
      and pr.role in ('teacher', 'staff')
  ));

create policy "progress_reports_teacher_update" on public.progress_reports
  for update to authenticated
  using (exists (
    select 1 from public.students s
    join public.profiles pr on pr.school_id = s.school_id
    where s.id = progress_reports.student_id
      and pr.id = auth.uid()
      and pr.role in ('teacher', 'staff')
  ))
  with check (exists (
    select 1 from public.students s
    join public.profiles pr on pr.school_id = s.school_id
    where s.id = progress_reports.student_id
      and pr.id = auth.uid()
      and pr.role in ('teacher', 'staff')
  ));

create policy "progress_reports_parent_select" on public.progress_reports
  for select to authenticated
  using (exists (
    select 1 from public.parent_students ps
    where ps.student_id = progress_reports.student_id
      and ps.parent_id = auth.uid()
  ));

commit;
