alter table pipeline add column if not exists inhaber text;
alter table pipeline add column if not exists telefon text;
alter table pipeline add column if not exists waerme text default 'Warm';
alter table pipeline add column if not exists stage text default 'Kontaktiert';
alter table pipeline add column if not exists next_action text;
alter table pipeline add column if not exists notizen text;
