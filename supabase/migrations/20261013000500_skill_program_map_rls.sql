-- skill_program_map RLS. Replaces the open policies, which let anon read every
-- school's skill assignments. The table has no school_id; the school comes
-- from the skill (skill_program_map.skill_id -> skill_masters.school_id).
--   school_admin, center_head: full access to their own school's assignments
--   super_admin:               full access to every school's assignments
--   teacher, staff:            read, create and update their own school's assignments
--   parent:                    read the assignments of their children's schools,
--                              via parent_students -> students
--   anon:                      no access (every policy is for authenticated only)

begin;

-- Drop every existing policy on the table so this file is the whole picture.
do $$
declare p record;
begin
  for p in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'skill_program_map'
  loop
    execute format('drop policy %I on public.skill_program_map', p.policyname);
  end loop;
end $$;

alter table public.skill_program_map enable row level security;

-- Policies look up rows by skill_id.
create index if not exists skill_program_map_skill_id_idx
  on public.skill_program_map (skill_id);

create policy "skill_program_map_admin_all" on public.skill_program_map
  for all to authenticated
  using (exists (
    select 1 from public.skill_masters sm
    join public.profiles pr on pr.school_id = sm.school_id
    where sm.id = skill_program_map.skill_id
      and pr.id = auth.uid()
      and pr.role in ('school_admin', 'center_head')
  ))
  with check (exists (
    select 1 from public.skill_masters sm
    join public.profiles pr on pr.school_id = sm.school_id
    where sm.id = skill_program_map.skill_id
      and pr.id = auth.uid()
      and pr.role in ('school_admin', 'center_head')
  ));

create policy "skill_program_map_super_admin_all" on public.skill_program_map
  for all to authenticated
  using (exists (
    select 1 from public.profiles pr
    where pr.id = auth.uid() and pr.role = 'super_admin'
  ))
  with check (exists (
    select 1 from public.profiles pr
    where pr.id = auth.uid() and pr.role = 'super_admin'
  ));

create policy "skill_program_map_teacher_select" on public.skill_program_map
  for select to authenticated
  using (exists (
    select 1 from public.skill_masters sm
    join public.profiles pr on pr.school_id = sm.school_id
    where sm.id = skill_program_map.skill_id
      and pr.id = auth.uid()
      and pr.role in ('teacher', 'staff')
  ));

create policy "skill_program_map_teacher_insert" on public.skill_program_map
  for insert to authenticated
  with check (exists (
    select 1 from public.skill_masters sm
    join public.profiles pr on pr.school_id = sm.school_id
    where sm.id = skill_program_map.skill_id
      and pr.id = auth.uid()
      and pr.role in ('teacher', 'staff')
  ));

create policy "skill_program_map_teacher_update" on public.skill_program_map
  for update to authenticated
  using (exists (
    select 1 from public.skill_masters sm
    join public.profiles pr on pr.school_id = sm.school_id
    where sm.id = skill_program_map.skill_id
      and pr.id = auth.uid()
      and pr.role in ('teacher', 'staff')
  ))
  with check (exists (
    select 1 from public.skill_masters sm
    join public.profiles pr on pr.school_id = sm.school_id
    where sm.id = skill_program_map.skill_id
      and pr.id = auth.uid()
      and pr.role in ('teacher', 'staff')
  ));

create policy "skill_program_map_parent_select" on public.skill_program_map
  for select to authenticated
  using (exists (
    select 1 from public.skill_masters sm
    join public.students s on s.school_id = sm.school_id
    join public.parent_students ps on ps.student_id = s.id
    where sm.id = skill_program_map.skill_id
      and ps.parent_id = auth.uid()
  ));

commit;
