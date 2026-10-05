create or replace function events_append_only() returns trigger
language plpgsql as $$
begin
  raise exception 'events are append-only';
end
$$;
--> statement-breakpoint
drop trigger if exists events_append_only on events;
--> statement-breakpoint
create trigger events_append_only before update or delete or truncate on events
for each statement execute function events_append_only();
