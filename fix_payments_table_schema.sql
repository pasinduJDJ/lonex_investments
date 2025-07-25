-- Migration script to fix payments table schema
-- Run this in Supabase SQL Editor

-- 1. Change paid_amount from bigint to DECIMAL to support decimal values
ALTER TABLE payments ALTER COLUMN paid_amount TYPE DECIMAL(15,2);

-- 2. Make paid_amount NOT NULL since it's required
ALTER TABLE payments ALTER COLUMN paid_amount SET NOT NULL;

-- 3. Make paid_date NOT NULL since it's required
ALTER TABLE payments ALTER COLUMN paid_date SET NOT NULL;

-- 4. Verify the changes
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'payments' 
ORDER BY ordinal_position;

-- 5. Check if there are any existing payments that need data type conversion
-- This will show any potential issues with existing data
SELECT COUNT(*) as total_payments,
       COUNT(CASE WHEN paid_amount IS NOT NULL THEN 1 END) as payments_with_amount,
       COUNT(CASE WHEN paid_date IS NOT NULL THEN 1 END) as payments_with_date
FROM payments; 