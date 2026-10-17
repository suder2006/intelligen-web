-- Learning outcomes belong to one program, like activities. Progress screens show
-- only outcomes tagged with the selected program; untagged outcomes never show.

begin;

alter table public.skill_learning_outcomes
  add column if not exists program text;

-- Existing outcomes take their skill's program.
update public.skill_learning_outcomes o
set program = sm.program
from public.skill_masters sm
where sm.id = o.skill_id
  and o.program is null
  and sm.program is not null;

commit;
