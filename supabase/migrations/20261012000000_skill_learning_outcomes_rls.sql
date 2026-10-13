-- skill_learning_outcomes RLS. The school comes from the parent skill
-- (skill_learning_outcomes.skill_id -> skill_masters.school_id).
--   school_admin, center_head: full access to their own school's outcomes
--   super_admin:               full access to every school's outcomes
--   teacher, staff:            read their own school's outcomes
--   parent:                    read outcomes of their children's schools
--                              (parents have profiles.school_id = null, so
--                              this goes through parent_students -> students)

begin;

-- Drop every existing policy on the table so this file is the whole picture.
do $$
declare p record;
begin
  for p in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'skill_learning_outcomes'
  loop
    execute format('drop policy %I on public.skill_learning_outcomes', p.policyname);
  end loop;
end $$;

alter table public.skill_learning_outcomes enable row level security;

-- Policies look up outcomes by skill_id.
create index if not exists skill_learning_outcomes_skill_id_idx
  on public.skill_learning_outcomes (skill_id);

create policy "skill_learning_outcomes_admin_all" on public.skill_learning_outcomes
  for all to authenticated
  using (exists (
    select 1 from public.skill_masters sm
    join public.profiles pr on pr.school_id = sm.school_id
    where sm.id = skill_learning_outcomes.skill_id
      and pr.id = auth.uid()
      and pr.role in ('school_admin', 'center_head')
  ))
  with check (exists (
    select 1 from public.skill_masters sm
    join public.profiles pr on pr.school_id = sm.school_id
    where sm.id = skill_learning_outcomes.skill_id
      and pr.id = auth.uid()
      and pr.role in ('school_admin', 'center_head')
  ));

create policy "skill_learning_outcomes_super_admin_all" on public.skill_learning_outcomes
  for all to authenticated
  using (exists (
    select 1 from public.profiles pr
    where pr.id = auth.uid() and pr.role = 'super_admin'
  ))
  with check (exists (
    select 1 from public.profiles pr
    where pr.id = auth.uid() and pr.role = 'super_admin'
  ));

create policy "skill_learning_outcomes_teacher_select" on public.skill_learning_outcomes
  for select to authenticated
  using (exists (
    select 1 from public.skill_masters sm
    join public.profiles pr on pr.school_id = sm.school_id
    where sm.id = skill_learning_outcomes.skill_id
      and pr.id = auth.uid()
      and pr.role in ('teacher', 'staff')
  ));

create policy "skill_learning_outcomes_parent_select" on public.skill_learning_outcomes
  for select to authenticated
  using (exists (
    select 1 from public.skill_masters sm
    join public.students s on s.school_id = sm.school_id
    join public.parent_students ps on ps.student_id = s.id
    where sm.id = skill_learning_outcomes.skill_id
      and ps.parent_id = auth.uid()
  ));

commit;
