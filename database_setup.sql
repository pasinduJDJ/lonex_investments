-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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

-- Create clients table
CREATE TABLE clients (
    client_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    register_number INTEGER UNIQUE DEFAULT nextval('client_register_number_seq'),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    nic_number TEXT UNIQUE NOT NULL,
    mobile_number TEXT,
    home_number TEXT,
    street_address TEXT,
    town_one TEXT,
    town_two TEXT,
    "group" TEXT,
    is_member BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    first_guarantor_name TEXT,
    first_guarantor_nic TEXT,
    first_guarantor_tp TEXT,
    first_guarantor_address TEXT,
    second_guarantor_name TEXT,
    second_guarantor_nic TEXT,
    second_guarantor_tp TEXT,
    second_guarantor_address TEXT
);

-- Create loans table
CREATE TABLE loans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES clients(client_id) ON DELETE CASCADE,
    loan_number TEXT UNIQUE NOT NULL,
    loan_type TEXT CHECK (loan_type IN ('daily', 'weekly', 'monthly')) NOT NULL,
    principal_amount DECIMAL(15,2) NOT NULL,
    interest_rate DECIMAL(5,2) NOT NULL,
    document_charge DECIMAL(15,2) DEFAULT 0,
    total_amount_due DECIMAL(15,2) NOT NULL,
    total_paid DECIMAL(15,2) DEFAULT 0,
    remaining_amount DECIMAL(15,2) NOT NULL,
    status TEXT CHECK (status IN ('active', 'closed')) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL
);

-- Create payments table
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    loan_id UUID REFERENCES loans(id) ON DELETE CASCADE,
    paid_amount DECIMAL(15,2) NOT NULL,
    paid_date DATE DEFAULT CURRENT_DATE,
    remark TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create bank_capital table
CREATE TABLE bank_capital (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    starting_balance DECIMAL(15,2) NOT NULL,
    current_balance DECIMAL(15,2) NOT NULL,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    remark TEXT
);

-- Insert initial bank capital record
INSERT INTO bank_capital (starting_balance, current_balance, remark) 
VALUES (0, 0, 'Initial setup');

-- Create indexes for better performance
CREATE INDEX idx_loans_client_id ON loans(client_id);
CREATE INDEX idx_loans_status ON loans(status);
CREATE INDEX idx_payments_loan_id ON payments(loan_id);
CREATE INDEX idx_payments_paid_date ON payments(paid_date);
CREATE INDEX idx_clients_nic ON clients(nic_number);
CREATE INDEX idx_clients_register_number ON clients(register_number);

-- Create function to calculate total amount due
CREATE OR REPLACE FUNCTION calculate_total_amount_due(
    principal_amount DECIMAL,
    interest_rate DECIMAL,
    document_charge DECIMAL
) RETURNS DECIMAL AS $$
BEGIN
    RETURN principal_amount + (principal_amount * interest_rate / 100) + document_charge;
END;
$$ LANGUAGE plpgsql;

-- Create function to update loan amounts after payment
CREATE OR REPLACE FUNCTION update_loan_after_payment()
RETURNS TRIGGER AS $$
BEGIN
    -- Update total_paid and remaining_amount in loans table
    UPDATE loans 
    SET 
        total_paid = total_paid + NEW.paid_amount,
        remaining_amount = total_amount_due - (total_paid + NEW.paid_amount)
    WHERE id = NEW.loan_id;
    
    -- Update bank capital
    UPDATE bank_capital 
    SET 
        current_balance = current_balance + NEW.paid_amount,
        last_updated = NOW()
    WHERE id = (SELECT id FROM bank_capital ORDER BY last_updated DESC LIMIT 1);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update loan amounts after payment
CREATE TRIGGER trigger_update_loan_after_payment
    AFTER INSERT ON payments
    FOR EACH ROW
    EXECUTE FUNCTION update_loan_after_payment(); 