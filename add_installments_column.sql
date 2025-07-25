-- Migration script to add installments column to existing loans table
-- Run this in Supabase SQL Editor if you already have a loans table

-- Add installments column to existing loans table
ALTER TABLE loans ADD COLUMN IF NOT EXISTS installments INTEGER;

-- Update existing loans with correct installments based on loan type and date range
UPDATE loans 
SET installments = CASE 
    WHEN loan_type = 'daily' THEN 
        GREATEST(1, DATE_PART('day', end_date - start_date)::INTEGER)
    WHEN loan_type = 'weekly' THEN 
        GREATEST(1, CEIL(DATE_PART('day', end_date - start_date) / 7.0)::INTEGER)
    WHEN loan_type = 'monthly' THEN 
        GREATEST(1, 
            CASE 
                WHEN EXTRACT(DAY FROM end_date) < EXTRACT(DAY FROM start_date) THEN
                    (EXTRACT(YEAR FROM end_date) - EXTRACT(YEAR FROM start_date)) * 12 + 
                    (EXTRACT(MONTH FROM end_date) - EXTRACT(MONTH FROM start_date)) - 1
                ELSE
                    (EXTRACT(YEAR FROM end_date) - EXTRACT(YEAR FROM start_date)) * 12 + 
                    (EXTRACT(MONTH FROM end_date) - EXTRACT(MONTH FROM start_date))
            END
        )
    ELSE 1
END
WHERE installments IS NULL;

-- Make installments column NOT NULL after updating existing records
ALTER TABLE loans ALTER COLUMN installments SET NOT NULL; 