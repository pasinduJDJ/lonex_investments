import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { LoanManageService, LoanWithClient } from '../../service/loan-manage.service';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged, switchMap, startWith, map } from 'rxjs/operators';
import { Observable, of } from 'rxjs';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-loan-manage-screen',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './loan-manage-screen.component.html',
  styleUrl: './loan-manage-screen.component.css'
})
export class LoanManageScreenComponent implements OnInit {
  searchControl = new FormControl('');
  loans$: Observable<LoanWithClient[]> = of([]);
  allLoans: LoanWithClient[] = [];

  constructor(private router: Router, private loanService: LoanManageService) {}

  ngOnInit() {
    // Fetch all loans initially
    this.loanService.getAllLoans().subscribe(loans => {
      this.allLoans = loans;
      // Set initial value for loans$ to show all loans on first load
      this.loans$ = this.searchControl.valueChanges.pipe(
        startWith(''),
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((value) => {
          const input = value?.toString().trim();
          if (!input) {
            // If input is empty, show all loans
            return of(this.allLoans);
          }
          // If input is a string, search by loan_number
          return this.loanService.getLoanByNumber(input).pipe(
            map(loan => loan ? [loan] : [])
          );
        })
      );
    });
  }

  navigateToAddLoan(){
    this.router.navigate(['add-loan']);
  }

  viewLoan(loan_number: string) {
    this.router.navigate(['/single-loan/', loan_number]);
  }
}
