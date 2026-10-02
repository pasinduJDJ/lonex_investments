import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { LoanManageService, Client, Loan } from '../../service/loan-manage.service';
import { SupabaseService } from '../../service/supabase.service';
import { CITY_CODE_MAP } from '../../constants/city.constants';
import { ProfitManageService } from '../../service/profit-manage.service';
import { GuarantorLookupComponent } from '../../shared/guarantor-lookup/guarantor-lookup.component';

export interface CustomerPreviousLoan extends Loan {
  installmentStats?: {
    expected: number;
    paid: number;
    remaining: number;
    totalPaid: number;
    installmentAmount: number;
    progressPercent: number;
  };
  isOverdue?: boolean;
}

const GROUP_CODE_MAP: { [key: string]: string } = {
  'Group 1': '001',
  'Group 2': '002',
  'Group 3': '003'
};

@Component({
  selector: 'app-add-loan-screen',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, GuarantorLookupComponent],
  templateUrl:'./add-loan-screen.component.html',
  styleUrl: './add-loan-screen.component.css'
})
export class AddLoanScreenComponent implements OnInit {
  // Search functionality
  searchNicNumber: string = '';
  foundClient: Client | null = null;
  isSearching: boolean = false;
  searchError: string = '';

  // Customer History & Verification State
  showCustomerHistory: boolean = false;
  customerLoans: CustomerPreviousLoan[] = [];
  activeLoansCount: number = 0;
  completedLoansCount: number = 0;

  // Client Information (populated after search)
  selectedClientId: string = '';
  clientName: string = '';
  clientRegisterNumber: string = '';
  clientLocation: string = '';
  clientGroup: string = '';

  // Loan-Level Guarantors (Registered Members)
  guarantor1: Client | null = null;
  guarantor2: Client | null = null;

  // Loan Details
  loanNumber: string = '';
  loanType: 'daily' | 'weekly' | 'monthly' = 'monthly';
  principalAmount: number = 0;
  interestRate: number = 0;
  documentCharge: number = 0;
  startDate: string = '';
  endDate: string = '';
  calculatedTotal: number = 0;
  numberOfInstallments: number = 0;
  newLoanNumber: string = '';

  // Form State
  isLoading: boolean = false;
  errorMessage: string = '';
  successMessage: string = '';
  
  // Step-by-step validation state
  isClientSearched: boolean = false;
  isClientFound: boolean = false;
  showLoanForm: boolean = false;
  
  // Bank Capital
  currentBankCapital: number = 0;

  constructor(
    private loanService: LoanManageService,
    private supabaseService: SupabaseService,
    private router: Router,
    private profitService: ProfitManageService
  ) { }

  ngOnInit(): void {
    this.setDefaultDates();
    this.loadBankCapital();
  }

  setDefaultDates(): void {
    const today = new Date();
    this.startDate = today.toISOString().split('T')[0];

    // Set end date to 30 days from today
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + 30);
    this.endDate = endDate.toISOString().split('T')[0];
  }

  loadBankCapital(): void {
    this.profitService.getBankCapital().subscribe({
      next: (capital: any) => {
        this.currentBankCapital = capital.current_balance;
      },
      error: (error) => {
        console.error('Error loading bank capital:', error);
        this.currentBankCapital = 0;
      }
    });
  }

  // Search customer by NIC number or Member ID
  searchClient(): void {
    const term = this.searchNicNumber.trim();
    if (!term) {
      this.searchError = 'Please enter a Customer NIC or Member ID to search';
      return;
    }

    this.isSearching = true;
    this.searchError = '';
    this.foundClient = null;
    this.isClientSearched = true;
    this.isClientFound = false;
    this.showCustomerHistory = false;
    this.showLoanForm = false;
    this.customerLoans = [];
    this.activeLoansCount = 0;
    this.completedLoansCount = 0;

    this.findClientAndHistory(term);
  }

  private async findClientAndHistory(queryTerm: string): Promise<void> {
    try {
      const supabase = this.supabaseService.getClient();
      const cleanTerm = queryTerm.startsWith('#') ? queryTerm.substring(1).trim() : queryTerm;
      const isNumeric = !isNaN(Number(cleanTerm)) && cleanTerm !== '';

      let client: Client | null = null;

      if (isNumeric && cleanTerm.length <= 7) {
        // Query by register_number OR nic_number
        const { data, error } = await supabase
          .from('clients')
          .select('*')
          .or(`register_number.eq.${Number(cleanTerm)},nic_number.eq.${cleanTerm}`)
          .limit(1);

        if (error) {
          this.searchError = 'Error searching for customer: ' + error.message;
          this.isSearching = false;
          return;
        }
        if (data && data.length > 0) {
          client = data[0] as Client;
        }
      } else {
        // Query by nic_number
        const { data, error } = await supabase
          .from('clients')
          .select('*')
          .eq('nic_number', cleanTerm)
          .limit(1);

        if (error) {
          this.searchError = 'Error searching for customer: ' + error.message;
          this.isSearching = false;
          return;
        }
        if (data && data.length > 0) {
          client = data[0] as Client;
        }
      }

      if (!client) {
        this.searchError = 'No customer found with this NIC number or Member ID. Please check or add the customer first.';
        this.isSearching = false;
        return;
      }

      // Customer found - populate data (loan number is auto-generated strictly on submission)
      this.foundClient = client;
      this.isClientFound = true;
      this.populateClientData(client);

      // Retrieve all previous loans belonging to this customer, sorted newest first
      const { data: loansData, error: loansError } = await supabase
        .from('loans')
        .select('*')
        .eq('client_id', client.client_id)
        .order('created_at', { ascending: false });

      if (loansError) {
        console.error('Error fetching loan history:', loansError);
      }

      const rawLoans: Loan[] = loansData || [];

      // Check previous loan history
      if (rawLoans.length === 0) {
        // IF no previous loans exist:
        // Skip Customer History, directly open existing Issue Loan Form
        this.customerLoans = [];
        this.activeLoansCount = 0;
        this.completedLoansCount = 0;
        this.showCustomerHistory = false;
        this.showLoanForm = true;
        this.isSearching = false;
        return;
      }

      // IF previous loans exist:
      // Retrieve/reuse existing installment calculations for each loan
      const today = new Date();
      const enrichedLoans: CustomerPreviousLoan[] = await Promise.all(rawLoans.map(async (loan: Loan) => {
        try {
          const stats = await this.loanService.getInstallmentStats(loan);
          const progressPercent = stats.expected > 0 
            ? Math.min(100, Math.round((stats.paid / stats.expected) * 100)) 
            : (loan.total_amount_due > 0 ? Math.min(100, Math.round((loan.total_paid / loan.total_amount_due) * 100)) : 0);
          
          const isOverdue = loan.status === 'active' && loan.remaining_amount > 0 && new Date(loan.end_date) < today;

          return {
            ...loan,
            installmentStats: {
              ...stats,
              progressPercent
            },
            isOverdue
          };
        } catch (err) {
          const expected = loan.installments || 0;
          const paid = 0;
          const remaining = expected;
          const isOverdue = loan.status === 'active' && loan.remaining_amount > 0 && new Date(loan.end_date) < today;
          return {
            ...loan,
            installmentStats: {
              expected,
              paid,
              remaining,
              totalPaid: loan.total_paid || 0,
              installmentAmount: expected > 0 ? Math.round(loan.total_amount_due / expected) : 0,
              progressPercent: loan.total_amount_due > 0 ? Math.min(100, Math.round(((loan.total_paid || 0) / loan.total_amount_due) * 100)) : 0
            },
            isOverdue
          };
        }
      }));

      this.customerLoans = enrichedLoans;
      this.activeLoansCount = enrichedLoans.filter(l => l.status === 'active').length;
      this.completedLoansCount = enrichedLoans.filter(l => l.status === 'closed').length;

      // Display Customer Summary + Previous Loan Cards + Continue to New Loan button
      this.showCustomerHistory = true;
      this.showLoanForm = false;
      this.isSearching = false;

    } catch (error: any) {
      this.searchError = 'Error searching for customer: ' + error.message;
      this.isSearching = false;
    }
  }

  continueToNewLoan(): void {
    this.showCustomerHistory = false;
    this.showLoanForm = true;
  }

  reviewCustomerHistory(): void {
    if (this.customerLoans && this.customerLoans.length > 0) {
      this.showCustomerHistory = true;
      this.showLoanForm = false;
    }
  }

  private populateClientData(client: Client): void {
    this.selectedClientId = client.client_id;
    this.clientName = `${client.first_name} ${client.last_name}`;
    this.clientRegisterNumber = client.register_number ? client.register_number.toString().padStart(6, '0') : 'N/A';
    this.clientLocation = client.town_two || 'N/A';
    this.clientGroup = client.group || 'N/A';
  }

  /**
   * Generates the next official loan number following the standard: 12-YY-NNNN.
   * Invoked strictly upon form submission to prevent premature sequence reservation or numbering gaps.
   */
  async generateLoanNumber(): Promise<string> {
    const nextNum = await this.loanService.generateNextLoanNumber();
    this.loanNumber = nextNum;
    this.newLoanNumber = nextNum;
    return nextNum;
  }



  // Calculate installments based on loan type and date range
  calculateInstallments(): void {
    if (!this.startDate || !this.endDate) {
      this.numberOfInstallments = 0;
      return;
    }

    const start = new Date(this.startDate);
    const end = new Date(this.endDate);

    if (start >= end) {
      this.numberOfInstallments = 0;
      return;
    }

    switch (this.loanType) {
      case 'daily':
        this.numberOfInstallments = this.calculateDailyInstallments(start, end);
        break;
      case 'weekly':
        this.numberOfInstallments = this.calculateWeeklyInstallments(start, end);
        break;
      case 'monthly':
        this.numberOfInstallments = this.calculateMonthlyInstallments(start, end);
        break;
      default:
        this.numberOfInstallments = 0;
    }
  }

  // Calculate daily installments (number of days between start and end)
  private calculateDailyInstallments(start: Date, end: Date): number {
    const timeDiff = end.getTime() - start.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
    return Math.max(1, daysDiff);
  }

  // Calculate weekly installments (number of complete weeks, Monday to Sunday)
  private calculateWeeklyInstallments(start: Date, end: Date): number {
    // Get the day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
    const startDay = start.getDay();
    const endDay = end.getDay();

    // Convert to Monday = 1, Sunday = 7 format
    const startMondayBased = startDay === 0 ? 7 : startDay;
    const endMondayBased = endDay === 0 ? 7 : endDay;

    // Calculate total days
    const timeDiff = end.getTime() - start.getTime();
    const totalDays = Math.ceil(timeDiff / (1000 * 3600 * 24));

    // Calculate weeks
    let weeks = Math.floor(totalDays / 7);

    // If there are remaining days, count as an additional week
    const remainingDays = totalDays % 7;
    if (remainingDays > 0) {
      weeks += 1;
    }

    return Math.max(1, weeks);
  }

  // Calculate monthly installments (number of complete months)
  private calculateMonthlyInstallments(start: Date, end: Date): number {
    const startYear = start.getFullYear();
    const startMonth = start.getMonth();
    const startDay = start.getDate();

    const endYear = end.getFullYear();
    const endMonth = end.getMonth();
    const endDay = end.getDate();

    // Calculate months difference
    let months = (endYear - startYear) * 12 + (endMonth - startMonth);

    // If end day is before start day, don't count the last month as complete
    if (endDay < startDay) {
      months -= 1;
    }

    // Ensure at least 1 month
    return Math.max(1, months);
  }

  // Trigger installment calculation when loan type or dates change
  onLoanTypeChange(): void {
    this.calculateInstallments();
  }

  onStartDateChange(): void {
    this.calculateInstallments();
  }

  onEndDateChange(): void {
    this.calculateInstallments();
  }

  calculateTotal(): void {
    if (this.principalAmount > 0 && this.interestRate >= 0) {
      this.calculatedTotal = this.principalAmount +
        (this.principalAmount * this.interestRate / 100);
    } else {
      this.calculatedTotal = 0;
    }
    
    // Clear any previous error messages when amount changes
    if (this.errorMessage && this.errorMessage.includes('Insufficient bank capital')) {
      this.errorMessage = '';
    }
  }

  // Handle interest rate input to ensure decimal support
  onInterestRateChange(event: any): void {
    const value = parseFloat(event.target.value);
    if (!isNaN(value)) {
      this.interestRate = value;
      this.calculateTotal();
    }
  }

  // Format interest rate for display
  formatInterestRate(rate: number): string {
    return rate.toFixed(2);
  }

  onSubmit(): void {
    // Reload bank capital before validation to get the latest amount
    this.profitService.getBankCapital().subscribe({
      next: async (capital: any) => {
        this.currentBankCapital = capital.current_balance;
        
        if (!this.validateForm()) {
          return;
        }

        this.isLoading = true;
        this.errorMessage = '';
        this.successMessage = '';

        try {
          // Generate official loan number right before submission (12-YY-NNNN)
          const newLoanNumber = await this.generateLoanNumber();

          const loanData = {
            client_id: this.selectedClientId,
            loan_number: newLoanNumber,
            loan_type: this.loanType,
            principal_amount: this.principalAmount,
            interest_rate: this.interestRate,
            document_charge: this.documentCharge,
            total_amount_due: this.calculatedTotal, // calculated earlier
            total_paid: 0,
            remaining_amount: this.calculatedTotal,
            status: 'active',
            start_date: this.startDate,
            end_date: this.endDate,
            created_at: new Date().toISOString(),
            installments: this.numberOfInstallments
          };

          await this.addLoan(loanData);
        } catch (err: any) {
          this.errorMessage = 'Failed to generate loan number: ' + (err.message || err);
          this.isLoading = false;
        }
      },
      error: (error) => {
        this.errorMessage = 'Error checking bank capital: ' + error.message;
      }
    });
  }

  private async addLoan(loanData: any): Promise<void> {
    try {
      const supabase = this.supabaseService.getClient();

      // Get the next loan register number
      const { data: maxData, error: maxError } = await supabase
        .from('loans')
        .select('loan_reg_number')
        .order('loan_reg_number', { ascending: false })
        .limit(1);

      if (maxError) {
        this.errorMessage = 'Error checking existing loan numbers: ' + maxError.message;
        this.isLoading = false;
        return;
      }

      let nextLoanRegNumber = 1; // Start from 1 for first loan
      if (maxData && maxData.length > 0 && maxData[0].loan_reg_number) {
        nextLoanRegNumber = maxData[0].loan_reg_number + 1;
      }

      // Calculate total amount due
      const totalAmountDue = this.calculateTotalAmountDue(
        loanData.principal_amount,
        loanData.interest_rate,
        loanData.document_charge
      );

      const loanToInsert = {
        ...loanData,
        loan_reg_number: nextLoanRegNumber,
        total_amount_due: totalAmountDue,
        remaining_amount: totalAmountDue,
        total_paid: 0,
        status: 'active'
      };

      let insertResult = await supabase
        .from('loans')
        .insert(loanToInsert)
        .select()
        .single();

      if (insertResult.error) {
        if (insertResult.error.code === '23505') { // Unique constraint violation (concurrency collision)
          // Retry once with newly allocated sequential number
          try {
            const retryLoanNumber = await this.generateLoanNumber();
            loanToInsert.loan_number = retryLoanNumber;
            loanData.loan_number = retryLoanNumber;
            insertResult = await supabase
              .from('loans')
              .insert(loanToInsert)
              .select()
              .single();
          } catch (retryErr) {
            // fall through to error handling
          }
        }

        if (insertResult.error) {
          if (insertResult.error.code === '23505') {
            this.errorMessage = 'A loan with this loan number already exists. Please try again.';
          } else {
            this.errorMessage = 'Error creating loan: ' + insertResult.error.message;
          }
          this.isLoading = false;
          return;
        }
      }

      const data = insertResult.data;

      // Save loan-level guarantors to loan_guarantors table
      if (data && data.id && this.guarantor1 && this.guarantor2) {
        try {
          await this.loanService.saveLoanGuarantors(data.id, this.guarantor1.client_id, this.guarantor2.client_id).toPromise();
        } catch (gErr) {
          console.warn('Notice saving loan-level guarantors:', gErr);
        }
      }

      // Format the loan register number
      const formattedLoanRegNumber = nextLoanRegNumber.toString().padStart(6, '0');

      // Decrease bank capital by principal amount
      this.profitService.decreaseBankCapital(loanData.principal_amount).subscribe({
        next: () => {
          this.successMessage = `Loan ${loanData.loan_number} created successfully! Loan ID: ${formattedLoanRegNumber}, Installments: ${this.numberOfInstallments}`;
          this.resetForm();
          setTimeout(() => {
            this.router.navigate(['/loan-manage']);
          }, 3000);
        },
        error: (err) => {
          this.successMessage = `Loan ${loanData.loan_number} created, but failed to update bank capital.`;
          this.resetForm();
          setTimeout(() => {
            this.router.navigate(['/loan-manage']);
          }, 3000);
        }
      });
    } catch (error: any) {
      this.errorMessage = 'Error creating loan: ' + error.message;
    } finally {
      this.isLoading = false;
    }
  }

  private calculateTotalAmountDue(
    principalAmount: number,
    interestRate: number,
    documentCharge: number
  ): number {
    return principalAmount + (principalAmount * interestRate / 100);
  }

  validateForm(): boolean {
    // Step 1: Check if client is found
    if (!this.foundClient) {
      this.errorMessage = 'Please search and select a client first';
      return false;
    }

    // Step 2: Validate principal amount
    if (!this.principalAmount || this.principalAmount <= 0) {
      this.errorMessage = 'Principal amount is required and must be greater than 0';
      return false;
    }

    // Step 3: Validate interest rate
    if (!this.interestRate && this.interestRate !== 0) {
      this.errorMessage = 'Interest rate is required';
      return false;
    }
    if (this.interestRate < 0) {
      this.errorMessage = 'Interest rate cannot be negative';
      return false;
    }
    if (this.interestRate > 100) {
      this.errorMessage = 'Interest rate cannot exceed 100%';
      return false;
    }

    // Step 4: Validate loan type
    if (!this.loanType || this.loanType.trim() === '') {
      this.errorMessage = 'Please select a loan type';
      return false;
    }

    // Step 5: Validate start date
    if (!this.startDate || this.startDate.trim() === '') {
      this.errorMessage = 'Please select a start date';
      return false;
    }

    // Step 6: Validate end date
    if (!this.endDate || this.endDate.trim() === '') {
      this.errorMessage = 'Please select an end date';
      return false;
    }

    // Step 7: Validate date range
    if (new Date(this.endDate) <= new Date(this.startDate)) {
      this.errorMessage = 'End date must be after start date';
      return false;
    }

    // Step 8: Validate number of installments
    if (this.numberOfInstallments <= 0) {
      this.errorMessage = 'Invalid date range for selected loan type';
      return false;
    }

    // Step 9: Validate document charge (optional but if provided, should be non-negative)
    if (this.documentCharge < 0) {
      this.errorMessage = 'Document charge cannot be negative';
      return false;
    }

    // Step 10: Validate Loan Guarantors (Must be 2 distinct registered members, not borrower)
    if (!this.guarantor1) {
      this.errorMessage = 'Please select a registered member as Guarantor 1';
      return false;
    }

    if (!this.guarantor2) {
      this.errorMessage = 'Please select a registered member as Guarantor 2';
      return false;
    }

    if (this.foundClient && (this.guarantor1.client_id === this.foundClient.client_id || this.guarantor2.client_id === this.foundClient.client_id)) {
      this.errorMessage = 'The borrower cannot be selected as their own guarantor';
      return false;
    }

    if (this.guarantor1.client_id === this.guarantor2.client_id) {
      this.errorMessage = 'Guarantor 1 and Guarantor 2 cannot be the same member';
      return false;
    }
    
    return true;
  }

  // Check if all required fields are filled for submit button
  isFormReadyForSubmit(): boolean {
    const clientFound = !!this.foundClient;
    const principalValid = this.principalAmount > 0;
    const interestValid = this.interestRate > 0 && this.interestRate <= 100;
    const loanTypeValid = !!this.loanType && this.loanType.trim() !== '';
    const startDateValid = !!this.startDate && this.startDate.trim() !== '';
    const endDateValid = !!this.endDate && this.endDate.trim() !== '';
    const installmentsValid = this.numberOfInstallments > 0;
    const documentChargeValid = this.documentCharge >= 0;
    const dateRangeValid = !this.isEndDateInvalid();
    const guarantorsValid = !!this.guarantor1 && !!this.guarantor2 &&
      (!this.foundClient || (this.guarantor1.client_id !== this.foundClient.client_id && this.guarantor2.client_id !== this.foundClient.client_id)) &&
      (this.guarantor1.client_id !== this.guarantor2.client_id);

    console.log('Validation Debug:', {
      clientFound,
      principalValid,
      interestValid,
      loanTypeValid,
      startDateValid,
      endDateValid,
      installmentsValid,
      documentChargeValid,
      dateRangeValid,
      guarantorsValid,
      principalAmount: this.principalAmount,
      interestRate: this.interestRate,
      loanType: this.loanType,
      startDate: this.startDate,
      endDate: this.endDate,
      numberOfInstallments: this.numberOfInstallments,
      documentCharge: this.documentCharge
    });

    return !this.showCustomerHistory &&
           clientFound && 
           principalValid && 
           interestValid &&
           loanTypeValid && 
           startDateValid && 
           endDateValid && 
           installmentsValid && 
           documentChargeValid && 
           dateRangeValid &&
           guarantorsValid;
  }

  // Check if end date is before or equal to start date
  isEndDateInvalid(): boolean {
    if (!this.startDate || !this.endDate) {
      return false;
    }
    return new Date(this.endDate) <= new Date(this.startDate);
  }

  resetForm(): void {
    // Search & History
    this.searchNicNumber = '';
    this.foundClient = null;
    this.searchError = '';
    this.isClientSearched = false;
    this.isClientFound = false;
    this.showCustomerHistory = false;
    this.showLoanForm = false;
    this.customerLoans = [];
    this.activeLoansCount = 0;
    this.completedLoansCount = 0;

    // Client Information
    this.selectedClientId = '';
    this.clientName = '';
    this.clientRegisterNumber = '';
    this.clientLocation = '';
    this.clientGroup = '';

    // Loan-Level Guarantors
    this.guarantor1 = null;
    this.guarantor2 = null;

    // Loan Details
    this.loanNumber = '';
    this.loanType = 'monthly';
    this.principalAmount = 0;
    this.interestRate = 0;
    this.documentCharge = 0;
    this.calculatedTotal = 0;
    this.numberOfInstallments = 0;
    this.setDefaultDates();
    this.errorMessage = '';
  }

  get clientInitials(): string {
    if (!this.foundClient) return 'LX';
    const first = (this.foundClient.first_name || '').trim()[0] || '';
    const last = (this.foundClient.last_name || '').trim()[0] || '';
    return (first + last).toUpperCase() || 'LX';
  }

  get estimatedInstallmentAmount(): number {
    if (this.numberOfInstallments > 0 && this.calculatedTotal > 0) {
      return this.calculatedTotal / this.numberOfInstallments;
    }
    return 0;
  }

  get totalInterestAmount(): number {
    if (this.calculatedTotal > this.principalAmount) {
      return this.calculatedTotal - this.principalAmount;
    }
    return 0;
  }

  onClear(): void {
    this.resetForm();
  }

  clearSearch(): void {
    this.searchNicNumber = '';
    this.foundClient = null;
    this.searchError = '';
    this.resetForm();
  }

  onGuarantor1Selected(client: Client | null): void {
    this.guarantor1 = client;
    this.errorMessage = '';
  }

  onGuarantor2Selected(client: Client | null): void {
    this.guarantor2 = client;
    this.errorMessage = '';
  }
}
