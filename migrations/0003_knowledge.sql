create table if not exists knowledge_articles (
  id text primary key,
  title text not null,
  summary text not null,
  steps_json text not null,
  keywords_json text not null,
  last_reviewed text not null,
  currency text not null,
  featured boolean not null default false,
  supersedes_json text not null default '[]',
  stale_note text,
  expires_on text,
  retired boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by text
);

create table if not exists knowledge_admins (
  email text primary key,
  user_id text not null,
  added_by text not null,
  added_at timestamptz not null default now()
);
