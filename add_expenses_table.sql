CREATE TABLE expenses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    amount numeric NOT NULL,
    remark text,
    expense_date date NOT NULL,
    created_at timestamp with time zone DEFAULT now()
); 