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
  isSaving = false;
  editableClient: any = {};
  activeTab: 'guarantors' | 'loans' = 'guarantors';
  
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

  cancelEdit() {
    this.isEditing = false;
    const client = this.clientSubject.value;
    if (client) {
      this.editableClient = { ...client };
    }
  }

  saveEdit() {
    const client = this.clientSubject.value;
    if (!client) {
      console.error('No client data available');
      return;
    }

    // Prepare the update data - only include fields that can be edited
    const updateData: Partial<Client> = {
      mobile_number: this.editableClient.mobile_number,
      home_number: this.editableClient.home_number,
      street_address: this.editableClient.street_address,
      town_one: this.editableClient.town_one,
      town_two: this.editableClient.town_two,
      group: this.editableClient.group,
      first_guarantor_name: this.editableClient.first_guarantor_name,
      first_guarantor_nic: this.editableClient.first_guarantor_nic,
      first_guarantor_tp: this.editableClient.first_guarantor_tp,
      first_guarantor_address: this.editableClient.first_guarantor_address,
      second_guarantor_name: this.editableClient.second_guarantor_name,
      second_guarantor_nic: this.editableClient.second_guarantor_nic,
      second_guarantor_tp: this.editableClient.second_guarantor_tp,
      second_guarantor_address: this.editableClient.second_guarantor_address
    };

    // Set saving state
    this.isSaving = true;

    // Call the service to update the client in the database
    this.loanService.updateClient(client.client_id, updateData).subscribe({
      next: (updatedClient) => {
        console.log('Client updated successfully:', updatedClient);
        this.isEditing = false;
        this.isSaving = false;
        // Update the observable with the new data from the database
        this.clientSubject.next(updatedClient);
      },
      error: (error) => {
        console.error('Error updating client:', error);
        this.isSaving = false;
        alert('Error updating client: ' + error.message);
      }
    });
  }

  setActiveTab(tab: 'guarantors' | 'loans'): void {
    this.activeTab = tab;
  }

  getTotalLoanAmount(loans: Loan[]): number {
    if (!loans || loans.length === 0) return 0;
    return loans.reduce((sum, l) => sum + (l.principal_amount || 0), 0);
  }

  getTotalRemainingDebt(loans: Loan[]): number {
    if (!loans || loans.length === 0) return 0;
    return loans.reduce((sum, l) => sum + (l.remaining_amount || 0), 0);
  }

  getInitials(firstName?: string, lastName?: string): string {
    const f = firstName?.trim() ? firstName.trim()[0] : '';
    const l = lastName?.trim() ? lastName.trim()[0] : '';
    return (f + l).toUpperCase() || 'CU';
  }
}
