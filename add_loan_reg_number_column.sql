-- Migration script to add loan_reg_number column to existing loans table
-- Run this in Supabase SQL Editor if you already have a loans table

-- Add loan_reg_number column to existing loans table
ALTER TABLE loans ADD COLUMN IF NOT EXISTS loan_reg_number INTEGER UNIQUE;

-- Create function to get next loan register number
CREATE OR REPLACE FUNCTION get_next_loan_reg_number()
RETURNS INTEGER AS $$
DECLARE
    next_number INTEGER;
BEGIN
    -- Get the current maximum loan register number
    SELECT COALESCE(MAX(loan_reg_number), 0) INTO next_number
    FROM loans;
    
    -- Return the next number
    RETURN next_number + 1;
END;
$$ LANGUAGE plpgsql;

-- Create index for loan_reg_number
CREATE INDEX IF NOT EXISTS idx_loans_reg_number ON loans(loan_reg_number); 