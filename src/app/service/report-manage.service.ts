import { Injectable } from '@angular/core';
import { LoanManageService, LoanWithClient, Payment, Client } from './loan-manage.service';
import { Observable, combineLatest, map } from 'rxjs';

export interface LoanReport {
  loan: LoanWithClient;
  profit: number;
  profitPercentage: number;
}

export interface PaymentReport {
  payment: Payment;
  loan: LoanWithClient;
}

export interface ClientReport {
  client: Client;
  totalLoans: number;
  totalAmount: number;
  totalPaid: number;
  totalRemaining: number;
  loans: LoanWithClient[];
  payments: Payment[];
}

export interface DateRangeReport {
  startDate: string;
  endDate: string;
  loans: LoanWithClient[];
  payments: Payment[];
  totalLoanAmount: number;
  totalPaymentAmount: number;
  totalProfit: number;
}

@Injectable({
  providedIn: 'root'
})
export class ReportManageService {

  constructor(private loanService: LoanManageService) { }

  // Get client profile report
  getClientProfileReport(clientId: string): Observable<ClientReport> {
    return this.loanService.getClientProfile(clientId).pipe(
      map(({ client, loans, payments }) => {
        const totalAmount = loans.reduce((sum, loan) => sum + loan.total_amount_due, 0);
        const totalPaid = loans.reduce((sum, loan) => sum + loan.total_paid, 0);
        const totalRemaining = loans.reduce((sum, loan) => sum + loan.remaining_amount, 0);

        // Convert loans to LoanWithClient format
        const loansWithClient: LoanWithClient[] = loans.map(loan => ({
          ...loan,
          client
        }));

        return {
          client,
          totalLoans: loans.length,
          totalAmount,
          totalPaid,
          totalRemaining,
          loans: loansWithClient,
          payments
        };
      })
    );
  }

  // Get loans by date range with profit calculation
  getLoansByDateRange(startDate: string, endDate: string): Observable<LoanReport[]> {
    return this.loanService.getLoansByDateRange(startDate, endDate).pipe(
      map(loans => loans.map(loan => {
        const profit = this.loanService.calculateLoanProfit(loan);
        const profitPercentage = loan.principal_amount > 0 ? 
          (profit / loan.principal_amount) * 100 : 0;

        return {
          loan,
          profit,
          profitPercentage
        };
      }))
    );
  }

  // Get payments by date range
  getPaymentsByDateRange(startDate: string, endDate: string): Observable<PaymentReport[]> {
    return this.loanService.getPaymentsByDateRange(startDate, endDate).pipe(
      map(payments => {
        // We need to get loan details for each payment
        // This is a simplified version - in a real app, you might want to optimize this
        return payments.map(payment => ({
          payment,
          loan: null as any // This would need to be populated with actual loan data
        }));
      })
    );
  }

  // Get comprehensive date range report
  getDateRangeReport(startDate: string, endDate: string): Observable<DateRangeReport> {
    return combineLatest([
      this.loanService.getLoansByDateRange(startDate, endDate),
      this.loanService.getPaymentsByDateRange(startDate, endDate)
    ]).pipe(
      map(([loans, payments]) => {
        const totalLoanAmount = loans.reduce((sum, loan) => sum + loan.total_amount_due, 0);
        const totalPaymentAmount = payments.reduce((sum, payment) => sum + payment.paid_amount, 0);
        const totalProfit = loans.reduce((sum, loan) => sum + this.loanService.calculateLoanProfit(loan), 0);

        return {
          startDate,
          endDate,
          loans,
          payments,
          totalLoanAmount,
          totalPaymentAmount,
          totalProfit
        };
      })
    );
  }

  // Get profit analysis for all loans
  getAllLoansProfitReport(): Observable<LoanReport[]> {
    return this.loanService.getAllLoans().pipe(
      map(loans => loans.map(loan => {
        const profit = this.loanService.calculateLoanProfit(loan);
        const profitPercentage = loan.principal_amount > 0 ? 
          (profit / loan.principal_amount) * 100 : 0;

        return {
          loan,
          profit,
          profitPercentage
        };
      }))
    );
  }

  // Get summary statistics
  getSummaryStatistics(): Observable<{
    totalLoans: number;
    activeLoans: number;
    totalLoanAmount: number;
    totalPaidAmount: number;
    totalRemainingAmount: number;
    totalProfit: number;
    averageProfitPercentage: number;
  }> {
    return this.loanService.getAllLoans().pipe(
      map(loans => {
        const totalLoans = loans.length;
        const activeLoans = loans.filter(loan => loan.status === 'active').length;
        const totalLoanAmount = loans.reduce((sum, loan) => sum + loan.total_amount_due, 0);
        const totalPaidAmount = loans.reduce((sum, loan) => sum + loan.total_paid, 0);
        const totalRemainingAmount = loans.reduce((sum, loan) => sum + loan.remaining_amount, 0);
        const totalProfit = loans.reduce((sum, loan) => sum + this.loanService.calculateLoanProfit(loan), 0);
        
        const totalPrincipal = loans.reduce((sum, loan) => sum + loan.principal_amount, 0);
        const averageProfitPercentage = totalPrincipal > 0 ? 
          (totalProfit / totalPrincipal) * 100 : 0;

        return {
          totalLoans,
          activeLoans,
          totalLoanAmount,
          totalPaidAmount,
          totalRemainingAmount,
          totalProfit,
          averageProfitPercentage
        };
      })
    );
  }

  // Get bank capital report
  getBankCapitalReport(): Observable<{
    currentBalance: number;
    totalLoans: number;
    totalRemainingAmount: number;
    cashFlow: number;
  }> {
    return combineLatest([
      this.loanService.getBankCapital(),
      this.loanService.getAllLoans()
    ]).pipe(
      map(([bankCapital, loans]) => {
        const totalRemainingAmount = loans.reduce((sum, loan) => sum + loan.remaining_amount, 0);
        const cashFlow = bankCapital.current_balance - totalRemainingAmount;

        return {
          currentBalance: bankCapital.current_balance,
          totalLoans: loans.length,
          totalRemainingAmount,
          cashFlow
        };
      })
    );
  }

  // Get delayed payments report
  getDelayedPayments(): Observable<Array<{
    loanNumber: string;
    expectedInstallments: number;
    paidInstallments: number;
    delayCount: number;
    clientName: string;
    status: string;
    clientAddress: string;
    clientMobile: string;
    loanType: string;
  }>> {
    return combineLatest([
      this.loanService.getAllLoans(),
      this.loanService.getAllClients(),
      this.loanService.getPaymentsByDateRange('1900-01-01', '2100-01-01')
    ]).pipe(
      map(([loans, clients, payments]) => {
        return loans.map(loan => {
          // Calculate expected installments
          const start = new Date(loan.start_date);
          const end = new Date(loan.end_date);
          let expected = 0;
          if (loan.loan_type === 'daily') {
            expected = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
          } else if (loan.loan_type === 'weekly') {
            expected = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 7)) + 1;
          } else if (loan.loan_type === 'monthly') {
            expected = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
          }
          // Count actual payments
          const paid = payments.filter(p => p.loan_id === loan.id).length;
          const delay = expected - paid;
          const client = loan.client;
          return {
            loanNumber: loan.loan_number,
            expectedInstallments: expected,
            paidInstallments: paid,
            delayCount: delay > 0 ? delay : 0,
            clientName: client ? `${client.first_name} ${client.last_name}` : '',
            status: delay > 0 ? 'Delayed' : 'On Time',
            clientAddress: client ? `${client.home_number || ''} ${client.street_address || ''} ${client.town_one || ''} ${client.town_two || ''}` : '',
            clientMobile: client?.mobile_number || '',
            loanType: loan.loan_type
          };
        });
      })
    );
  }
}
