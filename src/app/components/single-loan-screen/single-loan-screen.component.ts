import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { LoanManageService, LoanWithClient, Payment, LoanGuarantor, LoanRescheduleHistory } from '../../service/loan-manage.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { Router, RouterModule } from '@angular/router';
import { SupabaseService } from '../../service/supabase.service';

export interface ScheduleRow {
  installmentNumber: number;
  dueDate: string;
  amount: number;
  status: 'Paid' | 'Upcoming';
  paidDate?: string;
  isAdjusted?: boolean;
}

@Component({
  selector: 'app-single-loan-screen',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './single-loan-screen.component.html',
  styleUrl: './single-loan-screen.component.css'
})
export class SingleLoanScreenComponent implements OnInit {
  loan$: Observable<LoanWithClient | undefined> = of(undefined);
  payments$: Observable<Payment[]> = of([]);
  loanGuarantors: LoanGuarantor[] = [];
  rescheduleHistory: LoanRescheduleHistory[] = [];
  showCompleteConfirm = false;
  showSuccessMsg = false;
  activeTab: 'payments' | 'client' | 'schedule' | 'reschedule_history' = 'payments';
  installmentStats: {
    expected: number;
    paid: number;
    remaining: number;
    totalPaid: number;
    installmentAmount: number;
  } | null = null;

  // Early Settlement Modal State
  showSettlementModal: boolean = false;
  isSubmittingSettlement: boolean = false;
  settlementSuccessMessage: string = '';
  settlementErrorMessage: string = '';

  // Current values at open time
  currentLoan: LoanWithClient | null = null;
  currentRemainingBalance: number = 0;
  currentInstallmentAmount: number = 0;
  currentPaidInstallments: number = 0;
  currentRemainingInstallments: number = 0;
  currentExpectedEndDate: string = '';

  // New editable values
  newRemainingPeriod: number = 1;
  newInstallmentAmount: number = 0;
  settlementNotes: string = '';

  // Preview values
  previewFutureSchedule: ScheduleRow[] = [];
  previewNewEndDate: string = '';
  finalInstallmentAmount: number = 0;
  isFinalInstallmentAdjusted: boolean = false;
  reconciliationDiff: number = 0;

  setActiveTab(tab: 'payments' | 'client' | 'schedule' | 'reschedule_history'): void {
    this.activeTab = tab;
  }

  getGuarantorByOrder(order: number): LoanGuarantor | undefined {
    return this.loanGuarantors.find(g => g.guarantor_order === order);
  }

  formatMemberId(regNumber?: number): string {
    if (regNumber === undefined || regNumber === null) return '#0000';
    return `#${regNumber.toString().padStart(4, '0')}`;
  }

  constructor(
    private route: ActivatedRoute,
    private loanService: LoanManageService,
    private router: Router,
    private supabaseService: SupabaseService
  ) {}

  ngOnInit() {
    const loan_number = this.route.snapshot.paramMap.get('loan_number')!;
    this.reloadLoanData(loan_number);
  }

  reloadLoanData(loan_number: string): void {
    this.loan$ = this.loanService.getLoanByNumber(loan_number).pipe(
      map((loan) => loan ? loan : undefined)
    );
    this.loan$.subscribe(async (loan) => {
      if (loan) {
        this.installmentStats = await this.loanService.getInstallmentStats(loan);
        this.payments$ = this.loanService.getPaymentsForLoan(loan.id);
        this.loadLoanGuarantors(loan.id);
        this.loadRescheduleHistory(loan.id);
      } else {
        this.installmentStats = null;
        this.payments$ = of([]);
        this.loanGuarantors = [];
        this.rescheduleHistory = [];
      }
    });
  }

  loadLoanGuarantors(loanId: string): void {
    this.loanService.getLoanGuarantors(loanId).subscribe({
      next: (guarantors) => {
        this.loanGuarantors = guarantors || [];
      },
      error: (err) => {
        console.warn('Error loading loan-level guarantors:', err);
        this.loanGuarantors = [];
      }
    });
  }

  loadRescheduleHistory(loanId: string): void {
    this.loanService.getLoanRescheduleHistory(loanId).subscribe({
      next: (history) => {
        this.rescheduleHistory = history || [];
      },
      error: (err) => {
        console.warn('Error loading reschedule history:', err);
        this.rescheduleHistory = [];
      }
    });
  }

  isEligibleForEarlySettlement(loan: LoanWithClient): boolean {
    return loan.status === 'active' && loan.remaining_amount > 0;
  }

  openEarlySettlementModal(loan: LoanWithClient): void {
    this.currentLoan = loan;
    this.currentRemainingBalance = loan.remaining_amount;
    this.currentInstallmentAmount = this.installmentStats?.installmentAmount || 0;
    this.currentPaidInstallments = this.installmentStats?.paid || 0;
    this.currentRemainingInstallments = this.installmentStats?.remaining || 1;
    this.currentExpectedEndDate = loan.end_date;

    this.newRemainingPeriod = Math.max(1, this.currentRemainingInstallments);
    this.newInstallmentAmount = Math.max(1, Math.round(this.currentRemainingBalance / this.newRemainingPeriod));
    this.settlementNotes = '';
    this.settlementErrorMessage = '';
    this.settlementSuccessMessage = '';

    this.recalculatePreview();
    this.showSettlementModal = true;
  }

  closeEarlySettlementModal(): void {
    this.showSettlementModal = false;
    this.settlementErrorMessage = '';
  }

  onPeriodChange(): void {
    if (this.newRemainingPeriod && this.newRemainingPeriod > 0) {
      this.newInstallmentAmount = Math.max(1, Math.round(this.currentRemainingBalance / this.newRemainingPeriod));
    }
    this.recalculatePreview();
  }

  onAmountChange(): void {
    this.recalculatePreview();
  }

  autoCalculateAmount(): void {
    if (this.newRemainingPeriod && this.newRemainingPeriod > 0) {
      this.newInstallmentAmount = Math.max(1, Math.round(this.currentRemainingBalance / this.newRemainingPeriod));
      this.recalculatePreview();
    }
  }

  recalculatePreview(): void {
    this.settlementErrorMessage = '';
    this.previewFutureSchedule = [];

    if (!this.newRemainingPeriod || this.newRemainingPeriod < 1) {
      this.settlementErrorMessage = 'New remaining period must be at least 1 installment.';
      return;
    }

    if (!this.newInstallmentAmount || this.newInstallmentAmount <= 0) {
      this.settlementErrorMessage = 'New installment amount must be greater than zero.';
      return;
    }

    if (this.newInstallmentAmount > this.currentRemainingBalance) {
      this.settlementErrorMessage = `Installment amount cannot exceed total remaining balance (Rs. ${this.currentRemainingBalance.toLocaleString()}).`;
      return;
    }

    const standardCount = this.newRemainingPeriod - 1;
    const standardTotal = standardCount * this.newInstallmentAmount;
    this.finalInstallmentAmount = this.currentRemainingBalance - standardTotal;

    if (this.finalInstallmentAmount <= 0) {
      this.settlementErrorMessage = 'Installment amount is too high for the chosen period. Final installment would be zero or negative.';
      return;
    }

    this.isFinalInstallmentAdjusted = this.finalInstallmentAmount !== this.newInstallmentAmount;
    this.reconciliationDiff = (standardTotal + this.finalInstallmentAmount) - this.currentRemainingBalance;

    const loanType = this.currentLoan?.loan_type || 'monthly';
    const schedule: ScheduleRow[] = [];

    const startDate = this.currentLoan?.start_date ? new Date(this.currentLoan.start_date) : new Date();
    let baseDate = new Date(startDate);

    if (loanType === 'daily') {
      baseDate.setDate(baseDate.getDate() + this.currentPaidInstallments + 1);
    } else if (loanType === 'weekly') {
      baseDate.setDate(baseDate.getDate() + (this.currentPaidInstallments + 1) * 7);
    } else if (loanType === 'monthly') {
      baseDate.setMonth(baseDate.getMonth() + this.currentPaidInstallments + 1);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (baseDate < today) {
      baseDate = new Date(today);
      if (loanType === 'daily') baseDate.setDate(baseDate.getDate() + 1);
      else if (loanType === 'weekly') baseDate.setDate(baseDate.getDate() + 7);
      else if (loanType === 'monthly') baseDate.setMonth(baseDate.getMonth() + 1);
    }

    for (let i = 1; i <= this.newRemainingPeriod; i++) {
      const instNum = this.currentPaidInstallments + i;
      const dueDate = new Date(baseDate);

      if (loanType === 'daily') {
        dueDate.setDate(dueDate.getDate() + (i - 1));
      } else if (loanType === 'weekly') {
        dueDate.setDate(dueDate.getDate() + (i - 1) * 7);
      } else if (loanType === 'monthly') {
        dueDate.setMonth(dueDate.getMonth() + (i - 1));
      }

      const isLast = i === this.newRemainingPeriod;
      const amount = isLast ? this.finalInstallmentAmount : this.newInstallmentAmount;

      schedule.push({
        installmentNumber: instNum,
        dueDate: dueDate.toISOString().split('T')[0],
        amount: amount,
        status: 'Upcoming',
        isAdjusted: isLast && this.isFinalInstallmentAdjusted
      });
    }

    this.previewFutureSchedule = schedule;
    if (schedule.length > 0) {
      this.previewNewEndDate = schedule[schedule.length - 1].dueDate;
    }
  }

  isRescheduleValid(): boolean {
    return !this.settlementErrorMessage &&
           this.newRemainingPeriod > 0 &&
           this.newInstallmentAmount > 0 &&
           this.finalInstallmentAmount > 0 &&
           this.previewFutureSchedule.length > 0;
  }

  confirmEarlySettlement(): void {
    if (!this.isRescheduleValid() || !this.currentLoan) return;

    this.isSubmittingSettlement = true;
    this.settlementErrorMessage = '';

    const newTotalInstallments = this.currentPaidInstallments + this.newRemainingPeriod;
    const userName = localStorage.getItem('userName') || 'Admin';

    this.loanService.rescheduleLoan(this.currentLoan.id, {
      newEndDate: this.previewNewEndDate,
      newTotalInstallments: newTotalInstallments,
      oldInstallmentAmount: this.currentInstallmentAmount,
      newInstallmentAmount: this.newInstallmentAmount,
      oldRemainingInstallments: this.currentRemainingInstallments,
      newRemainingInstallments: this.newRemainingPeriod,
      oldEndDate: this.currentExpectedEndDate,
      remainingBalance: this.currentRemainingBalance,
      changedBy: userName,
      notes: this.settlementNotes.trim() || undefined
    }).subscribe({
      next: (res) => {
        this.isSubmittingSettlement = false;
        if (res.success) {
          const loanNum = this.currentLoan!.loan_number;
          this.closeEarlySettlementModal();
          this.showSuccessMsg = true;
          this.settlementSuccessMessage = 'Loan repayment schedule updated successfully.';
          this.reloadLoanData(loanNum);
          this.activeTab = 'schedule';
        } else {
          this.settlementErrorMessage = res.error?.message || (typeof res.error === 'string' ? res.error : 'Failed to update schedule. Please try again.');
        }
      },
      error: (err) => {
        this.isSubmittingSettlement = false;
        this.settlementErrorMessage = err.message || 'An unexpected error occurred during rescheduling.';
      }
    });
  }

  getFullScheduleRows(loan: LoanWithClient, stats: any, payments: Payment[]): ScheduleRow[] {
    if (!stats) return [];
    const rows: ScheduleRow[] = [];
    const total = stats.expected || 1;
    const paid = stats.paid || 0;
    const startDate = loan.start_date ? new Date(loan.start_date) : new Date();
    const loanType = loan.loan_type || 'monthly';

    for (let i = 1; i <= total; i++) {
      const dueDate = new Date(startDate);
      if (loanType === 'daily') dueDate.setDate(dueDate.getDate() + (i - 1));
      else if (loanType === 'weekly') dueDate.setDate(dueDate.getDate() + (i - 1) * 7);
      else if (loanType === 'monthly') dueDate.setMonth(dueDate.getMonth() + (i - 1));

      const isPaid = i <= paid;
      const payment = isPaid && payments && payments[i - 1] ? payments[i - 1] : undefined;

      rows.push({
        installmentNumber: i,
        dueDate: dueDate.toISOString().split('T')[0],
        amount: stats.installmentAmount || Math.round(loan.total_amount_due / total),
        status: isPaid ? 'Paid' : 'Upcoming',
        paidDate: payment?.paid_date
      });
    }
    return rows;
  }

  completeLoan(loan: LoanWithClient) {
    this.loanService.updateLoanStatus(loan.id, 'closed').subscribe(() => {
      this.showCompleteConfirm = false;
      this.showSuccessMsg = true;
      this.settlementSuccessMessage = 'Loan status updated to Closed successfully!';
    });
  }

  async getPrint(loan: LoanWithClient, installmentStats: any) {
    // Dynamically import pdfMake and fonts
    const pdfMakeModule = await import('pdfmake/build/pdfmake');
    const pdfFonts = await import('pdfmake/build/vfs_fonts');
    (pdfMakeModule as any).vfs = (pdfFonts as any).pdfMake.vfs;

    // Fetch payments for this loan
    const payments = await this.loanService.getPaymentsForLoan(loan.id).toPromise() || [];

    const docDefinition = {
      content: [
        { text: `Loan Details (${loan.loan_reg_number})`, style: 'header' },
        { text: '\n' },
        { text: `Client Name: ${loan.client.first_name} ${loan.client.last_name}` },
        {
          text: `Client Address: ${loan.client.home_number || ''} ${loan.client.street_address || ''} ${loan.client.town_one || ''} ${loan.client.town_two || ''} ${loan.client.group ? '| ' + loan.client.group : ''}`
        },
        { text: `Loan Register Number: ${loan.loan_reg_number}` },
        { text: `Loan Type: ${loan.loan_type}` },
        { text: `Status: ${loan.status}` },
        { text: `Loan Amount: ${loan.principal_amount}` },
        { text: `Document Charges: ${loan.document_charge || 0}` },
        { text: `Interest Rate: ${loan.interest_rate}%` },
        { text: `Total Due: ${loan.total_amount_due}` },
        { text: `Per Installment Amount: ${installmentStats.installmentAmount}` },
        { text: `Total Paid: ${loan.total_paid}` },
        { text: `Remaining Amount: ${loan.remaining_amount}` },
        { text: '\n' },
        { text: 'Installment Stats', style: 'subheader' },
        {
          table: {
            widths: ['*', '*', '*', '*'],
            body: [
              ['Expected', 'Paid', 'Remaining', 'Total Paid'],
              [
                installmentStats.expected,
                installmentStats.paid,
                installmentStats.remaining,
                installmentStats.totalPaid
              ]
            ]
          }
        },
        { text: '\n' },
        { text: `Start Date: ${loan.start_date}` },
        { text: `End Date: ${loan.end_date}` },
        { text: `Created Date: ${loan.created_at}` },
        { text: '\n' },
        { text: 'Payment History', style: 'subheader' },
        ...(payments.length > 0 ? [
          {
            table: {
              widths: ['*', '*', '*'],
              body: [
                ['Payment Date', 'Amount Paid', 'Remark'],
                ...payments.map(payment => [
                  new Date(payment.paid_date).toLocaleDateString(),
                  payment.paid_amount.toString(),
                  payment.remark || '-',
                  new Date(payment.created_at).toLocaleDateString()
                ])
              ]
            }
          },
          { text: '\n' },
          { text: `Total Payments: ${payments.length} payment(s)`, style: 'subheader' },
          { text: `Total Amount Paid: ${payments.reduce((sum, p) => sum + p.paid_amount, 0)}`, style: 'subheader' }
        ] : [
          { text: 'No payment records found for this loan.', style: 'subheader' }
        ])
      ],
      styles: {
        header: {
          fontSize: 18,
          bold: true,
          color: '#1976d2'
        },
        subheader: {
          fontSize: 14,
          bold: true,
          margin: [0, 10, 0, 4] as [number, number, number, number]
        }
      }
    };

    (pdfMakeModule as any).createPdf(docDefinition).download(`LoanDetails_${loan.loan_reg_number}.pdf`);
  }

  async getDocx(loan: LoanWithClient, installmentStats: any) {
    const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle, ShadingType, ImageRun } = await import('docx');

    // Fetch payments for this loan
    const payments = await this.loanService.getPaymentsForLoan(loan.id).toPromise() || [];

    // Helper for bold label
    const label = (text: string) => new TextRun({ text, bold: true, font: 'Arial', size: 22 });
    const value = (text: string) => new TextRun({ text, font: 'Arial', size: 22 });
    const sectionHeader = (text: string) => new Paragraph({
      children: [new TextRun({ text, bold: true, font: 'Arial', size: 24 })],
      spacing: { after: 120 },
    });

    // Try to load logo image from assets (browser fetch as base64)
    let logoImage: InstanceType<typeof ImageRun> | undefined = undefined;
    try {
      const response = await fetch('assets/logo.png');
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      logoImage = new (ImageRun as any)({
        data: arrayBuffer,
        transformation: { width: 48, height: 48 },
      });
    } catch (e) {
      // If logo not found, skip
    }

    // Header row with logo - title - logo
    const headerRow = new TableRow({
      children: [
        new TableCell({
          children: [logoImage ? new Paragraph({ children: [logoImage], alignment: AlignmentType.CENTER }) : new Paragraph('')],
          verticalAlign: 'center',
          borders: { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } },
        }),
        new TableCell({
          children: [
            new Paragraph({
              children: [new TextRun({ text: 'Lonex Investments', bold: true, size: 48, font: 'Arial', color: '#003566' })],
              alignment: AlignmentType.CENTER,
            }),
          ],
          verticalAlign: 'center',
          borders: { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } },
        }),
        new TableCell({
          children: [logoImage ? new Paragraph({ children: [logoImage], alignment: AlignmentType.CENTER }) : new Paragraph('')],
          verticalAlign: 'center',
          borders: { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } },
        }),
      ],
      height: { value: 100, rule: 'atLeast' },
    });

    // Main details table rows (with merged cells and section headers)
    const detailsRows = [
      // Section: Loan Details
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: 'Loan Details', bold: true, size: 24, font: 'Arial' })] })],
            columnSpan: 4,
            shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'EDEDED' },
            borders: { top: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, left: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, right: { style: BorderStyle.SINGLE, size: 1, color: '000000' } },
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph('Client Name')], borders: { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } } }),
          new TableCell({ children: [new Paragraph(loan.client.first_name + ' ' + loan.client.last_name)], borders: { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } }, columnSpan: 3 }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph('CLient Address')], borders: { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } } }),
          new TableCell({ children: [new Paragraph(`${loan.client.home_number || ''} ${loan.client.street_address || ''} ${loan.client.town_one || ''} ${loan.client.town_two || ''}${loan.client.group ? ' | ' + loan.client.group : ''}`)], borders: { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } }, columnSpan: 3 }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph('Loan Number')], borders: { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } } }),
          new TableCell({ children: [new Paragraph((loan.loan_reg_number || '').toString())], borders: { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } }, columnSpan: 3 }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph('Loan Type')], borders: { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } } }),
          new TableCell({ children: [new Paragraph((loan.loan_type || '').toString())], borders: { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } } }),
          new TableCell({ children: [new Paragraph('Loan Status')], borders: { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } } }),
          new TableCell({ children: [new Paragraph((loan.status || '').toString())], borders: { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } } }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph('Loan Amount')], borders: { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } } }),
          new TableCell({ children: [new Paragraph((loan.principal_amount !== undefined ? loan.principal_amount : '').toString())], borders: { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } } }),
          new TableCell({ children: [new Paragraph('Loan Rate')], borders: { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } } }),
          new TableCell({ children: [new Paragraph((loan.interest_rate !== undefined ? loan.interest_rate : '').toString())], borders: { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } } }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph('Document Charges')], borders: { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } } }),
          new TableCell({ children: [new Paragraph((loan.document_charge || 0).toString())], borders: { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } }, columnSpan: 3 }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph('Due Amount')], borders: { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } } }),
          new TableCell({ children: [new Paragraph((loan.total_amount_due !== undefined ? loan.total_amount_due : '').toString())], borders: { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } }, columnSpan: 3 }),
        ],
      }),
      // Section: Installment Details
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: 'Installment Details', bold: true, size: 24, font: 'Arial' })] })],
            columnSpan: 4,
            shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'EDEDED' },
            borders: { top: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, left: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, right: { style: BorderStyle.SINGLE, size: 1, color: '000000' } },
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph('Per Installment Amount')], borders: { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } } }),
          new TableCell({ children: [new Paragraph((installmentStats.installmentAmount !== undefined ? installmentStats.installmentAmount : '').toString())], borders: { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } } }),
          new TableCell({ children: [new Paragraph('')], borders: { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } }, columnSpan: 2 }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph('Paid Amount')], borders: { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } } }),
          new TableCell({ children: [new Paragraph((loan.total_paid !== undefined ? loan.total_paid : '').toString())], borders: { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } } }),
          new TableCell({ children: [new Paragraph('Paid Installments')], borders: { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } } }),
          new TableCell({ children: [new Paragraph((installmentStats.paid !== undefined ? installmentStats.paid : '').toString())], borders: { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } } }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph('Remaining Amount')], borders: { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } } }),
          new TableCell({ children: [new Paragraph((loan.remaining_amount !== undefined ? loan.remaining_amount : '').toString())], borders: { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } } }),
          new TableCell({ children: [new Paragraph('Remaining installments')], borders: { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } } }),
          new TableCell({ children: [new Paragraph((installmentStats.remaining !== undefined ? installmentStats.remaining : '').toString())], borders: { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } } }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph('Loan Issue Date')], borders: { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } } }),
          new TableCell({ children: [new Paragraph((loan.start_date !== undefined ? loan.start_date : '').toString())], borders: { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } } }),
          new TableCell({ children: [new Paragraph('')], borders: { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } }, columnSpan: 2 }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph('Loan Settlement Date')], borders: { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } } }),
          new TableCell({ children: [new Paragraph((loan.end_date !== undefined ? loan.end_date : '').toString())], borders: { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } } }),
          new TableCell({ children: [new Paragraph('')], borders: { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } }, columnSpan: 2 }),
        ],
      }),
      // Section: Payment History
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: 'Payment History', bold: true, size: 24, font: 'Arial' })] })],
            columnSpan: 4,
            shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'EDEDED' },
            borders: { top: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, left: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, right: { style: BorderStyle.SINGLE, size: 1, color: '000000' } },
          }),
        ],
      }),
    ];

    // Add payment rows if payments exist
    if (payments.length > 0) {
      // Add header row for payments table
      detailsRows.push(
        new TableRow({
          children: [
            new TableCell({ 
              children: [new Paragraph('Payment Date')], 
              borders: { top: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, left: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, right: { style: BorderStyle.SINGLE, size: 1, color: '000000' } },
              shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'F0F0F0' }
            }),
            new TableCell({ 
              children: [new Paragraph('Amount Paid')], 
              borders: { top: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, left: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, right: { style: BorderStyle.SINGLE, size: 1, color: '000000' } },
              shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'F0F0F0' }
            }),
            new TableCell({ 
              children: [new Paragraph('Remark')], 
              borders: { top: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, left: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, right: { style: BorderStyle.SINGLE, size: 1, color: '000000' } },
              shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'F0F0F0' }
            }),
          ],
        })
      );

      // Add payment data rows
      payments.forEach(payment => {
        detailsRows.push(
          new TableRow({
            children: [
              new TableCell({ 
                children: [new Paragraph(new Date(payment.paid_date).toLocaleDateString())], 
                borders: { top: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, left: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, right: { style: BorderStyle.SINGLE, size: 1, color: '000000' } }
              }),
              new TableCell({ 
                children: [new Paragraph(payment.paid_amount.toString())], 
                borders: { top: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, left: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, right: { style: BorderStyle.SINGLE, size: 1, color: '000000' } }
              }),
              new TableCell({ 
                children: [new Paragraph(payment.remark || '-')], 
                borders: { top: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, left: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, right: { style: BorderStyle.SINGLE, size: 1, color: '000000' } }
              }),
            ],
          })
        );
      });

      // Add summary row
      const totalPaid = payments.reduce((sum, payment) => sum + payment.paid_amount, 0);
      detailsRows.push(
        new TableRow({
          children: [
            new TableCell({ 
              children: [new Paragraph({ children: [new TextRun({ text: 'Total Payments', bold: true })] })], 
              borders: { top: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, left: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, right: { style: BorderStyle.SINGLE, size: 1, color: '000000' } },
              shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'E8F5E8' }
            }),
            new TableCell({ 
              children: [new Paragraph({ children: [new TextRun({ text: totalPaid.toString(), bold: true })] })], 
              borders: { top: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, left: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, right: { style: BorderStyle.SINGLE, size: 1, color: '000000' } },
              shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'E8F5E8' }
            }),
            new TableCell({ 
              children: [new Paragraph({ children: [new TextRun({ text: `${payments.length} payment(s)`, bold: true })] })], 
              borders: { top: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, left: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, right: { style: BorderStyle.SINGLE, size: 1, color: '000000' } },
              shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'E8F5E8' }
            }),
            new TableCell({ 
              children: [new Paragraph('')], 
              borders: { top: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, left: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, right: { style: BorderStyle.SINGLE, size: 1, color: '000000' } },
              shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'E8F5E8' }
            }),
          ],
        })
      );
    } else {
      // Add "No payments" message
      detailsRows.push(
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph('No payment records found for this loan.')],
              columnSpan: 4,
              borders: { top: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, left: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, right: { style: BorderStyle.SINGLE, size: 1, color: '000000' } },
            }),
          ],
        })
      );
    }

    // Compose document
    const doc = new Document({
      sections: [
        {
          children: [
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [headerRow],
              borders: { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, insideVertical: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } },
            }),
            new Paragraph({ text: ' ' }),
            new Table({
              width: { size: 80, type: WidthType.PERCENTAGE },
              rows: detailsRows,
              alignment: AlignmentType.CENTER,
              borders: { top: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, left: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, right: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, insideVertical: { style: BorderStyle.SINGLE, size: 1, color: '000000' } },
            }),
          ],
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `LoanDetails_${loan.loan_reg_number}.docx`;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  async deleteLoan(loan_reg_number: number) {
    if (!confirm('Are you sure you want to delete this loan Record?')) return;
    this.loanService.deleteLoanByRegNumber(loan_reg_number).subscribe({
      next: () => {
        this.router.navigate(['/loan-manage']);
      },
      error: () => {
        alert('Failed to delete loan.');
      }
    });
  }
}