begin;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 50),
  avatar_path text check (avatar_path is null or avatar_path like id::text || '/%'),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy profiles_read_self on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_update_self on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
grant select on public.profiles to authenticated;
grant update (display_name, avatar_path) on public.profiles to authenticated;

create function public.create_account_profile() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, display_name)
  values (new.id, left(coalesce(nullif(btrim(new.raw_user_meta_data->>'display_name'), ''), 'Học viên'), 50));
  return new;
end;
$$;
revoke all on function public.create_account_profile() from public, anon, authenticated;
create trigger account_profile after insert on auth.users for each row execute function public.create_account_profile();
insert into public.profiles(id,display_name)
select id,left(coalesce(nullif(btrim(raw_user_meta_data->>'display_name'),''),'Học viên'),50) from auth.users on conflict do nothing;

create table public.learning_records (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('kv','dataset')),
  record_id text not null check (char_length(record_id) between 1 and 300),
  payload jsonb,
  version bigint not null default 1,
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key(user_id,kind,record_id)
);
alter table public.learning_records enable row level security;
create policy learning_read_self on public.learning_records for select to authenticated using (user_id = auth.uid());
grant select on public.learning_records to authenticated;
-- All writes go through the compare-and-swap RPC; clients cannot bypass version checks.
revoke insert,update,delete on public.learning_records from anon,authenticated;

create table public.ranking_totals (
  user_id uuid not null references auth.users(id) on delete cascade,
  board text not null check (board in ('study','game')),
  scope text not null check (scope in ('day','week')),
  period text not null,
  correct integer not null default 0 check(correct >= 0),
  score integer not null default 0 check(score >= 0),
  primary key(user_id,board,scope,period)
);
alter table public.ranking_totals enable row level security;
revoke all on public.ranking_totals from anon,authenticated;

create function public.put_learning_record(p_kind text,p_record_id text,p_payload jsonb,p_expected_version bigint,p_deleted boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  stored public.learning_records;
  b text; s text; item record; entry jsonb;
begin
  if uid is null or not coalesce((auth.jwt()->>'is_anonymous')::boolean = false, true) then raise exception 'Authentication required' using errcode='42501'; end if;
  if not exists(select 1 from auth.users where id=uid and email_confirmed_at is not null) then raise exception 'Email verification required' using errcode='42501'; end if;
  if p_expected_version is null or p_expected_version < 0 then raise exception 'Invalid version'; end if;
  if p_kind not in ('kv','dataset') or char_length(p_record_id) not between 1 and 300 then raise exception 'Invalid record'; end if;
  if p_kind='kv' and p_record_id !~ '^(cts:(progress:|history:|weak|speed:)|gp:(pron:|dailyGoal$|daily$|streak$|bestScore$|lbGame$|lbStudy$|lbSeed$)|gopinyin:game:)' then raise exception 'Invalid learning key'; end if;
  if octet_length(p_payload::text) > 2097152 then raise exception 'Record exceeds 2 MB'; end if;
  -- Serializes updates even when the row has not been created yet.
  perform pg_advisory_xact_lock(hashtextextended(uid::text || ':' || p_kind || ':' || p_record_id,0));
  select * into stored from public.learning_records where user_id=uid and kind=p_kind and record_id=p_record_id for update;
  if coalesce(stored.version,0) <> p_expected_version then
    return jsonb_build_object('conflict',true,'record',to_jsonb(stored));
  end if;
  insert into public.learning_records(user_id,kind,record_id,payload,version,deleted,updated_at)
  values(uid,p_kind,p_record_id,case when p_deleted then null else p_payload end,p_expected_version+1,p_deleted,now())
  on conflict(user_id,kind,record_id) do update set payload=excluded.payload,version=excluded.version,deleted=excluded.deleted,updated_at=excluded.updated_at
  returning * into stored;
  if p_kind='kv' and p_record_id in ('gp:lbStudy','gp:lbGame') then
    b := case when p_record_id='gp:lbStudy' then 'study' else 'game' end;
    delete from public.ranking_totals where user_id=uid and board=b;
    if not p_deleted then
      for s in select unnest(array['day','week']) loop
        -- The stored value is the existing JSON storage string, not raw arbitrary SQL.
        for item in select * from jsonb_each(coalesce((p_payload#>>'{}')::jsonb->s,'{}'::jsonb)) loop
          entry := item.value->uid::text;
          if entry is not null then
            insert into public.ranking_totals values(uid,b,s,item.key,
              greatest(0,least(10000000,coalesce((entry->>'correct')::integer,0))),
              greatest(0,least(100000000,coalesce((entry->>'score')::integer,0))));
          end if;
        end loop;
      end loop;
    end if;
  end if;
  return jsonb_build_object('conflict',false,'record',to_jsonb(stored));
end;
$$;
revoke all on function public.put_learning_record(text,text,jsonb,bigint,boolean) from public,anon;
grant execute on function public.put_learning_record(text,text,jsonb,bigint,boolean) to authenticated;

create function public.public_rankings(p_board text,p_scope text,p_period text)
returns table(id uuid,name text,avatar_path text,correct integer,score integer)
language sql stable security definer set search_path = '' as $$
  select p.id,p.display_name,p.avatar_path,r.correct,r.score
  from public.ranking_totals r join public.profiles p on p.id=r.user_id
  where r.board=p_board and r.scope=p_scope and r.period=p_period
  order by r.correct desc,r.score desc,p.id limit 100;
$$;
revoke all on function public.public_rankings(text,text,text) from public;
grant execute on function public.public_rankings(text,text,text) to anon,authenticated;

-- Compressed display avatars are public, like names on the public leaderboard.
-- Only owners can list, upload, replace or delete files in their UUID directory.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('avatars','avatars',true,262144,array['image/webp','image/png','image/jpeg']);
create policy avatar_read_self on storage.objects for select to authenticated
using(bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text);
create policy avatar_insert_self on storage.objects for insert to authenticated
with check(bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text);
create policy avatar_update_self on storage.objects for update to authenticated
using(bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text)
with check(bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text);
create policy avatar_delete_self on storage.objects for delete to authenticated
using(bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text);
commit;
