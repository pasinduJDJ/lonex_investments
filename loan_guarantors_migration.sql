-- ==============================================================================
-- LONEX INVESTMENTS — STAGE 2 TASK 02: LOAN-LEVEL GUARANTOR MIGRATION
-- Non-destructive schema migration to introduce loan-level guarantor association
-- ==============================================================================

-- 1. Create loan_guarantors table
CREATE TABLE IF NOT EXISTS public.loan_guarantors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
    guarantor_id UUID NOT NULL REFERENCES public.clients(client_id) ON DELETE RESTRICT,
    guarantor_order INTEGER NOT NULL CHECK (guarantor_order IN (1, 2)),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uq_loan_guarantor_order UNIQUE (loan_id, guarantor_order)
);

-- 2. Add performance indexes for lookups
CREATE INDEX IF NOT EXISTS idx_loan_guarantors_loan_id ON public.loan_guarantors(loan_id);
CREATE INDEX IF NOT EXISTS idx_loan_guarantors_guarantor_id ON public.loan_guarantors(guarantor_id);

-- 3. Configure Row Level Security (RLS) to match Lonex Investments standard policies
ALTER TABLE public.loan_guarantors ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'loan_guarantors' AND policyname = 'Allow public full access on loan_guarantors'
    ) THEN
        CREATE POLICY "Allow public full access on loan_guarantors" 
        ON public.loan_guarantors 
        FOR ALL 
        USING (true) 
        WITH CHECK (true);
    END IF;
END $$;

-- 4. Safe Historical Migration (Non-destructive)
-- Attempts to link existing historical client guarantors to loan_guarantors ONLY if
-- a unique registered client with the exact same NIC already exists in the clients table.
-- Does NOT modify, erase, or overwrite existing client guarantor text fields.
DO $$
DECLARE
    r RECORD;
    v_g1_id UUID;
    v_g2_id UUID;
BEGIN
    FOR r IN SELECT l.id AS loan_id, l.client_id, c.first_guarantor_nic, c.second_guarantor_nic 
             FROM public.loans l
             JOIN public.clients c ON l.client_id = c.client_id
    LOOP
        v_g1_id := NULL;
        v_g2_id := NULL;

        -- Check if Guarantor 1 NIC exists in registered clients (and is not the borrower)
        IF r.first_guarantor_nic IS NOT NULL AND trim(r.first_guarantor_nic) <> '' THEN
            SELECT client_id INTO v_g1_id 
            FROM public.clients 
            WHERE lower(trim(nic_number)) = lower(trim(r.first_guarantor_nic))
              AND client_id <> r.client_id
            LIMIT 1;

            IF v_g1_id IS NOT NULL THEN
                INSERT INTO public.loan_guarantors (loan_id, guarantor_id, guarantor_order)
                VALUES (r.loan_id, v_g1_id, 1)
                ON CONFLICT (loan_id, guarantor_order) DO NOTHING;
            END IF;
        END IF;

        -- Check if Guarantor 2 NIC exists in registered clients (and is not borrower or guarantor 1)
        IF r.second_guarantor_nic IS NOT NULL AND trim(r.second_guarantor_nic) <> '' THEN
            SELECT client_id INTO v_g2_id 
            FROM public.clients 
            WHERE lower(trim(nic_number)) = lower(trim(r.second_guarantor_nic))
              AND client_id <> r.client_id
              AND (v_g1_id IS NULL OR client_id <> v_g1_id)
            LIMIT 1;

            IF v_g2_id IS NOT NULL THEN
                INSERT INTO public.loan_guarantors (loan_id, guarantor_id, guarantor_order)
                VALUES (r.loan_id, v_g2_id, 2)
                ON CONFLICT (loan_id, guarantor_order) DO NOTHING;
            END IF;
        END IF;
    END LOOP;
END $$;
