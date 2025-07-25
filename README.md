# Lonex Investments - Loan Management System

A modern loan management system built with Angular 17, Supabase, and Bootstrap 5.

## Features

- **Client Management**: Add and manage clients with detailed information
- **Loan Management**: Create loans with automatic calculation of total amounts
- **Payment Tracking**: Record payments and track remaining balances
- **Reports**: Generate comprehensive reports for loans, payments, and profits
- **Bank Capital Tracking**: Monitor bank balance and cash flow
- **Modern UI**: Beautiful Bootstrap 5 interface with responsive design

## Database Schema

### Tables

1. **clients** - Client information with guarantor details
2. **loans** - Loan details with automatic calculations
3. **payments** - Payment records with automatic updates
4. **bank_capital** - Bank balance tracking

### Key Features

- Automatic calculation of total amount due
- Real-time payment tracking
- Profit calculation per loan
- Comprehensive reporting system

## Setup Instructions

### 1. Database Setup

Run the SQL scripts in `database_setup.sql` in your Supabase SQL editor:

```sql
-- Copy and paste the contents of database_setup.sql
-- This will create all tables, indexes, functions, and triggers
```

### 2. Environment Configuration

Update `src/environments/environment.ts` with your Supabase credentials:

```typescript
export const environment = {
  production: false,
  supabaseUrl: 'YOUR_SUPABASE_URL',
  supabaseAnonKey: 'YOUR_SUPABASE_ANON_KEY'
};
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Run the Application

```bash
ng serve
```

Navigate to `http://localhost:4200`

## Usage

### Adding a New Loan

1. Navigate to "Add Loan" screen
2. Select a client from the dropdown
3. Enter loan details (principal, interest rate, document charge)
4. Set start and end dates
5. The total amount due is calculated automatically
6. Submit to create the loan

### Recording Payments

1. Navigate to "Add Payment" screen
2. Enter the loan number to search
3. Review loan details and payment progress
4. Enter payment amount and optional remark
5. Submit to record the payment

### Generating Reports

- **Client Profile**: View detailed client information with loan history
- **Date Range Reports**: Generate reports for specific time periods
- **Profit Analysis**: Calculate profit per loan and overall statistics
- **Bank Capital**: Monitor bank balance and cash flow

## Technical Details

### Architecture

- **Frontend**: Angular 17 with standalone components
- **Backend**: Supabase (PostgreSQL with real-time features)
- **UI**: Bootstrap 5 with custom styling
- **State Management**: RxJS Observables

### Key Services

- `LoanManageService`: Core loan and payment operations
- `ReportManageService`: Report generation and analytics
- `SupabaseService`: Database connection and queries

### Database Functions

- `calculate_total_amount_due()`: Automatic calculation of loan totals
- `update_loan_after_payment()`: Automatic updates after payments
- Triggers for real-time data consistency

## Development

### Project Structure

```
src/
├── app/
│   ├── components/
│   │   ├── add-loan-screen/
│   │   ├── add-payments/
│   │   ├── loan-manage-screen/
│   │   ├── members-manage-screen/
│   │   └── ...
│   ├── service/
│   │   ├── loan-manage.service.ts
│   │   ├── report-manage.service.ts
│   │   └── supabase.service.ts
│   └── shared/
└── environments/
```

### Adding New Features

1. Create new components in `src/app/components/`
2. Add services in `src/app/service/`
3. Update routing in `src/app/app.routes.ts`
4. Add database tables/functions as needed

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.
