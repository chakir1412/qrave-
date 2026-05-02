alter table todos add column if not exists description text;
alter table todos add column if not exists priority text default 'medium';
alter table todos add column if not exists due_date date;
alter table todos add column if not exists notes text;
alter table todos add column if not exists status text default 'todo';
update todos set status = 'done' where done = true;
update todos set status = 'todo' where done = false or done is null;
