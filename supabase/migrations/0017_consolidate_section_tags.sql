-- Consolidate legacy section_tag values into the four canonical options:
--   floor (Floor / Pit), section_100 (Lower Bowl), upper (Upper Deck), vip (VIP)
--
-- Mapping rationale:
--   pit          → floor      (pit is part of the floor / GA area)
--   stage_left   → floor      (stage-adjacent = floor level)
--   stage_right  → floor      (stage-adjacent = floor level)
--   section_200  → upper      (200-level sections are upper deck)
--   seated       → section_100 (generic seated = lower bowl)
--   concourse    → NULL       (no clear mapping; clear it)
--   outside      → NULL       (no clear mapping; clear it)

update public.media set section_tag = 'floor'       where section_tag in ('pit', 'stage_left', 'stage_right');
update public.media set section_tag = 'upper'       where section_tag = 'section_200';
update public.media set section_tag = 'section_100' where section_tag = 'seated';
update public.media set section_tag = null          where section_tag in ('concourse', 'outside');
