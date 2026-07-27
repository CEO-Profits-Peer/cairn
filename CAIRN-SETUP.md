# Cairn — Setup

~15 Minuten. Danach läuft die App live auf einer echten URL mit echtem Supabase-Backend
statt nur im lokalen Demo-Modus.

## Migration (nur falls du das SQL schon einmal ausgeführt hast)

Cairn speichert jetzt mehrere Gedächtnis-Typen (Decision/Note/Meeting/Glossary/Link),
nicht nur Entscheidungen. Falls dein Supabase-Projekt schon existiert: im SQL Editor
einmal ausführen, dann weiter unten normal fortfahren (der Rest des Skripts ist mit
`create or replace`/`if not exists` sicher erneut ausführbar):

```sql
alter table cairn_decisions
  add column if not exists type text not null default 'decision'
  check (type in ('decision','note','meeting','glossary','link'));
```

## 0. GitHub-Repo anlegen

1. Auf [github.com/new](https://github.com/new) einloggen als `CEO-Profits-Peer`.
2. Repository-Name `cairn`, **leer** anlegen (kein README/License/`.gitignore` ankreuzen —
   das Repo hat lokal schon alles).
3. Sichtbarkeit: Private oder Public, wie gewünscht.
4. Danach Claude Bescheid geben (oder die angezeigte Repo-URL nennen) — der lokale Commit
   wird dann direkt gepusht.

## 1. Supabase-Projekt anlegen

1. Neues Projekt auf [supabase.com](https://supabase.com) anlegen (eigenes Projekt, nicht das HQ-Projekt mitbenutzen).
2. **SQL Editor** öffnen, das komplette Skript unten ausführen.
3. **Project Settings → API**: `Project URL` und `anon public` Key kopieren.
4. In `config.js` eintragen (URL **ohne** `/rest/v1/`-Suffix):

```js
window.CAIRN_CONFIG = {
  SUPABASE_URL: "https://xxxxx.supabase.co",
  SUPABASE_ANON_KEY: "eyJ...",
};
```

## 2. Auth-Einstellungen

**Authentication → Providers → Email**: Email+Passwort ist standardmäßig aktiv, das reicht.
**Authentication → URL Configuration**: Site URL + Redirect URLs auf die finale Domain setzen
(plus `http://localhost:8420/**` fürs lokale Testen).

## 3. SQL-Skript (komplett, einmal ausführen)

```sql
-- ── Tabellen ────────────────────────────────────────────────
create table if not exists cairn_workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  owner uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists cairn_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references cairn_workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  name text not null default 'Member',
  role text not null default 'member' check (role in ('owner','member')),
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create table if not exists cairn_decisions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references cairn_workspaces(id) on delete cascade,
  type text not null default 'decision' check (type in ('decision','note','meeting','glossary','link')),
  title text not null,
  context text default '',
  reasoning text default '',
  category text default 'general',
  tags text[] not null default '{}',
  decided_on date not null default current_date,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cairn_decisions_ws_idx on cairn_decisions(workspace_id, decided_on desc);
create index if not exists cairn_members_ws_idx on cairn_members(workspace_id);

-- ── updated_at Trigger ──────────────────────────────────────
create or replace function cairn_set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists cairn_decisions_updated_at on cairn_decisions;
create trigger cairn_decisions_updated_at
  before update on cairn_decisions
  for each row execute function cairn_set_updated_at();

-- ── Helper-Funktionen (security definer, VOR den Policies!) ──
create or replace function is_cairn_member(ws uuid) returns boolean
language sql security definer stable as $$
  select exists (
    select 1 from cairn_members
    where workspace_id = ws and user_id = auth.uid()
  );
$$;

create or replace function is_cairn_owner(ws uuid) returns boolean
language sql security definer stable as $$
  select exists (
    select 1 from cairn_members
    where workspace_id = ws and user_id = auth.uid() and role = 'owner'
  );
$$;

-- ── RPCs: Workspace anlegen / beitreten ───────────────────────
create or replace function cairn_create_workspace(ws_name text, member_name text)
returns cairn_workspaces
language plpgsql security definer as $$
declare
  ws cairn_workspaces;
  code text;
begin
  code := lower(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
  insert into cairn_workspaces (name, invite_code, owner)
    values (ws_name, code, auth.uid())
    returning * into ws;
  insert into cairn_members (workspace_id, user_id, name, role)
    values (ws.id, auth.uid(), coalesce(nullif(member_name,''), 'Owner'), 'owner');
  return ws;
end;
$$;

create or replace function cairn_join_workspace(code text, member_name text)
returns cairn_workspaces
language plpgsql security definer as $$
declare
  ws cairn_workspaces;
begin
  select * into ws from cairn_workspaces where invite_code = lower(trim(code));
  if ws.id is null then
    raise exception 'invalid_invite_code';
  end if;
  insert into cairn_members (workspace_id, user_id, name, role)
    values (ws.id, auth.uid(), coalesce(nullif(member_name,''), 'Member'), 'member')
    on conflict (workspace_id, user_id) do nothing;
  return ws;
end;
$$;

-- ── RLS aktivieren ────────────────────────────────────────────
alter table cairn_workspaces enable row level security;
alter table cairn_members enable row level security;
alter table cairn_decisions enable row level security;

-- Workspaces: nur sehen, wenn Mitglied. Kein direktes Insert/Update/Delete
-- durch Clients — läuft ausschließlich über die obigen RPCs.
drop policy if exists "select own workspace" on cairn_workspaces;
create policy "select own workspace" on cairn_workspaces
  for select using (is_cairn_member(id));

-- Members: sehen, wenn selbst Mitglied. Eigenen Namen ändern dürfen.
drop policy if exists "select workspace members" on cairn_members;
create policy "select workspace members" on cairn_members
  for select using (is_cairn_member(workspace_id));

drop policy if exists "update own member name" on cairn_members;
create policy "update own member name" on cairn_members
  for update using (user_id = auth.uid());

revoke update on cairn_members from authenticated, anon;
grant update (name) on cairn_members to authenticated;

-- Decisions: jedes Mitglied liest/schreibt, löschen darf der Ersteller
-- oder der Owner des Workspace.
drop policy if exists "select decisions" on cairn_decisions;
create policy "select decisions" on cairn_decisions
  for select using (is_cairn_member(workspace_id));

drop policy if exists "insert decisions" on cairn_decisions;
create policy "insert decisions" on cairn_decisions
  for insert with check (is_cairn_member(workspace_id) and created_by = auth.uid());

drop policy if exists "update decisions" on cairn_decisions;
create policy "update decisions" on cairn_decisions
  for update using (is_cairn_member(workspace_id));

drop policy if exists "delete decisions" on cairn_decisions;
create policy "delete decisions" on cairn_decisions
  for delete using (created_by = auth.uid() or is_cairn_owner(workspace_id));
```

## 4. "Ask Cairn" (KI-Suche) aktivieren

Zwei Dinge, sonst zeigt die App einen Hinweis statt einer Antwort (keine harte Fehlerseite):

1. In `api/ai-search.js` ganz oben `SUPABASE_URL` und `SUPABASE_ANON_KEY` eintragen —
   dieselben Werte wie in `config.js`. Der anon key ist bewusst öffentlich (das ist sein
   Zweck), Sicherheit kommt von RLS, nicht von Geheimhaltung dieses Keys.
2. Vercel-Environment-Variable `ANTHROPIC_API_KEY` setzen — dein Anthropic-API-Key.
   **Kein Service-Role-Key nötig** — `/api/ai-search` ruft Supabase mit dem JWT des
   eingeloggten Nutzers auf, RLS greift also ganz normal. Die KI sieht nie mehr, als der
   Nutzer selbst sehen dürfte.

Nach dem Setzen: Redeploy anstoßen. Empfehlung wie bei HQ: Ausgabenlimit in der
Anthropic Console setzen, sobald der Key aktiv ist.

## 5. Deploy (Vercel)

Framework Preset **Other**, kein Build-Command, Output Directory `.`. `vercel.json`
ist schon vorbereitet (Security-Header).

## 6. Erster Test

1. Lokal: `python -m http.server 8420` im `cairn`-Ordner, dann `http://localhost:8420`.
2. Registrieren → Workspace anlegen → Entscheidung loggen → "Ask Cairn" ausprobieren.
3. Zweiten Account registrieren, mit dem Invite-Code beitreten, prüfen dass beide
   dieselben Entscheidungen sehen.
4. Sicherheitstest wie bei HQ: ausgeloggt per `curl` auf `cairn_decisions` zugreifen →
   muss leer/verweigert sein.
