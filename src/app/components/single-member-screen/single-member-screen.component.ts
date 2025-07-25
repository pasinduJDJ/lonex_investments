import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { LoanManageService, Client, Loan } from '../../service/loan-manage.service';
import { CommonModule } from '@angular/common';
import { Observable, of, BehaviorSubject } from 'rxjs';
import { map } from 'rxjs/operators';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-single-member-screen',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './single-member-screen.component.html',
  styleUrl: './single-member-screen.component.css'
})
export class SingleMemberScreenComponent implements OnInit {
  client$: Observable<Client | undefined> = of(undefined);
  loans$: Observable<Loan[]> = of([]);
  isEditing = false;
  editableClient: any = {};
  private clientSubject = new BehaviorSubject<Client | undefined>(undefined);

  constructor(private route: ActivatedRoute, private loanService: LoanManageService) {}

  ngOnInit() {
    const register_number = Number(this.route.snapshot.paramMap.get('register_number'));
    this.loanService.getAllClients().pipe(
      map(clients => clients.find(c => c.register_number === register_number))
    ).subscribe(client => {
      this.clientSubject.next(client);
      if (client) {
        this.loans$ = this.loanService.getClientProfile(client.client_id).pipe(
          map(profile => profile.loans)
        );
      }
    });
    this.client$ = this.clientSubject.asObservable();
  }

  enableEdit() {
    this.isEditing = true;
    const client = this.clientSubject.value;
    if (client) {
      this.editableClient = { ...client };
    }
  }

  saveEdit() {
    // In a real app, call a service to save changes to the backend here
    this.isEditing = false;
    // Update the observable locally for now
    this.clientSubject.next({ ...this.clientSubject.value, ...this.editableClient });
  }

  getPaidInstallments(loan: Loan): number | string {
    if (!loan.installments || !loan.total_paid || !loan.total_amount_due) return 'N/A';
    const perInstallment = loan.total_amount_due / loan.installments;
    return Math.floor(loan.total_paid / perInstallment);
  }

  getRemainingInstallments(loan: Loan): number | string {
    if (!loan.installments || !loan.total_paid || !loan.total_amount_due) return 'N/A';
    const paid = this.getPaidInstallments(loan);
    if (typeof paid === 'string') return 'N/A';
    return loan.installments - paid;
  }
}
