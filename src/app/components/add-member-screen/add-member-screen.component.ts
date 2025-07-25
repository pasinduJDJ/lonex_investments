import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SupabaseService } from '../../service/supabase.service';
import { CITY_CODE_MAP } from '../../constants/city.constants';
import { LoanManageService } from '../../service/loan-manage.service';

export const GROUP_CODE_MAP = {
  'Group 1': '001',
  'Group 2': '002',
  'Group 3': '003'
};

@Component({
  selector: 'app-add-member-screen',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './add-member-screen.component.html',
  styleUrl: './add-member-screen.component.css'
})
export class AddMemberScreenComponent implements OnInit {
  // Client Information
  firstName: string = '';
  lastName: string = '';
  nicNumber: string = '';
  mobileNumber: string = '';
  homeNumber: string = '';
  streetAddress: string = '';
  townOne: string = '';
  townTwo: string = '';
  group: string = '';
  isMember: boolean = true;

  // First Guarantor Details
  firstGuarantorName: string = '';
  firstGuarantorNic: string = '';
  firstGuarantorTp: string = '';
  firstGuarantorAddress: string = '';

  // Second Guarantor Details
  secondGuarantorName: string = '';
  secondGuarantorNic: string = '';
  secondGuarantorTp: string = '';
  secondGuarantorAddress: string = '';

  // Form State
  isLoading: boolean = false;
  errorMessage: string = '';
  successMessage: string = '';
  generatedRegisterNumber: number | null = null;

  cityNames = Object.keys(CITY_CODE_MAP);
  groupNames = Object.keys(GROUP_CODE_MAP);

  constructor(
    private supabaseService: SupabaseService,
    private loanManageService: LoanManageService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Initialization logic if any
  }

  onSubmit(): void {
    if (!this.validateForm()) {
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.generatedRegisterNumber = null;

    const clientData = {
      first_name: this.firstName.trim(),
      last_name: this.lastName.trim(),
      nic_number: this.nicNumber.trim(),
      mobile_number: this.mobileNumber.trim() || null,
      home_number: this.homeNumber.trim() || null,
      street_address: this.streetAddress.trim() || null,
      town_one: this.townOne.trim() || null,
      town_two: this.townTwo.trim() || null,
      group: this.group.trim() || null,
      is_member: this.isMember,
      first_guarantor_name: this.firstGuarantorName.trim() || null,
      first_guarantor_nic: this.firstGuarantorNic.trim() || null,
      first_guarantor_tp: this.firstGuarantorTp.trim() || null,
      first_guarantor_address: this.firstGuarantorAddress.trim() || null,
      second_guarantor_name: this.secondGuarantorName.trim() || null,
      second_guarantor_nic: this.secondGuarantorNic.trim() || null,
      second_guarantor_tp: this.secondGuarantorTp.trim() || null,
      second_guarantor_address: this.secondGuarantorAddress.trim() || null
    };

    // Check NIC uniqueness before adding
    this.loanManageService.getClientByNIC(clientData.nic_number).subscribe({
      next: (existingClient) => {
        if (existingClient) {
          this.isLoading = false;
          this.errorMessage = 'A client with this NIC number is already registered.';
          return;
        }
        // If not exists, proceed to add
        this.addClient(clientData);
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = 'Error checking NIC uniqueness: ' + err.message;
      }
    });
  }

  private async addClient(clientData: any): Promise<void> {
    try {
      const supabase = this.supabaseService.getClient();
      
      // Get the next register number by checking current max
      const { data: maxData, error: maxError } = await supabase
        .from('clients')
        .select('register_number')
        .order('register_number', { ascending: false })
        .limit(1);

      if (maxError) {
        this.errorMessage = 'Error checking existing register numbers: ' + maxError.message;
        this.isLoading = false;
        return;
      }

      // Calculate next register number
      let nextRegisterNumber = 1; // Start from 1 for first member
      if (maxData && maxData.length > 0 && maxData[0].register_number) {
        nextRegisterNumber = maxData[0].register_number + 1;
      }

      // Add the register number to client data
      const clientDataWithRegister = {
        ...clientData,
        register_number: nextRegisterNumber
      };

      // Insert the client with the generated register number
      const { data, error } = await supabase
        .from('clients')
        .insert(clientDataWithRegister)
        .select()
        .single();

      if (error) {
        if (error.code === '23505') { // Unique constraint violation
          this.errorMessage = 'A client already registered';
        } else {
          this.errorMessage = 'Error adding client: ' + error.message;
        }
        this.isLoading = false;
        return;
      }

      // Store the generated register number
      this.generatedRegisterNumber = data.register_number;

      // Format the register number with leading zeros
      const formattedRegisterNumber = this.formatRegisterNumber(data.register_number);

      this.successMessage = `Client ${clientData.first_name} ${clientData.last_name} added successfully! Member ID: ${formattedRegisterNumber}`;
      this.resetForm();
      
      // Redirect to home after 3 seconds to show the success message
      setTimeout(() => {
        this.router.navigate(['/home']);
      }, 3000);

    } catch (error: any) {
      this.errorMessage = 'Error adding client: ' + error.message;
    } finally {
      this.isLoading = false;
    }
  }

  // Format register number with leading zeros (e.g., 000001, 000002)
  private formatRegisterNumber(registerNumber: number): string {
    return registerNumber.toString().padStart(6, '0');
  }

  validateForm(): boolean {
    // Required fields validation
    if (!this.firstName.trim()) {
      this.errorMessage = 'First name is required';
      return false;
    }
    if (!this.lastName.trim()) {
      this.errorMessage = 'Last name is required';
      return false;
    }
    if (!this.nicNumber.trim()) {
      this.errorMessage = 'NIC number is required';
      return false;
    }

    // NIC number format validation (Sri Lankan NIC)
    const nicRegex = /^\d{9}[vVxX]$|^\d{12}$/;
    if (!nicRegex.test(this.nicNumber.trim())) {
      this.errorMessage = 'Please enter a valid NIC number (9 digits + V/X or 12 digits)';
      return false;
    }

    // Mobile number validation (optional but if provided, should be valid)
    if (this.mobileNumber.trim() && !/^\d{10}$/.test(this.mobileNumber.trim())) {
      this.errorMessage = 'Please enter a valid 10-digit mobile number';
      return false;
    }

    // Home number validation (optional but if provided, should be valid)
    if (!this.homeNumber.trim()) {
      this.errorMessage = 'Home number is required';
      return false;
    }

    // First guarantor validation (at least name and NIC if provided)
    if (this.firstGuarantorName.trim() && !this.firstGuarantorNic.trim()) {
      this.errorMessage = 'First guarantor NIC is required if name is provided';
      return false;
    }
    if (this.firstGuarantorNic.trim() && !this.firstGuarantorName.trim()) {
      this.errorMessage = 'First guarantor name is required if NIC is provided';
      return false;
    }

    // Second guarantor validation (at least name and NIC if provided)
    if (this.secondGuarantorName.trim() && !this.secondGuarantorNic.trim()) {
      this.errorMessage = 'Second guarantor NIC is required if name is provided';
      return false;
    }
    if (this.secondGuarantorNic.trim() && !this.secondGuarantorName.trim()) {
      this.errorMessage = 'Second guarantor name is required if NIC is provided';
      return false;
    }

    return true;
  }

  resetForm(): void {
    // Client Information
    this.firstName = '';
    this.lastName = '';
    this.nicNumber = '';
    this.mobileNumber = '';
    this.homeNumber = '';
    this.streetAddress = '';
    this.townOne = '';
    this.townTwo = '';
    this.group = '';
    this.isMember = true;

    // First Guarantor Details
    this.firstGuarantorName = '';
    this.firstGuarantorNic = '';
    this.firstGuarantorTp = '';
    this.firstGuarantorAddress = '';

    // Second Guarantor Details
    this.secondGuarantorName = '';
    this.secondGuarantorNic = '';
    this.secondGuarantorTp = '';
    this.secondGuarantorAddress = '';

    this.errorMessage = '';
    this.generatedRegisterNumber = null;
  }

  onClear(): void {
    this.resetForm();
  }

  generateLoanNumber(): void {
    // This method is kept for future use if needed
    console.log('Generate loan number functionality can be implemented here');
  }
}
