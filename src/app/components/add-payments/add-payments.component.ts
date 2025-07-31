import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { LoanManageService, LoanWithClient, Payment } from '../../service/loan-manage.service';
import { SupabaseService } from '../../service/supabase.service';
import { ProfitManageService } from '../../service/profit-manage.service';

@Component({
  selector: 'app-add-payments',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './add-payments.component.html',
  styleUrl: './add-payments.component.css'
})
export class AddPaymentsComponent {
  loanNumber: string = '';
  foundLoan: LoanWithClient | null = null;
  paidAmount: number = 0;
  paymentDate: string = '';
  remark: string = '';
  isLoading: boolean = false;
  isSearching: boolean = false;
  errorMessage: string = '';
  successMessage: string = '';
  installmentStats: {
    expected: number;
    paid: number;
    remaining: number;
    totalPaid: number;
    installmentAmount: number;
  } | null = null;

  constructor(
    private loanService: LoanManageService,
    private supabaseService: SupabaseService,
    private router: Router,
    private profitService: ProfitManageService
  ) {
    this.setDefaultPaymentDate();
  }

  setDefaultPaymentDate(): void {
    const today = new Date();
    this.paymentDate = today.toISOString().split('T')[0];
  }

  searchLoan(): void {
    if (!this.loanNumber.trim()) {
      this.errorMessage = 'Please enter a loan number';
      return;
    }

    this.isSearching = true;
    this.errorMessage = '';
    this.foundLoan = null;
    this.installmentStats = null; // Clear previous stats

    this.findLoanByNumber(this.loanNumber.trim());
  }

  private async findLoanByNumber(loanNumber: string): Promise<void> {
    try {
      const supabase = this.supabaseService.getClient();
      
      const { data, error } = await supabase
        .from('loans')
        .select(`
          *,
          client:clients(*)
        `)
        .eq('loan_number', loanNumber)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          this.errorMessage = 'No loan found with this loan number. Please check the number.';
        } else {
          this.errorMessage = 'Error searching for loan: ' + error.message;
        }
        this.isSearching = false;
        this.installmentStats = null;
        return;
      }

      // Loan found - populate the form
      this.foundLoan = data as LoanWithClient;
      console.log('Found loan data:', data); // Debug log
      this.isSearching = false;
      // Fetch installment stats for the found loan
      this.installmentStats = await this.loanService.getInstallmentStats(this.foundLoan);

    } catch (error: any) {
      this.errorMessage = 'Error searching for loan: ' + error.message;
      this.isSearching = false;
      this.installmentStats = null;
    }
  }

  submitPayment(): void {
    if (!this.foundLoan) {
      this.errorMessage = 'Please search for a valid loan first';
      return;
    }

    if (this.paidAmount <= 0) {
      this.errorMessage = 'Payment amount must be greater than 0';
      return;
    }

    if (this.paidAmount > this.foundLoan.remaining_amount) {
      this.errorMessage = `Payment amount cannot exceed remaining amount (${this.foundLoan.remaining_amount})`;
      return;
    }

    if (!this.paymentDate) {
      this.errorMessage = 'Please select a payment date';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    const paymentData = {
      loan_id: this.foundLoan.id,
      paid_amount: this.paidAmount,
      paid_date: this.paymentDate,
      remark: this.remark.trim() || undefined
    };

    this.addPayment(paymentData);
  }

  private async addPayment(paymentData: any): Promise<void> {
    try {
      const supabase = this.supabaseService.getClient();
      // Insert the payment
      const { data, error } = await supabase
        .from('payments')
        .insert(paymentData)
        .select()
        .single();

      if (error) {
        this.errorMessage = 'Error adding payment: ' + error.message;
        this.isLoading = false;
        return;
      }

      // Update the loan's remaining amount and total paid
      const newTotalPaid = this.foundLoan!.total_paid + paymentData.paid_amount;
      const newRemainingAmount = this.foundLoan!.total_amount_due - newTotalPaid;

      // Check if remaining amount is 0 or less to close the loan
      const shouldCloseLoan = newRemainingAmount <= 0;
      const newStatus = shouldCloseLoan ? 'closed' : 'active';

      const { error: updateError } = await supabase
        .from('loans')
        .update({
          total_paid: newTotalPaid,
          remaining_amount: newRemainingAmount,
          status: newStatus
        })
        .eq('id', this.foundLoan!.id);

      if (updateError) {
        this.errorMessage = 'Payment added but error updating loan: ' + updateError.message;
        this.isLoading = false;
        return;
      }

      // Increase bank capital by payment amount
      this.profitService.increaseBankCapital(paymentData.paid_amount).subscribe({
        next: () => {
          let successMsg = `Payment of ${this.paidAmount} added successfully!`;
          if (shouldCloseLoan) {
            successMsg += ' Loan has been closed as the remaining amount is now 0.';
          }
          this.successMessage = successMsg;
          this.resetPaymentForm();
          // Refresh loan data to show updated amounts
          this.searchLoan();
          setTimeout(() => {
            this.successMessage = '';
          }, 3000);
        },
        error: (err) => {
          let successMsg = `Payment of ${this.paidAmount} added, but failed to update bank capital.`;
          if (shouldCloseLoan) {
            successMsg += ' Loan has been closed as the remaining amount is now 0.';
          }
          this.successMessage = successMsg;
          this.resetPaymentForm();
          this.searchLoan();
          setTimeout(() => {
            this.successMessage = '';
          }, 3000);
        }
      });
    } catch (error: any) {
      this.errorMessage = 'Error adding payment: ' + error.message;
    } finally {
      this.isLoading = false;
    }
  }

  resetPaymentForm(): void {
    this.paidAmount = 0;
    this.paymentDate = '';
    this.remark = '';
    this.setDefaultPaymentDate();
  }

  clearSearch(): void {
    this.loanNumber = '';
    this.foundLoan = null;
    this.resetPaymentForm();
    this.errorMessage = '';
    this.successMessage = '';
    this.installmentStats = null; // Clear stats on clear
  }

  getProgressPercentage(): number {
    if (!this.foundLoan) return 0;
    return (this.foundLoan.total_paid / this.foundLoan.total_amount_due) * 100;
  }

  getProgressColor(): string {
    const percentage = this.getProgressPercentage();
    if (percentage >= 80) return 'success';
    if (percentage >= 50) return 'warning';
    return 'danger';
  }

  formatLoanRegNumber(regNumber: number | undefined): string {
    if (!regNumber) return 'N/A';
    return regNumber.toString().padStart(6, '0');
  }

  // Remove any getters or code that reference number_of_installments or custom installment calculation.
  // Only use installmentStats for displaying installment information in the template.
}
