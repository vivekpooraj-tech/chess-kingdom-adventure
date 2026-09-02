-- Phase 13B: self-reported chess familiarity for adaptive home + onboarding.
-- NULL = legacy child — application treats as 'new'.

alter table public.children
  add column if not exists experience_level text
    check (experience_level in ('new', 'knows_basics', 'plays_regularly')),
  add column if not exists age_band text
    check (age_band in ('young', 'tween', 'teen', 'adult'));

comment on column public.children.experience_level is
  'Self-reported chess familiarity; NULL legacy rows default to new in app code.';
comment on column public.children.age_band is
  'Optional broad age band for copy tone; no exact DOB stored.';
