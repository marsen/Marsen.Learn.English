-- M5 試用版資料庫。在 Supabase 後台 SQL Editor 執行一次。
-- 登入設定（不是 SQL）：Authentication → Sign In / Providers → Email 保持開啟、"Allow new users to sign up" 開啟
--   （同學是第一次寄結果連結時自動建立帳號）。Authentication → URL Configuration 要把網站網址加進 Redirect URLs。
--   內建寄信額度很低，正式給同學用前要在 Authentication → SMTP 接自己的寄信服務。
-- 儲存桶：Storage 新增私有（private）桶 "recordings"。

create table if not exists public.sets (
  set_id         text primary key,
  title          text not null,
  topic          text not null,
  question_count int  not null,
  paper          jsonb not null,           -- 題目卷（學生看得到的部分）
  timing         jsonb not null,           -- 時間軸；不含逐字稿文字
  audio_path     text not null,            -- recordings 桶內的路徑
  published      boolean not null default false,
  published_at   timestamptz,
  created_at     timestamptz not null default now()
);

create table if not exists public.set_answers (
  set_id text primary key references public.sets(set_id) on delete cascade,
  plan   jsonb not null                    -- 標準答案；只有伺服器函式（管理金鑰）讀得到
);

create table if not exists public.attempts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade,   -- 免登入作答時是空的；信箱驗證後（點結果連結）才填上
  set_id      text not null references public.sets(set_id),
  claim_hash  text,                        -- 作答密鑰的雜湊；密鑰只在開始作答的那個瀏覽器
  email       text,                        -- 留下的信箱（小寫）；信箱驗證通過的人才能看結果
  mail_count  int not null default 0,      -- 已寄出結果連結的次數（上限由伺服器函式控制）
  answers     jsonb,
  score       int,
  total       int,
  results     jsonb,
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  client      jsonb
);
create index if not exists attempts_user_idx on public.attempts (user_id, started_at desc);
create index if not exists attempts_email_idx on public.attempts (email);

create table if not exists public.feedback (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  attempt_id uuid references public.attempts(id) on delete set null,
  rating     int check (rating between 1 and 5),
  audio_ok   boolean,
  message    text check (char_length(message) <= 2000),
  created_at timestamptz not null default now()
);

alter table public.sets         enable row level security;
alter table public.set_answers  enable row level security;
alter table public.attempts     enable row level security;
alter table public.feedback     enable row level security;

-- 先收回所有權限，再只開需要的。
revoke all on public.sets, public.set_answers, public.attempts, public.feedback from anon, authenticated;

-- sets、set_answers：不給任何人直接讀寫（伺服器函式用管理金鑰，會略過列層級權限）。

-- attempts：使用者只能讀自己的；寫入由伺服器函式做。
grant select on public.attempts to authenticated;
create policy attempts_select_own on public.attempts
  for select to authenticated using (user_id = auth.uid());

-- feedback：使用者可新增、讀自己的；attempt_id 若有填，必須是自己的 attempt。
grant select, insert on public.feedback to authenticated;
create policy feedback_select_own on public.feedback
  for select to authenticated using (user_id = auth.uid());
create policy feedback_insert_own on public.feedback
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and (attempt_id is null or exists (select 1 from public.attempts a where a.id = attempt_id and a.user_id = auth.uid()))
  );
