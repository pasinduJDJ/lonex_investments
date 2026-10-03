import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Client, Loan, Payment, LoanGuarantor } from './loan-manage.service';
import { Observable, from, of, forkJoin } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

// -------------------------------------------------------------
// Report 01: Customer Master Interfaces
// -------------------------------------------------------------
export interface CustomerMasterRow {
  clientId: string;
  memberId: string;
  registerNumber: number;
  fullName: string;
  nicNumber: string;
  mobileNumber: string;
  homeNumber: string;
  fullAddress: string;
  registrationDate: string;
  membershipStatus: 'Member' | 'Non-Member';
  groupName: string;
}

export interface CustomerMasterFilters {
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  membership?: 'all' | 'member' | 'non-member';
}

export interface CustomerMasterSummary {
  totalCustomers: number;
  totalMembers: number;
  totalNonMembers: number;
}

// -------------------------------------------------------------
// Report 02: Customer Loan Summary Interfaces
// -------------------------------------------------------------
export interface CustomerLoanSummaryRow {
  clientId: string;
  memberId: string;
  customerName: string;
  nicNumber: string;
  mobileNumber: string;
  totalLoans: number;
  activeLoans: number;
  completedLoans: number;
  totalLoanAmount: number;
  totalPaid: number;
  remainingAmount: number;
  hasOverdue: boolean;
  loanNumbers: string[];
}

export interface CustomerLoanSummaryFilters {
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  loanStatus?: 'all' | 'active' | 'completed' | 'overdue';
}

export interface CustomerLoanSummaryTotals {
  totalCustomersWithLoans: number;
  totalLoansIssued: number;
  totalActiveLoans: number;
  totalCompletedLoans: number;
  totalAmountDue: number;
  totalPaid: number;
  totalRemaining: number;
}

// -------------------------------------------------------------
// Report 03: Customer Statement Interfaces
// -------------------------------------------------------------
export interface CustomerStatementLoanRow {
  id: string;
  loanNumber: string;
  startDate: string;
  endDate: string;
  loanType: string;
  principalAmount: number;
  interestRate: number;
  documentCharge: number;
  totalAmountDue: number;
  totalPaid: number;
  remainingAmount: number;
  status: 'active' | 'closed';
}

export interface CustomerStatementPaymentRow {
  id: string;
  loanId: string;
  loanNumber: string;
  paidDate: string;
  amount: number;
  remark: string;
}

export interface CustomerStatementData {
  client: Client;
  memberId: string;
  fullName: string;
  nicNumber: string;
  mobileNumber: string;
  address: string;
  summary: {
    totalLoans: number;
    activeLoans: number;
    completedLoans: number;
    totalAmountDue: number;
    totalPaid: number;
    totalRemaining: number;
  };
  loans: CustomerStatementLoanRow[];
  payments: CustomerStatementPaymentRow[];
}

export interface CustomerStatementFilters {
  clientId: string;
  dateFrom?: string;
  dateTo?: string;
}

// -------------------------------------------------------------
// Report 04: Guarantor Report Interfaces
// -------------------------------------------------------------
export interface GuarantorReportRow {
  guarantorName: string;
  guarantorNic: string;
  guarantorMobile: string;
  guarantorMemberId: string;
  borrowerName: string;
  borrowerNic: string;
  borrowerMobile: string;
  loanNumber: string;
  loanDate: string;
  loanType: string;
  loanAmount: number;
  remainingAmount: number;
  loanStatus: 'active' | 'closed';
  guarantorOrder: number;
}

export interface GuarantorReportFilters {
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  loanStatus?: 'all' | 'active' | 'closed';
}

export interface GuarantorReportSummary {
  totalRelationships: number;
  uniqueGuarantors: number;
  totalGuaranteedBalance: number;
  activeGuarantees: number;
}

@Injectable({
  providedIn: 'root'
})
export class CustomerReportService {

  constructor(private supabaseService: SupabaseService) {}

  /**
   * Helper to format member/register number into #0001
   */
  formatMemberId(regNum?: number | null): string {
    if (regNum === undefined || regNum === null) return '-';
    return `#${regNum.toString().padStart(4, '0')}`;
  }

  /**
   * Helper to build clean full address from client columns
   */
  formatAddress(client: Client): string {
    const parts = [
      client.street_address,
      client.town_one,
      client.town_two
    ].filter(p => !!p && p.trim() !== '');
    return parts.length > 0 ? parts.join(', ') : '-';
  }

  // =========================================================================
  // REPORT 01: CUSTOMER MASTER REPORT (100% READ-ONLY)
  // =========================================================================

  getCustomerMasterReport(filters: CustomerMasterFilters = {}): Observable<{
    rows: CustomerMasterRow[];
    summary: CustomerMasterSummary;
  }> {
    const supabase = this.supabaseService.getClient();

    return from(
      supabase
        .from('clients')
        .select('*')
        .order('register_number', { ascending: true, nullsFirst: false })
    ).pipe(
      map(response => {
        if (response.error) {
          throw new Error('Failed to fetch customers: ' + response.error.message);
        }

        const rawClients = (response.data || []) as Client[];

        // Map into standardized rows
        let rows: CustomerMasterRow[] = rawClients.map(c => ({
          clientId: c.client_id,
          memberId: this.formatMemberId(c.register_number),
          registerNumber: c.register_number || 0,
          fullName: `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Unknown',
          nicNumber: c.nic_number || '-',
          mobileNumber: c.mobile_number || c.home_number || '-',
          homeNumber: c.home_number || '-',
          fullAddress: this.formatAddress(c),
          registrationDate: c.created_at ? c.created_at.split('T')[0] : '-',
          membershipStatus: c.is_member ? 'Member' : 'Non-Member',
          groupName: c.group || '-'
        }));

        // In-memory safe filtering
        if (filters.search && filters.search.trim()) {
          const q = filters.search.trim().toLowerCase();
          rows = rows.filter(r =>
            r.fullName.toLowerCase().includes(q) ||
            r.nicNumber.toLowerCase().includes(q) ||
            r.mobileNumber.toLowerCase().includes(q) ||
            r.memberId.toLowerCase().includes(q) ||
            r.fullAddress.toLowerCase().includes(q) ||
            r.groupName.toLowerCase().includes(q)
          );
        }

        if (filters.membership && filters.membership !== 'all') {
          const isMemberFilter = filters.membership === 'member' ? 'Member' : 'Non-Member';
          rows = rows.filter(r => r.membershipStatus === isMemberFilter);
        }

        if (filters.dateFrom) {
          rows = rows.filter(r => r.registrationDate !== '-' && r.registrationDate >= filters.dateFrom!);
        }

        if (filters.dateTo) {
          rows = rows.filter(r => r.registrationDate !== '-' && r.registrationDate <= filters.dateTo!);
        }

        const summary: CustomerMasterSummary = {
          totalCustomers: rows.length,
          totalMembers: rows.filter(r => r.membershipStatus === 'Member').length,
          totalNonMembers: rows.filter(r => r.membershipStatus === 'Non-Member').length
        };

        return { rows, summary };
      })
    );
  }

  // =========================================================================
  // REPORT 02: CUSTOMER LOAN SUMMARY (100% READ-ONLY)
  // =========================================================================

  getCustomerLoanSummaryReport(filters: CustomerLoanSummaryFilters = {}): Observable<{
    rows: CustomerLoanSummaryRow[];
    totals: CustomerLoanSummaryTotals;
  }> {
    const supabase = this.supabaseService.getClient();

    return forkJoin({
      clientsRes: from(supabase.from('clients').select('*').order('register_number', { ascending: true })),
      loansRes: from(supabase.from('loans').select('*').order('created_at', { ascending: false }))
    }).pipe(
      map(({ clientsRes, loansRes }) => {
        if (clientsRes.error) throw new Error('Failed to fetch clients: ' + clientsRes.error.message);
        if (loansRes.error) throw new Error('Failed to fetch loans: ' + loansRes.error.message);

        const clients = (clientsRes.data || []) as Client[];
        const loans = (loansRes.data || []) as Loan[];

        // Group loans by client_id to prevent any Cartesian joins or duplication
        const loansByClient = new Map<string, Loan[]>();
        for (const loan of loans) {
          const list = loansByClient.get(loan.client_id) || [];
          list.push(loan);
          loansByClient.set(loan.client_id, list);
        }

        const today = new Date().toISOString().split('T')[0];

        // Map each customer with their calculated loan totals
        let rows: CustomerLoanSummaryRow[] = clients.map(client => {
          let clientLoans = loansByClient.get(client.client_id) || [];

          // If date filters are provided, filter the loan list for date-bound loan calculations
          if (filters.dateFrom) {
            clientLoans = clientLoans.filter(l => (l.start_date || l.created_at || '') >= filters.dateFrom!);
          }
          if (filters.dateTo) {
            clientLoans = clientLoans.filter(l => (l.start_date || l.created_at || '') <= filters.dateTo!);
          }

          const totalLoans = clientLoans.length;
          const activeLoans = clientLoans.filter(l => l.status === 'active').length;
          const completedLoans = clientLoans.filter(l => l.status === 'closed').length;

          // Safe summation
          const totalLoanAmount = clientLoans.reduce((sum, l) => sum + (Number(l.total_amount_due) || 0), 0);
          const totalPaid = clientLoans.reduce((sum, l) => sum + (Number(l.total_paid) || 0), 0);
          const remainingAmount = clientLoans.reduce((sum, l) => sum + (Number(l.remaining_amount) || 0), 0);

          const hasOverdue = clientLoans.some(l => l.status === 'active' && l.end_date && l.end_date < today);
          const loanNumbers = clientLoans.map(l => l.loan_number);

          return {
            clientId: client.client_id,
            memberId: this.formatMemberId(client.register_number),
            customerName: `${client.first_name || ''} ${client.last_name || ''}`.trim() || 'Unknown',
            nicNumber: client.nic_number || '-',
            mobileNumber: client.mobile_number || client.home_number || '-',
            totalLoans,
            activeLoans,
            completedLoans,
            totalLoanAmount,
            totalPaid,
            remainingAmount,
            hasOverdue,
            loanNumbers
          };
        });

        // Search Filter
        if (filters.search && filters.search.trim()) {
          const q = filters.search.trim().toLowerCase();
          rows = rows.filter(r =>
            r.customerName.toLowerCase().includes(q) ||
            r.nicNumber.toLowerCase().includes(q) ||
            r.mobileNumber.toLowerCase().includes(q) ||
            r.memberId.toLowerCase().includes(q) ||
            r.loanNumbers.some(num => num.toLowerCase().includes(q))
          );
        }

        // Loan Status Filter
        if (filters.loanStatus && filters.loanStatus !== 'all') {
          if (filters.loanStatus === 'active') {
            rows = rows.filter(r => r.activeLoans > 0);
          } else if (filters.loanStatus === 'completed') {
            rows = rows.filter(r => r.totalLoans > 0 && r.activeLoans === 0);
          } else if (filters.loanStatus === 'overdue') {
            rows = rows.filter(r => r.hasOverdue);
          }
        }

        // Calculate Totals safely
        const totals: CustomerLoanSummaryTotals = {
          totalCustomersWithLoans: rows.filter(r => r.totalLoans > 0).length,
          totalLoansIssued: rows.reduce((s, r) => s + r.totalLoans, 0),
          totalActiveLoans: rows.reduce((s, r) => s + r.activeLoans, 0),
          totalCompletedLoans: rows.reduce((s, r) => s + r.completedLoans, 0),
          totalAmountDue: rows.reduce((s, r) => s + r.totalLoanAmount, 0),
          totalPaid: rows.reduce((s, r) => s + r.totalPaid, 0),
          totalRemaining: rows.reduce((s, r) => s + r.remainingAmount, 0)
        };

        return { rows, totals };
      })
    );
  }

  // =========================================================================
  // REPORT 03: CUSTOMER STATEMENT (100% READ-ONLY)
  // =========================================================================

  getCustomerStatement(filters: CustomerStatementFilters): Observable<CustomerStatementData | null> {
    if (!filters.clientId) {
      return of(null);
    }

    const supabase = this.supabaseService.getClient();

    return forkJoin({
      clientRes: from(supabase.from('clients').select('*').eq('client_id', filters.clientId).single()),
      loansRes: from(supabase.from('loans').select('*').eq('client_id', filters.clientId).order('start_date', { ascending: false })),
      paymentsRes: from(
        supabase
          .from('payments')
          .select('*, loans!inner(client_id, loan_number)')
          .eq('loans.client_id', filters.clientId)
          .order('paid_date', { ascending: false })
      )
    }).pipe(
      map(({ clientRes, loansRes, paymentsRes }) => {
        if (clientRes.error || !clientRes.data) {
          throw new Error('Customer record not found.');
        }

        const client = clientRes.data as Client;
        const allLoans = (loansRes.data || []) as Loan[];
        const rawPayments = (paymentsRes.data || []) as any[];

        // Map loans
        const loans: CustomerStatementLoanRow[] = allLoans.map(l => ({
          id: l.id,
          loanNumber: l.loan_number,
          startDate: l.start_date || l.created_at?.split('T')[0] || '-',
          endDate: l.end_date || '-',
          loanType: (l.loan_type || 'monthly').toUpperCase(),
          principalAmount: Number(l.principal_amount) || 0,
          interestRate: Number(l.interest_rate) || 0,
          documentCharge: Number(l.document_charge) || 0,
          totalAmountDue: Number(l.total_amount_due) || 0,
          totalPaid: Number(l.total_paid) || 0,
          remainingAmount: Number(l.remaining_amount) || 0,
          status: l.status
        }));

        // Filter and map payments based on date range
        let payments: CustomerStatementPaymentRow[] = rawPayments.map(p => ({
          id: p.id,
          loanId: p.loan_id,
          loanNumber: p.loans?.loan_number || '-',
          paidDate: p.paid_date || p.created_at?.split('T')[0] || '-',
          amount: Number(p.paid_amount) || 0,
          remark: p.remark || 'Repayment'
        }));

        if (filters.dateFrom) {
          payments = payments.filter(p => p.paidDate >= filters.dateFrom!);
        }
        if (filters.dateTo) {
          payments = payments.filter(p => p.paidDate <= filters.dateTo!);
        }

        const totalLoans = loans.length;
        const activeLoans = loans.filter(l => l.status === 'active').length;
        const completedLoans = loans.filter(l => l.status === 'closed').length;
        const totalAmountDue = loans.reduce((s, l) => s + l.totalAmountDue, 0);
        const totalPaid = loans.reduce((s, l) => s + l.totalPaid, 0);
        const totalRemaining = loans.reduce((s, l) => s + l.remainingAmount, 0);

        return {
          client,
          memberId: this.formatMemberId(client.register_number),
          fullName: `${client.first_name || ''} ${client.last_name || ''}`.trim() || 'Unknown',
          nicNumber: client.nic_number || '-',
          mobileNumber: client.mobile_number || client.home_number || '-',
          address: this.formatAddress(client),
          summary: {
            totalLoans,
            activeLoans,
            completedLoans,
            totalAmountDue,
            totalPaid,
            totalRemaining
          },
          loans,
          payments
        };
      })
    );
  }

  // =========================================================================
  // REPORT 04: GUARANTOR REPORT (100% READ-ONLY)
  // =========================================================================

  getGuarantorReport(filters: GuarantorReportFilters = {}): Observable<{
    rows: GuarantorReportRow[];
    summary: GuarantorReportSummary;
  }> {
    const supabase = this.supabaseService.getClient();

    return forkJoin({
      loansRes: from(
        supabase
          .from('loans')
          .select(`
            *,
            client:clients(*)
          `)
          .order('created_at', { ascending: false })
      ),
      allClientsRes: from(supabase.from('clients').select('*')),
      loanGuarantorsRes: from(
        supabase
          .from('loan_guarantors')
          .select('*, guarantor:clients(*)')
      ).pipe(
        catchError(() => of({ data: [], error: null }))
      )
    }).pipe(
      map(({ loansRes, allClientsRes, loanGuarantorsRes }) => {
        if (loansRes.error) throw new Error('Failed to fetch loans for guarantor report: ' + loansRes.error.message);

        const loans = (loansRes.data || []) as any[];
        const clients = (allClientsRes.data || []) as Client[];
        const loanGuarantorRows = (loanGuarantorsRes.data || []) as any[];

        // Index clients by NIC and ID for fast lookup
        const clientByNic = new Map<string, Client>();
        const clientById = new Map<string, Client>();
        for (const c of clients) {
          if (c.nic_number) {
            clientByNic.set(c.nic_number.trim().toLowerCase(), c);
          }
          clientById.set(c.client_id, c);
        }

        // Index loan_guarantors by loan_id
        const guarantorsByLoanId = new Map<string, any[]>();
        for (const lg of loanGuarantorRows) {
          const list = guarantorsByLoanId.get(lg.loan_id) || [];
          list.push(lg);
          guarantorsByLoanId.set(lg.loan_id, list);
        }

        const reportRows: GuarantorReportRow[] = [];

        for (const loan of loans) {
          const borrower = loan.client as Client | undefined;
          const borrowerName = borrower ? `${borrower.first_name || ''} ${borrower.last_name || ''}`.trim() : 'Unknown';
          const borrowerNic = borrower?.nic_number || '-';
          const borrowerMobile = borrower?.mobile_number || borrower?.home_number || '-';
          const loanDate = loan.start_date || loan.created_at?.split('T')[0] || '-';
          const loanAmount = Number(loan.total_amount_due) || Number(loan.principal_amount) || 0;
          const remainingAmount = Number(loan.remaining_amount) || 0;
          const loanStatus = loan.status as 'active' | 'closed';
          const loanType = (loan.loan_type || 'monthly').toUpperCase();

          const lgList = guarantorsByLoanId.get(loan.id) || [];

          if (lgList.length > 0) {
            // Modern Stage 2 loan-level guarantors
            for (const lg of lgList) {
              const gClient = lg.guarantor as Client | undefined;
              const gName = gClient ? `${gClient.first_name || ''} ${gClient.last_name || ''}`.trim() : 'Guarantor';
              const gNic = gClient?.nic_number || '-';
              const gMobile = gClient?.mobile_number || gClient?.home_number || '-';
              const gMemberId = this.formatMemberId(gClient?.register_number);

              reportRows.push({
                guarantorName: gName,
                guarantorNic: gNic,
                guarantorMobile: gMobile,
                guarantorMemberId: gMemberId,
                borrowerName,
                borrowerNic,
                borrowerMobile,
                loanNumber: loan.loan_number,
                loanDate,
                loanType,
                loanAmount,
                remainingAmount,
                loanStatus,
                guarantorOrder: lg.guarantor_order || 1
              });
            }
          } else if (borrower) {
            // Fallback to client-level guarantor fields for loans without loan_guarantors entries
            // Guarantor 1
            if (borrower.first_guarantor_nic && borrower.first_guarantor_nic.trim() !== '-' && borrower.first_guarantor_nic.trim() !== '') {
              const matchedMember = clientByNic.get(borrower.first_guarantor_nic.trim().toLowerCase());
              const gName = matchedMember
                ? `${matchedMember.first_name || ''} ${matchedMember.last_name || ''}`.trim()
                : (borrower.first_guarantor_name || 'Guarantor 1');
              const gMobile = matchedMember
                ? (matchedMember.mobile_number || matchedMember.home_number || '-')
                : (borrower.first_guarantor_tp || '-');
              const gMemberId = this.formatMemberId(matchedMember?.register_number);

              reportRows.push({
                guarantorName: gName,
                guarantorNic: borrower.first_guarantor_nic,
                guarantorMobile: gMobile,
                guarantorMemberId: gMemberId,
                borrowerName,
                borrowerNic,
                borrowerMobile,
                loanNumber: loan.loan_number,
                loanDate,
                loanType,
                loanAmount,
                remainingAmount,
                loanStatus,
                guarantorOrder: 1
              });
            }

            // Guarantor 2
            if (borrower.second_guarantor_nic && borrower.second_guarantor_nic.trim() !== '-' && borrower.second_guarantor_nic.trim() !== '') {
              const matchedMember = clientByNic.get(borrower.second_guarantor_nic.trim().toLowerCase());
              const gName = matchedMember
                ? `${matchedMember.first_name || ''} ${matchedMember.last_name || ''}`.trim()
                : (borrower.second_guarantor_name || 'Guarantor 2');
              const gMobile = matchedMember
                ? (matchedMember.mobile_number || matchedMember.home_number || '-')
                : (borrower.second_guarantor_tp || '-');
              const gMemberId = this.formatMemberId(matchedMember?.register_number);

              reportRows.push({
                guarantorName: gName,
                guarantorNic: borrower.second_guarantor_nic,
                guarantorMobile: gMobile,
                guarantorMemberId: gMemberId,
                borrowerName,
                borrowerNic,
                borrowerMobile,
                loanNumber: loan.loan_number,
                loanDate,
                loanType,
                loanAmount,
                remainingAmount,
                loanStatus,
                guarantorOrder: 2
              });
            }
          }
        }

        // In-memory Filtering
        let filteredRows = [...reportRows];

        if (filters.search && filters.search.trim()) {
          const q = filters.search.trim().toLowerCase();
          filteredRows = filteredRows.filter(r =>
            r.guarantorName.toLowerCase().includes(q) ||
            r.guarantorNic.toLowerCase().includes(q) ||
            r.borrowerName.toLowerCase().includes(q) ||
            r.borrowerNic.toLowerCase().includes(q) ||
            r.loanNumber.toLowerCase().includes(q)
          );
        }

        if (filters.loanStatus && filters.loanStatus !== 'all') {
          filteredRows = filteredRows.filter(r => r.loanStatus === filters.loanStatus);
        }

        if (filters.dateFrom) {
          filteredRows = filteredRows.filter(r => r.loanDate !== '-' && r.loanDate >= filters.dateFrom!);
        }

        if (filters.dateTo) {
          filteredRows = filteredRows.filter(r => r.loanDate !== '-' && r.loanDate <= filters.dateTo!);
        }

        // Summary Calculations
        const uniqueGuarantorNics = new Set(filteredRows.map(r => r.guarantorNic.toLowerCase()));
        const summary: GuarantorReportSummary = {
          totalRelationships: filteredRows.length,
          uniqueGuarantors: uniqueGuarantorNics.size,
          totalGuaranteedBalance: filteredRows.reduce((s, r) => s + r.remainingAmount, 0),
          activeGuarantees: filteredRows.filter(r => r.loanStatus === 'active').length
        };

        return { rows: filteredRows, summary };
      })
    );
  }
}
