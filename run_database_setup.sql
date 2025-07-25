-- Database Setup for Lonex Investments Loan Management System
-- Run this script in your Supabase SQL Editor

-- Create clients table
CREATE TABLE IF NOT EXISTS clients (
    client_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    register_number INTEGER UNIQUE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    nic_number VARCHAR(20) UNIQUE NOT NULL,
    mobile_number VARCHAR(15),
    home_number VARCHAR(15),
    street_address TEXT,
    town_one VARCHAR(100),
    town_two VARCHAR(100),
    group_name VARCHAR(100),
    is_member BOOLEAN DEFAULT true,
    first_guarantor_name VARCHAR(200),
    first_guarantor_nic VARCHAR(20),
    first_guarantor_tp VARCHAR(15),
    first_guarantor_address TEXT,
    second_guarantor_name VARCHAR(200),
    second_guarantor_nic VARCHAR(20),
    second_guarantor_tp VARCHAR(15),
    second_guarantor_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create loans table
CREATE TABLE IF NOT EXISTS loans (
    loan_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_reg_number INTEGER UNIQUE,
    client_id UUID NOT NULL REFERENCES clients(client_id) ON DELETE CASCADE,
    loan_number VARCHAR(50) UNIQUE NOT NULL,
    loan_type VARCHAR(20) NOT NULL CHECK (loan_type IN ('daily', 'weekly', 'monthly')),
    principal_amount DECIMAL(15,2) NOT NULL,
    interest_rate FLOAT8 NOT NULL,
    document_charge FLOAT8 DEFAULT 0,
    total_amount_due DECIMAL(15,2) NOT NULL,
    remaining_amount DECIMAL(15,2) NOT NULL,
    total_paid DECIMAL(15,2) DEFAULT 0,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    installments INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'defaulted')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create payments table
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID NOT NULL REFERENCES loans(loan_id) ON DELETE CASCADE,
    paid_amount DECIMAL(15,2) NOT NULL,
    paid_date DATE NOT NULL,
    remark TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create bank_capital table
CREATE TABLE IF NOT EXISTS bank_capital (
    capital_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    amount DECIMAL(15,2) NOT NULL,
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('deposit', 'withdrawal')),
    description TEXT,
    transaction_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_clients_nic ON clients(nic_number);
CREATE INDEX IF NOT EXISTS idx_clients_register ON clients(register_number);
CREATE INDEX IF NOT EXISTS idx_loans_client ON loans(client_id);
CREATE INDEX IF NOT EXISTS idx_loans_number ON loans(loan_number);
CREATE INDEX IF NOT EXISTS idx_loans_reg_number ON loans(loan_reg_number);
CREATE INDEX IF NOT EXISTS idx_payments_loan ON payments(loan_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);

-- Create function to get next register number
CREATE OR REPLACE FUNCTION get_next_register_number()
RETURNS INTEGER AS $$
DECLARE
    next_number INTEGER;
BEGIN
    -- Get the current maximum register number
    SELECT COALESCE(MAX(register_number), 0) INTO next_number
    FROM clients;
    
    -- Return the next number
    RETURN next_number + 1;
END;
$$ LANGUAGE plpgsql;

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

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_clients_updated_at
    BEFORE UPDATE ON clients
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_loans_updated_at
    BEFORE UPDATE ON loans
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data (optional)
-- INSERT INTO clients (first_name, last_name, nic_number, mobile_number, home_number, register_number) 
-- VALUES ('John', 'Doe', '123456789V', '0771234567', '0112345678', 1);

-- INSERT INTO bank_capital (amount, transaction_type, description, transaction_date)
-- VALUES (1000000.00, 'deposit', 'Initial capital', CURRENT_DATE); 