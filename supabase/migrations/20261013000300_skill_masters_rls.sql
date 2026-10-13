-- skill_masters RLS. Replaces the open policies, which let anon read every
-- school's skills.
--   school_admin, center_head: full access to their own school's skills
--   super_admin:               full access to every school's skills
--   teacher, staff:            read, create and update their own school's skills
--   parent:                    read the skills of their children's schools,
--                              via parent_students -> students
--   anon:                      no access (every policy is for authenticated only)

begin;

-- Drop every existing policy on the table so this file is the whole picture.
do $$
declare p record;
begin
  for p in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'skill_masters'
  loop
    execute format('drop policy %I on public.skill_masters', p.policyname);
  end loop;
end $$;

alter table public.skill_masters enable row level security;

-- Policies look up rows by school_id.
create index if not exists skill_masters_school_id_idx
  on public.skill_masters (school_id);

create policy "skill_masters_admin_all" on public.skill_masters
  for all to authenticated
  using (exists (
    select 1 from public.profiles pr
    where pr.id = auth.uid()
      and pr.school_id = skill_masters.school_id
      and pr.role in ('school_admin', 'center_head')
  ))
  with check (exists (
    select 1 from public.profiles pr
    where pr.id = auth.uid()
      and pr.school_id = skill_masters.school_id
      and pr.role in ('school_admin', 'center_head')
  ));

create policy "skill_masters_super_admin_all" on public.skill_masters
  for all to authenticated
  using (exists (
    select 1 from public.profiles pr
    where pr.id = auth.uid() and pr.role = 'super_admin'
  ))
  with check (exists (
    select 1 from public.profiles pr
    where pr.id = auth.uid() and pr.role = 'super_admin'
  ));

create policy "skill_masters_teacher_select" on public.skill_masters
  for select to authenticated
  using (exists (
    select 1 from public.profiles pr
    where pr.id = auth.uid()
      and pr.school_id = skill_masters.school_id
      and pr.role in ('teacher', 'staff')
  ));

create policy "skill_masters_teacher_insert" on public.skill_masters
  for insert to authenticated
  with check (exists (
    select 1 from public.profiles pr
    where pr.id = auth.uid()
      and pr.school_id = skill_masters.school_id
      and pr.role in ('teacher', 'staff')
  ));

create policy "skill_masters_teacher_update" on public.skill_masters
  for update to authenticated
  using (exists (
    select 1 from public.profiles pr
    where pr.id = auth.uid()
      and pr.school_id = skill_masters.school_id
      and pr.role in ('teacher', 'staff')
  ))
  with check (exists (
    select 1 from public.profiles pr
    where pr.id = auth.uid()
      and pr.school_id = skill_masters.school_id
      and pr.role in ('teacher', 'staff')
  ));

create policy "skill_masters_parent_select" on public.skill_masters
  for select to authenticated
  using (exists (
    select 1 from public.students s
    join public.parent_students ps on ps.student_id = s.id
    where s.school_id = skill_masters.school_id
      and ps.parent_id = auth.uid()
  ));

commit;
