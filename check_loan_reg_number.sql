-- Check and fix loan_reg_number column issues
-- Run this in Supabase SQL Editor

-- 1. Check if loan_reg_number column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'loans' 
AND column_name = 'loan_reg_number';

-- 2. If column doesn't exist, add it
ALTER TABLE loans ADD COLUMN IF NOT EXISTS loan_reg_number INTEGER UNIQUE;

-- 3. Update existing loans with sequential register numbers if they don't have them
UPDATE loans 
SET loan_reg_number = subquery.row_num
FROM (
  SELECT loan_id, ROW_NUMBER() OVER (ORDER BY created_at) as row_num
  FROM loans
  WHERE loan_reg_number IS NULL
) as subquery
WHERE loans.loan_id = subquery.loan_id;

-- 4. Check the results
SELECT loan_id, loan_number, loan_reg_number, created_at 
FROM loans 
ORDER BY loan_reg_number;

-- 5. Verify a specific loan has loan_reg_number
-- Replace 'YOUR_LOAN_ID' with an actual loan ID from your database
-- SELECT * FROM loans WHERE loan_id = 'YOUR_LOAN_ID'; 