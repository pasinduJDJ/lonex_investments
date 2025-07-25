-- Add register_number column to existing clients table
-- Run this script if you already have a clients table and want to add the register_number column

-- Create sequence for register numbers
CREATE SEQUENCE IF NOT EXISTS client_register_number_seq START 1;

-- Create function to get next register number
CREATE OR REPLACE FUNCTION get_next_register_number()
RETURNS INTEGER AS $$
DECLARE
    next_number INTEGER;
    max_number INTEGER;
BEGIN
    -- Get the current maximum register number from the clients table
    SELECT COALESCE(MAX(register_number), 0) INTO max_number FROM clients;
    
    -- Get the next value from the sequence
    SELECT nextval('client_register_number_seq') INTO next_number;
    
    -- If the sequence is behind the max number, reset it
    IF next_number <= max_number THEN
        PERFORM setval('client_register_number_seq', max_number + 1);
        next_number := max_number + 1;
    END IF;
    
    RETURN next_number;
END;
$$ LANGUAGE plpgsql;

-- Add register_number column to existing clients table
ALTER TABLE clients ADD COLUMN IF NOT EXISTS register_number INTEGER UNIQUE DEFAULT nextval('client_register_number_seq');

-- Create index for register_number
CREATE INDEX IF NOT EXISTS idx_clients_register_number ON clients(register_number);

-- Update existing records to have register numbers (if any exist)
-- This will assign register numbers to existing clients
UPDATE clients 
SET register_number = nextval('client_register_number_seq') 
WHERE register_number IS NULL;

-- Reset the sequence to start after the highest register number
SELECT setval('client_register_number_seq', COALESCE((SELECT MAX(register_number) FROM clients), 0) + 1); 