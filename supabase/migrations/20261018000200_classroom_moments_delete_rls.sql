-- classroom_moments DELETE policies, so album delete can hard-delete the
-- album's photo/video rows before removing the moment_albums record.
--   school_admin, center_head: delete their own school's moments
--   super_admin:               delete every school's moments
--   teacher, parent, others:   no delete policy here
-- A row belongs to a school by its own school_id, or by its album's
-- school_id for rows saved without one.
-- Only adds DELETE policies; existing SELECT/INSERT/UPDATE policies are
-- untouched. Policies are permissive, so any other policy for DELETE or ALL
-- on this table still grants delete to whoever it covers.

begin;

alter table public.classroom_moments enable row level security;

-- Album delete removes rows by album_id.
create index if not exists classroom_moments_album_id_idx
  on public.classroom_moments (album_id);

drop policy if exists "classroom_moments_admin_delete" on public.classroom_moments;
drop policy if exists "classroom_moments_super_admin_delete" on public.classroom_moments;

create policy "classroom_moments_admin_delete" on public.classroom_moments
  for delete to authenticated
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
  ));

create policy "classroom_moments_super_admin_delete" on public.classroom_moments
  for delete to authenticated
  using (exists (
    select 1 from public.profiles pr
    where pr.id = auth.uid() and pr.role = 'super_admin'
  ));

commit;
