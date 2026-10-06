-- Phonics RLS: parents have profiles.school_id = null, so parent access is
-- checked through their linked children (parent_students -> students).
-- Staff keep access through their own profiles.school_id.

begin;

-- Drop every existing policy on the three phonics tables.
do $$
declare p record;
begin
  for p in
    select policyname, tablename from pg_policies
    where schemaname = 'public'
      and tablename in ('phonics_modules', 'phonics_lessons', 'phonics_progress')
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

alter table public.phonics_modules  enable row level security;
alter table public.phonics_lessons  enable row level security;
alter table public.phonics_progress enable row level security;

-- ---------------- phonics_modules ----------------

create policy "phonics_modules_staff_all" on public.phonics_modules
  for all to authenticated
  using (exists (
    select 1 from public.profiles pr
    where pr.id = auth.uid()
      and pr.role not in ('parent', 'driver')
      and pr.school_id = phonics_modules.school_id
  ))
  with check (exists (
    select 1 from public.profiles pr
    where pr.id = auth.uid()
      and pr.role not in ('parent', 'driver')
      and pr.school_id = phonics_modules.school_id
  ));

create policy "phonics_modules_parent_select" on public.phonics_modules
  for select to authenticated
  using (exists (
    select 1 from public.parent_students ps
    join public.students s on s.id = ps.student_id
    where ps.parent_id = auth.uid()
      and s.school_id = phonics_modules.school_id
  ));

-- ---------------- phonics_lessons ----------------

create policy "phonics_lessons_staff_all" on public.phonics_lessons
  for all to authenticated
  using (exists (
    select 1 from public.phonics_modules m
    join public.profiles pr on pr.school_id = m.school_id
    where m.id = phonics_lessons.module_id
      and pr.id = auth.uid()
      and pr.role not in ('parent', 'driver')
  ))
  with check (exists (
    select 1 from public.phonics_modules m
    join public.profiles pr on pr.school_id = m.school_id
    where m.id = phonics_lessons.module_id
      and pr.id = auth.uid()
      and pr.role not in ('parent', 'driver')
  ));

create policy "phonics_lessons_parent_select" on public.phonics_lessons
  for select to authenticated
  using (exists (
    select 1 from public.phonics_modules m
    join public.students s on s.school_id = m.school_id
    join public.parent_students ps on ps.student_id = s.id
    where m.id = phonics_lessons.module_id
      and ps.parent_id = auth.uid()
  ));

-- ---------------- phonics_progress ----------------

create policy "phonics_progress_parent_select" on public.phonics_progress
  for select to authenticated
  using (exists (
    select 1 from public.parent_students ps
    where ps.parent_id = auth.uid()
      and ps.student_id = phonics_progress.student_id
  ));

create policy "phonics_progress_parent_insert" on public.phonics_progress
  for insert to authenticated
  with check (
    parent_id = auth.uid()
    and exists (
      select 1 from public.parent_students ps
      where ps.parent_id = auth.uid()
        and ps.student_id = phonics_progress.student_id
    )
  );

create policy "phonics_progress_staff_select" on public.phonics_progress
  for select to authenticated
  using (exists (
    select 1 from public.students s
    join public.profiles pr on pr.school_id = s.school_id
    where s.id = phonics_progress.student_id
      and pr.id = auth.uid()
      and pr.role not in ('parent', 'driver')
  ));

commit;
