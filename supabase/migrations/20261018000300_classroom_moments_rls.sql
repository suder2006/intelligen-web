-- classroom_moments RLS. Replaces the open "Allow all" policy, which let anon
-- read and write every school's photos.
--   school_admin, center_head: full access to their own school's moments
--                              (school_id, or the album's school for rows
--                              saved without one)
--   super_admin:               full access to every school's moments
--   teacher, staff:            read their own school's moments and their own
--                              uploads; insert, update and delete only their
--                              own uploads (uploaded_by = them)
--   parent:                    read their children's schools' moments, via
--                              parent_students (most parents also have a
--                              school_id, but some have null, so school_id is
--                              not used for parents); soft-deleted rows hidden
--   anon:                      no access (every policy is for authenticated only)
-- /api/moments/delete uses the service role, which bypasses RLS and checks
-- the caller itself.
-- Supersedes 20261018000200_classroom_moments_delete_rls.sql.

begin;

-- Drop every existing policy on the table so this file is the whole picture.
do $$
declare p record;
begin
  for p in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'classroom_moments'
  loop
    execute format('drop policy %I on public.classroom_moments', p.policyname);
  end loop;
end $$;

alter table public.classroom_moments enable row level security;

-- Policies look up rows by school_id and uploaded_by; album delete by album_id.
create index if not exists classroom_moments_school_id_idx
  on public.classroom_moments (school_id);
create index if not exists classroom_moments_uploaded_by_idx
  on public.classroom_moments (uploaded_by);
create index if not exists classroom_moments_album_id_idx
  on public.classroom_moments (album_id);

create policy "classroom_moments_admin_all" on public.classroom_moments
  for all to authenticated
  using (exists (
    select 1 from public.profiles pr
    where pr.id = auth.uid()
      and pr.role in ('school_admin', 'center_head')
      and (
        pr.school_id = classroom_moments.school_id
        or exists (
          select 1 from public.moment_albums ma
          where ma.id = classroom_moments.album_id
            and ma.school_id = pr.school_id
        )
      )
  ))
  with check (exists (
    select 1 from public.profiles pr
    where pr.id = auth.uid()
      and pr.role in ('school_admin', 'center_head')
      and pr.school_id = classroom_moments.school_id
  ));

create policy "classroom_moments_super_admin_all" on public.classroom_moments
  for all to authenticated
  using (exists (
    select 1 from public.profiles pr
    where pr.id = auth.uid() and pr.role = 'super_admin'
  ))
  with check (exists (
    select 1 from public.profiles pr
    where pr.id = auth.uid() and pr.role = 'super_admin'
  ));

create policy "classroom_moments_teacher_select" on public.classroom_moments
  for select to authenticated
  using (exists (
    select 1 from public.profiles pr
    where pr.id = auth.uid()
      and pr.role in ('teacher', 'staff')
      and (
        pr.school_id = classroom_moments.school_id
        or classroom_moments.uploaded_by = auth.uid()
      )
  ));

create policy "classroom_moments_teacher_insert" on public.classroom_moments
  for insert to authenticated
  with check (
    classroom_moments.uploaded_by = auth.uid()
    and exists (
      select 1 from public.profiles pr
      where pr.id = auth.uid()
        and pr.role in ('teacher', 'staff')
        and pr.school_id = classroom_moments.school_id
    )
  );

create policy "classroom_moments_teacher_update" on public.classroom_moments
  for update to authenticated
  using (
    classroom_moments.uploaded_by = auth.uid()
    and exists (
      select 1 from public.profiles pr
      where pr.id = auth.uid() and pr.role in ('teacher', 'staff')
    )
  )
  with check (
    classroom_moments.uploaded_by = auth.uid()
    and exists (
      select 1 from public.profiles pr
      where pr.id = auth.uid()
        and pr.role in ('teacher', 'staff')
        and pr.school_id = classroom_moments.school_id
    )
  );

create policy "classroom_moments_teacher_delete" on public.classroom_moments
  for delete to authenticated
  using (
    classroom_moments.uploaded_by = auth.uid()
    and exists (
      select 1 from public.profiles pr
      where pr.id = auth.uid() and pr.role in ('teacher', 'staff')
    )
  );

create policy "classroom_moments_parent_select" on public.classroom_moments
  for select to authenticated
  using (
    classroom_moments.deleted_at is null
    and exists (
      select 1 from public.parent_students ps
      join public.students s on s.id = ps.student_id
      where ps.parent_id = auth.uid()
        and s.school_id = classroom_moments.school_id
    )
  );

commit;
