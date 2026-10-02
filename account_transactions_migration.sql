-- ============================================================================
-- LONEX INVESTMENTS — STAGE 2
-- Migration: Central Account Transactions & Atomic Transfer Architecture
-- Supports: Cash In, Cash Out, and Atomic Inter-Account Transfers
-- Protects: Existing data in clients, loans, payments, invest, expenses
-- ============================================================================

-- 1. Create central account_transactions table
CREATE TABLE IF NOT EXISTS public.account_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('CASH_IN', 'CASH_OUT', 'TRANSFER', 'DOCUMENT_CHARGE')),
    source_account TEXT CHECK (source_account IN ('BANK_CAPITAL', 'ASSETS_CASH')),
    destination_account TEXT CHECK (destination_account IN ('BANK_CAPITAL', 'ASSETS_CASH')),
    amount NUMERIC NOT NULL CHECK (amount > 0),
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    description TEXT NOT NULL,
    reference TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.account_transactions ENABLE ROW LEVEL SECURITY;

-- Allow read access
DROP POLICY IF EXISTS "Allow public read on account_transactions" ON public.account_transactions;
CREATE POLICY "Allow public read on account_transactions"
ON public.account_transactions
FOR SELECT
USING (true);

-- Allow insert access
DROP POLICY IF EXISTS "Allow public insert on account_transactions" ON public.account_transactions;
CREATE POLICY "Allow public insert on account_transactions"
ON public.account_transactions
FOR INSERT
WITH CHECK (true);

-- 2. Atomic Database RPC: process_account_transaction
-- Concurrency Safe: Uses row-level lock (FOR UPDATE) on bank_capital
-- Atomicity: Updates balance and logs transaction in a single database transaction
CREATE OR REPLACE FUNCTION public.process_account_transaction(
    p_transaction_type TEXT,
    p_source_account TEXT,
    p_destination_account TEXT,
    p_amount NUMERIC,
    p_transaction_date DATE,
    p_description TEXT,
    p_reference TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_cap_id UUID;
    v_current_bal NUMERIC;
    v_new_tx_id UUID;
BEGIN
    -- 1. Validation checks
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Transaction amount must be strictly greater than 0';
    END IF;

    IF p_transaction_type NOT IN ('CASH_IN', 'CASH_OUT', 'TRANSFER') THEN
        RAISE EXCEPTION 'Invalid transaction type: %', p_transaction_type;
    END IF;

    -- 2. Handle CASH IN
    IF p_transaction_type = 'CASH_IN' THEN
        IF p_destination_account IS NULL THEN
            RAISE EXCEPTION 'Destination account is required for Cash In';
        END IF;

        IF p_destination_account = 'BANK_CAPITAL' THEN
            SELECT id, current_balance INTO v_cap_id, v_current_bal
            FROM public.bank_capital
            ORDER BY last_updated DESC
            LIMIT 1
            FOR UPDATE;

            IF FOUND THEN
                UPDATE public.bank_capital
                SET current_balance = current_balance + p_amount,
                    last_updated = CURRENT_DATE,
                    remark = 'Cash In: ' || p_description
                WHERE id = v_cap_id;
            END IF;
        END IF;

    -- 3. Handle CASH OUT
    ELSIF p_transaction_type = 'CASH_OUT' THEN
        IF p_source_account IS NULL THEN
            RAISE EXCEPTION 'Source account is required for Cash Out';
        END IF;

        IF p_source_account = 'BANK_CAPITAL' THEN
            SELECT id, current_balance INTO v_cap_id, v_current_bal
            FROM public.bank_capital
            ORDER BY last_updated DESC
            LIMIT 1
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Bank Capital record not found';
            END IF;

            IF v_current_bal < p_amount THEN
                RAISE EXCEPTION 'Insufficient funds in Bank Capital. Available: Rs. %, Attempted: Rs. %', v_current_bal, p_amount;
            END IF;

            UPDATE public.bank_capital
            SET current_balance = current_balance - p_amount,
                last_updated = CURRENT_DATE,
                remark = 'Cash Out: ' || p_description
            WHERE id = v_cap_id;
        END IF;

    -- 4. Handle TRANSFER
    ELSIF p_transaction_type = 'TRANSFER' THEN
        IF p_source_account IS NULL OR p_destination_account IS NULL THEN
            RAISE EXCEPTION 'Both source and destination accounts are required for transfer';
        END IF;

        IF p_source_account = p_destination_account THEN
            RAISE EXCEPTION 'Source and destination accounts cannot be the same';
        END IF;

        -- Transfer FROM Bank Capital TO Assets/Cash
        IF p_source_account = 'BANK_CAPITAL' THEN
            SELECT id, current_balance INTO v_cap_id, v_current_bal
            FROM public.bank_capital
            ORDER BY last_updated DESC
            LIMIT 1
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Bank Capital record not found';
            END IF;

            IF v_current_bal < p_amount THEN
                RAISE EXCEPTION 'Insufficient funds in Bank Capital for transfer. Available: Rs. %, Attempted: Rs. %', v_current_bal, p_amount;
            END IF;

            UPDATE public.bank_capital
            SET current_balance = current_balance - p_amount,
                last_updated = CURRENT_DATE,
                remark = 'Transfer to ' || p_destination_account || ': ' || p_description
            WHERE id = v_cap_id;

        -- Transfer FROM Assets/Cash TO Bank Capital
        ELSIF p_destination_account = 'BANK_CAPITAL' THEN
            SELECT id, current_balance INTO v_cap_id, v_current_bal
            FROM public.bank_capital
            ORDER BY last_updated DESC
            LIMIT 1
            FOR UPDATE;

            IF FOUND THEN
                UPDATE public.bank_capital
                SET current_balance = current_balance + p_amount,
                    last_updated = CURRENT_DATE,
                    remark = 'Transfer from ' || p_source_account || ': ' || p_description
                WHERE id = v_cap_id;
            END IF;
        END IF;

    END IF;

    -- 5. Record transaction in central account_transactions table
    INSERT INTO public.account_transactions (
        transaction_type,
        source_account,
        destination_account,
        amount,
        transaction_date,
        description,
        reference
    )
    VALUES (
        p_transaction_type,
        p_source_account,
        p_destination_account,
        p_amount,
        p_transaction_date,
        p_description,
        p_reference
    )
    RETURNING id INTO v_new_tx_id;

    RETURN jsonb_build_object(
        'success', true,
        'transaction_id', v_new_tx_id,
        'message', 'Transaction posted successfully'
    );
END;
$$;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.process_account_transaction(TEXT, TEXT, TEXT, NUMERIC, DATE, TEXT, TEXT) TO anon, authenticated, service_role;
