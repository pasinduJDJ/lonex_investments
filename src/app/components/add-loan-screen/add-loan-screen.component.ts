import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { LoanManageService, Client } from '../../service/loan-manage.service';
import { SupabaseService } from '../../service/supabase.service';
import { CITY_CODE_MAP } from '../../constants/city.constants';
import { ProfitManageService } from '../../service/profit-manage.service';

const GROUP_CODE_MAP: { [key: string]: string } = {
  'Group 1': '001',
  'Group 2': '002',
  'Group 3': '003'
};

@Component({
  selector: 'app-add-loan-screen',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './add-loan-screen.component.html',
  styleUrl: './add-loan-screen.component.css'
})
export class AddLoanScreenComponent implements OnInit {
  // Search functionality
  searchNicNumber: string = '';
  foundClient: Client | null = null;
  isSearching: boolean = false;
  searchError: string = '';

  // Client Information (populated after search)
  selectedClientId: string = '';
  clientName: string = '';
  clientRegisterNumber: string = '';
  clientLocation: string = '';
  clientGroup: string = '';

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

  constructor(
    private loanService: LoanManageService,
    private supabaseService: SupabaseService,
    private router: Router,
    private profitService: ProfitManageService
  ) { }

  ngOnInit(): void {
    this.setDefaultDates();
  }

  setDefaultDates(): void {
    const today = new Date();
    this.startDate = today.toISOString().split('T')[0];

    // Set end date to 30 days from today
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + 30);
    this.endDate = endDate.toISOString().split('T')[0];
  }

  // Search client by NIC number
  searchClient(): void {
    if (!this.searchNicNumber.trim()) {
      this.searchError = 'Please enter a NIC number to search';
      return;
    }

    this.isSearching = true;
    this.searchError = '';
    this.foundClient = null;

    this.findClientByNic(this.searchNicNumber.trim());
  }

  private async findClientByNic(nicNumber: string): Promise<void> {
    try {
      const supabase = this.supabaseService.getClient();

      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('nic_number', nicNumber)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          this.searchError = 'No client found with this NIC number. Please add the client first.';
        } else {
          this.searchError = 'Error searching for client: ' + error.message;
        }
        this.isSearching = false;
        return;
      }

      // Client found - populate the form
      this.foundClient = data as Client;
      this.populateClientData(data as Client);
      this.generateLoanNumber();
      this.isSearching = false;

    } catch (error: any) {
      this.searchError = 'Error searching for client: ' + error.message;
      this.isSearching = false;
    }
  }

  private populateClientData(client: Client): void {
    this.selectedClientId = client.client_id;
    this.clientName = `${client.first_name} ${client.last_name}`;
    this.clientRegisterNumber = client.register_number ? client.register_number.toString().padStart(6, '0') : 'N/A';
    this.clientLocation = client.town_two || 'N/A';
    this.clientGroup = client.group || 'N/A';
  }

  async generateLoanNumber(): Promise<void> {
    if (this.foundClient) {
      const townTwo = this.foundClient.town_two || '';
      const group = this.foundClient.group || '';
      const townCode = CITY_CODE_MAP[townTwo] || '000';
      const groupCode = GROUP_CODE_MAP[group] || '000';

      const supabase = this.supabaseService.getClient();

      // Count existing loans for this town+group
      const { data, error } = await supabase
        .from('loans')
        .select('loan_number', { count: 'exact' })
        .ilike('loan_number', `12-${townCode}-${groupCode}-%`);

      const latestCount = data?.length || 0;
      const paddedCount = (latestCount + 1).toString().padStart(3, '0');

      this.loanNumber = `12-${townCode}-${groupCode}-${paddedCount}`;
      this.newLoanNumber = this.loanNumber;
    }
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
    if (!this.validateForm()) {
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    // Generate the custom loan number before submission
    this.generateLoanNumber();
    const newLoanNumber = this.loanNumber;

    const loanData = {
      client_id: this.selectedClientId,
      loan_number: newLoanNumber, // generated value
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

    this.addLoan(loanData);
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

      const { data, error } = await supabase
        .from('loans')
        .insert(loanToInsert)
        .select()
        .single();

      if (error) {
        if (error.code === '23505') { // Unique constraint violation
          this.errorMessage = 'A loan with this loan number already exists.';
        } else {
          this.errorMessage = 'Error creating loan: ' + error.message;
        }
        this.isLoading = false;
        return;
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
    if (!this.foundClient) {
      this.errorMessage = 'Please search and select a client first';
      return false;
    }
    if (!this.loanNumber.trim()) {
      this.errorMessage = 'Please enter a loan number';
      return false;
    }
    if (this.principalAmount <= 0) {
      this.errorMessage = 'Principal amount must be greater than 0';
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
    if (!this.startDate) {
      this.errorMessage = 'Please select a start date';
      return false;
    }
    if (!this.endDate) {
      this.errorMessage = 'Please select an end date';
      return false;
    }
    if (new Date(this.endDate) <= new Date(this.startDate)) {
      this.errorMessage = 'End date must be after start date';
      return false;
    }
    if (this.numberOfInstallments <= 0) {
      this.errorMessage = 'Invalid date range for selected loan type';
      return false;
    }
    return true;
  }

  resetForm(): void {
    // Search
    this.searchNicNumber = '';
    this.foundClient = null;
    this.searchError = '';

    // Client Information
    this.selectedClientId = '';
    this.clientName = '';
    this.clientRegisterNumber = '';
    this.clientLocation = '';
    this.clientGroup = '';

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

  onClear(): void {
    this.resetForm();
  }

  clearSearch(): void {
    this.searchNicNumber = '';
    this.foundClient = null;
    this.searchError = '';
    this.resetForm();
  }
}
