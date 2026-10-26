-- LONEX INVESTMENTS V2 - SIMPLE ACTIVITY LOG
-- IMPORTANT: Run this ONLY in the NEW, SEPARATE audit Supabase project.
-- Never run it in the existing Lonex Investments Supabase project.

create table public.activity_logs (
    id bigint generated always as identity primary key,
    occurred_at timestamptz not null default now(),
    user_id uuid not null,
    user_email text not null,
    action text not null check (
        action in (
            'Member Created',
            'Member Updated',
            'Loan Issued',
            'Payment Added',
            'Early Settlement / Rescheduling',
            'Expense Recorded',
            'Capital Deposit',
            'Cash In',
            'Cash Out',
            'Account Transfer'
        )
    ),
    module text not null check (module in ('Members', 'Loans', 'Payments', 'Settlement', 'Finance')),
    record_reference text not null check (char_length(record_reference) between 1 and 120),
    description text not null check (char_length(description) between 1 and 500),
    amount numeric(15, 2) check (amount is null or amount >= 0),
    details jsonb not null default '{}'::jsonb,
    idempotency_key text not null unique check (char_length(idempotency_key) between 16 and 120)
);

create index activity_logs_occurred_at_idx
    on public.activity_logs (occurred_at desc, id desc);

create index activity_logs_module_date_idx
    on public.activity_logs (module, occurred_at desc);

create index activity_logs_user_date_idx
    on public.activity_logs (user_id, occurred_at desc);

alter table public.activity_logs enable row level security;

-- No browser role can read or write the table. The Edge Function uses its
-- server-only audit project credential and is the sole access gateway.
revoke all on table public.activity_logs from anon, authenticated;
revoke all on sequence public.activity_logs_id_seq from anon, authenticated;

comment on table public.activity_logs is
  'Basic future-only Lonex management activity log. Not a guaranteed tamper-proof financial audit trail.';
