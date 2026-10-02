-- ============================================================================
-- LONEX INVESTMENTS — STAGE 2
-- Migration: Loan Number Sequence and Atomic Generator
-- Format: 12-YY-NNNN (e.g. 12-26-0001, 12-26-0002)
-- Independent yearly sequence counter
-- ============================================================================

-- 1. Create yearly sequence counter table
CREATE TABLE IF NOT EXISTS public.loan_number_sequences (
    year INTEGER PRIMARY KEY,
    last_number INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.loan_number_sequences ENABLE ROW LEVEL SECURITY;

-- Allow read access to authenticated and anonymous users
DROP POLICY IF EXISTS "Allow public read on loan_number_sequences" ON public.loan_number_sequences;
CREATE POLICY "Allow public read on loan_number_sequences"
ON public.loan_number_sequences
FOR SELECT
USING (true);

-- 2. Add Unique Index on loans(loan_number) to guarantee uniqueness at DB level
-- (Safe to apply because 0 duplicate loan numbers exist among historical records)
CREATE UNIQUE INDEX IF NOT EXISTS loans_loan_number_unique_idx ON public.loans(loan_number);

-- 3. Atomic Database Function for Generating Next Loan Number
-- Concurrency Safe: Uses row-level lock (SELECT ... FOR UPDATE) on the sequence record
-- Yearly Reset: Distinct row per year (2026 -> 12-26-XXXX, 2027 -> 12-27-0001)
CREATE OR REPLACE FUNCTION public.generate_next_loan_number(target_year INTEGER DEFAULT NULL)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    curr_year INTEGER;
    year_yy TEXT;
    next_num INTEGER;
    formatted_number TEXT;
BEGIN
    -- Determine authoritative year (server UTC year if not provided)
    IF target_year IS NULL THEN
        curr_year := EXTRACT(YEAR FROM timezone('utc'::text, now()))::INTEGER;
    ELSE
        curr_year := target_year;
    END IF;

    -- Extract 2-digit year (e.g. 2026 -> '26', 2027 -> '27')
    year_yy := LPAD((curr_year % 100)::TEXT, 2, '0');

    -- Try to lock and read the current year's sequence
    SELECT last_number INTO next_num 
    FROM public.loan_number_sequences 
    WHERE year = curr_year 
    FOR UPDATE;

    IF NOT FOUND THEN
        -- If no counter exists for this year yet, check existing loans for any matching 12-YY-NNNN
        SELECT COALESCE(
            MAX(SUBSTRING(loan_number FROM '^12-[0-9]{2}-([0-9]{4})$')::INTEGER),
            0
        ) INTO next_num
        FROM public.loans
        WHERE loan_number ~ ('^12-' || year_yy || '-[0-9]{4}$');

        next_num := next_num + 1;

        INSERT INTO public.loan_number_sequences (year, last_number, updated_at)
        VALUES (curr_year, next_num, timezone('utc'::text, now()))
        ON CONFLICT (year) DO UPDATE
        SET last_number = public.loan_number_sequences.last_number + 1,
            updated_at = timezone('utc'::text, now())
        RETURNING last_number INTO next_num;
    ELSE
        -- Row locked, increment safely
        next_num := next_num + 1;
        UPDATE public.loan_number_sequences
        SET last_number = next_num,
            updated_at = timezone('utc'::text, now())
        WHERE year = curr_year;
    END IF;

    -- Format to 12-YY-NNNN (4-digit padding)
    formatted_number := '12-' || year_yy || '-' || LPAD(next_num::TEXT, 4, '0');

    RETURN formatted_number;
END;
$$;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.generate_next_loan_number(INTEGER) TO anon, authenticated, service_role;
