-- ==============================================================================
-- LONEX INVESTMENTS — STAGE 2 LOAN MODULE TASK 01: EARLY SETTLEMENT & RESCHEDULE
-- Non-destructive schema migration for loan reschedule audit history
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.loan_reschedule_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
    reschedule_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    old_installment_amount NUMERIC NOT NULL,
    new_installment_amount NUMERIC NOT NULL,
    old_remaining_installments INTEGER NOT NULL,
    new_remaining_installments INTEGER NOT NULL,
    old_end_date TEXT,
    new_end_date TEXT NOT NULL,
    remaining_balance NUMERIC NOT NULL,
    changed_by TEXT DEFAULT 'Admin',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for fast lookup by loan
CREATE INDEX IF NOT EXISTS idx_loan_reschedule_history_loan_id 
ON public.loan_reschedule_history(loan_id);

-- Row Level Security matching Lonex standard public policies
ALTER TABLE public.loan_reschedule_history ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'loan_reschedule_history' AND policyname = 'Allow public full access on loan_reschedule_history'
    ) THEN
        CREATE POLICY "Allow public full access on loan_reschedule_history" 
        ON public.loan_reschedule_history 
        FOR ALL 
        USING (true) 
        WITH CHECK (true);
    END IF;
END $$;
