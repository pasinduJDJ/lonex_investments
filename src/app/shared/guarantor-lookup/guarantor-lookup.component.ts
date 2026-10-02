import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Client, LoanManageService } from '../../service/loan-manage.service';

@Component({
  selector: 'app-guarantor-lookup',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './guarantor-lookup.component.html',
  styleUrl: './guarantor-lookup.component.css'
})
export class GuarantorLookupComponent {
  @Input() guarantorOrder: number = 1;
  @Input() title: string = '';
  @Input() borrowerId: string | null = null;
  @Input() otherGuarantorId: string | null = null;
  @Input() selectedGuarantor: Client | null = null;

  @Output() guarantorSelected = new EventEmitter<Client | null>();

  nicInput: string = '';
  isSearching: boolean = false;
  errorMessage: string = '';
  isUnregistered: boolean = false;
  searchedNic: string = '';

  constructor(private loanService: LoanManageService) {}

  get displayTitle(): string {
    return this.title || `Guarantor ${this.guarantorOrder}`;
  }

  get initials(): string {
    if (!this.selectedGuarantor) return 'G' + this.guarantorOrder;
    const f = (this.selectedGuarantor.first_name || '').trim()[0] || '';
    const l = (this.selectedGuarantor.last_name || '').trim()[0] || '';
    return (f + l).toUpperCase() || 'G' + this.guarantorOrder;
  }

  formatMemberId(regNumber?: number): string {
    if (regNumber === undefined || regNumber === null) return '#0000';
    return `#${regNumber.toString().padStart(4, '0')}`;
  }

  onSearch(): void {
    const cleanNic = (this.nicInput || '').trim();
    this.errorMessage = '';
    this.isUnregistered = false;
    this.searchedNic = cleanNic;

    if (!cleanNic) {
      this.errorMessage = 'Please enter a Guarantor NIC number.';
      return;
    }

    // Sri Lankan NIC Format Validation (9 digits + V/X/v/x or 12 digits)
    const nicRegex = /^\d{9}[vVxX]$|^\d{12}$/;
    if (!nicRegex.test(cleanNic)) {
      this.errorMessage = 'Invalid NIC format. Must be 9 digits with V/X (e.g. 901234567V) or 12 digits.';
      return;
    }

    this.isSearching = true;

    this.loanService.searchRegisteredMemberByNic(cleanNic).subscribe({
      next: (member: Client | null) => {
        this.isSearching = false;

        if (!member) {
          this.isUnregistered = true;
          this.errorMessage = 'No registered member found for this NIC.';
          this.selectedGuarantor = null;
          this.guarantorSelected.emit(null);
          return;
        }

        // Validation B: Borrower cannot guarantee their own loan
        if (this.borrowerId && member.client_id === this.borrowerId) {
          this.errorMessage = 'The borrower cannot be selected as their own guarantor.';
          this.selectedGuarantor = null;
          this.guarantorSelected.emit(null);
          return;
        }

        // Validation C: Duplicate guarantor
        if (this.otherGuarantorId && member.client_id === this.otherGuarantorId) {
          this.errorMessage = 'This member has already been selected as a guarantor.';
          this.selectedGuarantor = null;
          this.guarantorSelected.emit(null);
          return;
        }

        // Successfully found and validated
        this.selectedGuarantor = member;
        this.errorMessage = '';
        this.isUnregistered = false;
        this.guarantorSelected.emit(member);
      },
      error: (err: any) => {
        this.isSearching = false;
        console.error('Error looking up guarantor:', err);
        this.errorMessage = 'A network or server error occurred during lookup. Please try again.';
      }
    });
  }

  onClear(): void {
    this.selectedGuarantor = null;
    this.nicInput = '';
    this.errorMessage = '';
    this.isUnregistered = false;
    this.searchedNic = '';
    this.guarantorSelected.emit(null);
  }
}
