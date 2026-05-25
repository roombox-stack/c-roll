-- Clean up em-dash mojibake from the initial seed.
--
-- The original seed.sql used U+2014 (—). When pasted through the dashboard's
-- SQL editor it got reinterpreted via Mac Roman and stored as the three-byte
-- sequence "‚Äî" (U+201A U+00C4 U+00EE). This restores the proper em-dash.
--
-- Using `E'\u...'` escapes keeps the fix safe through clipboard round-trips —
-- we never put the literal mojibake characters into the source.

update public.events
   set name = replace(name, E'‚Äî', E'—')
 where name like '%' || E'‚Äî' || '%';
