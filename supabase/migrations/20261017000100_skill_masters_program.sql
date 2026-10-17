-- Each skill belongs to one program: "Shape Recognition" for LKG and for Nursery
-- are separate skill_masters rows. Unique by school + academic year + name + program.
-- Run after 20261017000000_skill_activities_program_term_month.sql.

begin;

alter table public.skill_masters
  add column if not exists program text;

-- Backfill skills that already belong to exactly one program (through their
-- assignments or their activities' tags). Skills shared across programs stay null.
-- Where several same-named skills would get the same program, only the oldest
-- does, so the unique index below can be created.
with derived as (
  select p.skill_id, min(p.program) as program
  from (
    select skill_id, program from public.skill_program_map
    union
    select skill_id, program from public.skill_activities where program is not null
  ) p
  join public.skill_masters sm on sm.id = p.skill_id and sm.program is null
  group by p.skill_id
  having count(distinct p.program) = 1
), ranked as (
  select d.skill_id, d.program,
    row_number() over (
      partition by sm.school_id, sm.academic_year, sm.name, d.program
      order by sm.created_at, sm.id
    ) as rn
  from derived d
  join public.skill_masters sm on sm.id = d.skill_id
)
update public.skill_masters sm
set program = r.program
from ranked r
where sm.id = r.skill_id
  and r.rn = 1
  and not exists (
    select 1 from public.skill_masters o
    where o.school_id = sm.school_id
      and o.academic_year = sm.academic_year
      and o.name = sm.name
      and o.program = r.program
  );

create unique index if not exists skill_masters_school_year_name_program_idx
  on public.skill_masters (school_id, academic_year, name, program);

commit;
