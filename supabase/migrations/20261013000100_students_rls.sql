-- students RLS. Replaces the open policies, which let anon read every
-- school's children.
--   school_admin, center_head: full access to their own school's students
--   super_admin:               full access to every school's students
--   teacher, staff:            read, create and update their own school's students
--   driver:                    read their own school's students (route lists
--                              embed student names and parent phone numbers)
--   parent:                    read their own children only, via parent_students
--                              (most parents also have a school_id, but some
--                              have null, so school_id is not used for parents)
--   anon:                      no access (every policy is for authenticated only)

begin;

-- Drop every existing policy on the table so this file is the whole picture.
do $$
declare p record;
begin
  for p in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'students'
  loop
    execute format('drop policy %I on public.students', p.policyname);
  end loop;
end $$;

alter table public.students enable row level security;

-- Policies look up rows by school_id.
create index if not exists students_school_id_idx
  on public.students (school_id);

create policy "students_admin_all" on public.students
  for all to authenticated
  using (exists (
    select 1 from public.profiles pr
    where pr.id = auth.uid()
      and pr.school_id = students.school_id
      and pr.role in ('school_admin', 'center_head')
  ))
  with check (exists (
    select 1 from public.profiles pr
    where pr.id = auth.uid()
      and pr.school_id = students.school_id
      and pr.role in ('school_admin', 'center_head')
  ));

create policy "students_super_admin_all" on public.students
  for all to authenticated
  using (exists (
    select 1 from public.profiles pr
    where pr.id = auth.uid() and pr.role = 'super_admin'
  ))
  with check (exists (
    select 1 from public.profiles pr
    where pr.id = auth.uid() and pr.role = 'super_admin'
  ));

create policy "students_teacher_select" on public.students
  for select to authenticated
  using (exists (
    select 1 from public.profiles pr
    where pr.id = auth.uid()
      and pr.school_id = students.school_id
      and pr.role in ('teacher', 'staff')
  ));

create policy "students_teacher_insert" on public.students
  for insert to authenticated
  with check (exists (
    select 1 from public.profiles pr
    where pr.id = auth.uid()
      and pr.school_id = students.school_id
      and pr.role in ('teacher', 'staff')
  ));

create policy "students_teacher_update" on public.students
  for update to authenticated
  using (exists (
    select 1 from public.profiles pr
    where pr.id = auth.uid()
      and pr.school_id = students.school_id
      and pr.role in ('teacher', 'staff')
  ))
  with check (exists (
    select 1 from public.profiles pr
    where pr.id = auth.uid()
      and pr.school_id = students.school_id
      and pr.role in ('teacher', 'staff')
  ));

create policy "students_driver_select" on public.students
  for select to authenticated
  using (exists (
    select 1 from public.profiles pr
    where pr.id = auth.uid()
      and pr.school_id = students.school_id
      and pr.role in ('driver')
  ));

create policy "students_parent_select" on public.students
  for select to authenticated
  using (exists (
    select 1 from public.parent_students ps
    where ps.student_id = students.id
      and ps.parent_id = auth.uid()
  ));

commit;
