-- moment_albums RLS. Replaces admin_all_albums, parent_view_albums and
-- teacher_albums with explicitly scoped policies.
--   school_admin, center_head: full access to their own school's albums
--   super_admin:               full access to every school's albums
--   teacher, staff:            read, create and update their own school's
--                              albums; no delete (admin only)
--   parent:                    read their children's schools' albums, via
--                              parent_students (most parents also have a
--                              school_id, but some have null, so school_id is
--                              not used for parents)
--   anon:                      no access (every policy is for authenticated only)
-- Albums have no active/archived flag and are hard-deleted, so every row a
-- parent can match is an active album.

begin;

-- Drop every existing policy on the table so this file is the whole picture.
do $$
declare p record;
begin
  for p in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'moment_albums'
  loop
    execute format('drop policy %I on public.moment_albums', p.policyname);
  end loop;
end $$;

alter table public.moment_albums enable row level security;

-- Policies look up rows by school_id.
create index if not exists moment_albums_school_id_idx
  on public.moment_albums (school_id);

create policy "moment_albums_admin_all" on public.moment_albums
  for all to authenticated
  using (exists (
    select 1 from public.profiles pr
    where pr.id = auth.uid()
      and pr.school_id = moment_albums.school_id
      and pr.role in ('school_admin', 'center_head')
  ))
  with check (exists (
    select 1 from public.profiles pr
    where pr.id = auth.uid()
      and pr.school_id = moment_albums.school_id
      and pr.role in ('school_admin', 'center_head')
  ));

create policy "moment_albums_super_admin_all" on public.moment_albums
  for all to authenticated
  using (exists (
    select 1 from public.profiles pr
    where pr.id = auth.uid() and pr.role = 'super_admin'
  ))
  with check (exists (
    select 1 from public.profiles pr
    where pr.id = auth.uid() and pr.role = 'super_admin'
  ));

create policy "moment_albums_teacher_select" on public.moment_albums
  for select to authenticated
  using (exists (
    select 1 from public.profiles pr
    where pr.id = auth.uid()
      and pr.school_id = moment_albums.school_id
      and pr.role in ('teacher', 'staff')
  ));

create policy "moment_albums_teacher_insert" on public.moment_albums
  for insert to authenticated
  with check (exists (
    select 1 from public.profiles pr
    where pr.id = auth.uid()
      and pr.school_id = moment_albums.school_id
      and pr.role in ('teacher', 'staff')
  ));

create policy "moment_albums_teacher_update" on public.moment_albums
  for update to authenticated
  using (exists (
    select 1 from public.profiles pr
    where pr.id = auth.uid()
      and pr.school_id = moment_albums.school_id
      and pr.role in ('teacher', 'staff')
  ))
  with check (exists (
    select 1 from public.profiles pr
    where pr.id = auth.uid()
      and pr.school_id = moment_albums.school_id
      and pr.role in ('teacher', 'staff')
  ));

create policy "moment_albums_parent_select" on public.moment_albums
  for select to authenticated
  using (exists (
    select 1 from public.parent_students ps
    join public.students s on s.id = ps.student_id
    where ps.parent_id = auth.uid()
      and s.school_id = moment_albums.school_id
  ));

commit;
