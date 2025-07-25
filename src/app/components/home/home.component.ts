import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { LoanManageService, Client, LoanWithClient, Payment } from '../../service/loan-manage.service';
import { ReportManageService } from '../../service/report-manage.service';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent implements OnInit {
  activeMembers: Client[] = [];
  latestPayments: Array<{ loanId: string; amount: number; date: string; type: string; paid: number; pending: number; }> = [];
  delayedPayments: Array<any> = [];
  activeLoans: LoanWithClient[] = [];

  constructor(
    private router: Router,
    private loanService: LoanManageService,
    private reportService: ReportManageService
  ) {}

  ngOnInit() {
    this.loanService.getAllClients().subscribe(members => {
      this.activeMembers = members.filter(m => m.is_member);
    });
    this.loanService.getAllLoans().subscribe(loans => {
      this.activeLoans = loans.filter(l => l.status === 'active');
      this.loanService.getPaymentsByDateRange('1900-01-01', '2100-01-01').subscribe(payments => {
        // Latest payments: sort by paid_date desc, take top 10
        const sorted = [...payments].sort((a, b) => b.paid_date.localeCompare(a.paid_date)).slice(0, 10);
        this.latestPayments = sorted.map(p => {
          const loan = loans.find(l => l.id === p.loan_id);
          return {
            loanId: loan?.loan_number || '',
            amount: loan?.principal_amount || 0,
            date: p.paid_date,
            type: loan?.loan_type || '',
            paid: p.paid_amount,
            pending: loan ? loan.remaining_amount : 0
          };
        });
      });
    });
    this.reportService.getDelayedPayments().subscribe(data => {
      this.delayedPayments = data.filter(d => d.delayCount > 0);
    });
  }

  navigateToAddMember() {
    this.router.navigate(['/add-member']);
  }
  navigateToAddLoan(){
    this.router.navigate(['add-loan']);
  }
  navigateToAddPayment(){
    this.router.navigate(['add-payments']);
  }
}
