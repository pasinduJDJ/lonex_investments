-- Migration script to fix payments table column name
-- Run this in Supabase SQL Editor

-- Check if 'notes' column exists and 'remark' doesn't
DO $$
BEGIN
    -- If 'notes' column exists and 'remark' doesn't, rename it
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payments' AND column_name = 'notes'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payments' AND column_name = 'remark'
    ) THEN
        ALTER TABLE payments RENAME COLUMN notes TO remark;
        RAISE NOTICE 'Renamed column "notes" to "remark" in payments table';
    ELSE
        RAISE NOTICE 'Column "remark" already exists or "notes" does not exist';
    END IF;
END $$;

-- Verify the column structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'payments' 
ORDER BY ordinal_position; 