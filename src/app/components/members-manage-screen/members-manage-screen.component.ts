import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { LoanManageService, Client } from '../../service/loan-manage.service';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged, startWith, map } from 'rxjs/operators';
import { Observable, of } from 'rxjs';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-members-manage-screen',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './members-manage-screen.component.html',
  styleUrl: './members-manage-screen.component.css'
})
export class MembersManageScreenComponent implements OnInit {
  searchControl = new FormControl('');
  members$: Observable<Client[]> = of([]);
  allMembers: Client[] = [];

  constructor(private router: Router, private loanService: LoanManageService) {}

  ngOnInit() {
    this.loanService.getAllClients().subscribe(members => {
      this.allMembers = members;
      this.members$ = this.searchControl.valueChanges.pipe(
        startWith(''),
        debounceTime(300),
        distinctUntilChanged(),
        map((value) => {
          const input = value?.toString().trim().toLowerCase();
          if (!input) {
            return this.allMembers;
          }
          return this.allMembers.filter(member =>
            (member.first_name && member.first_name.toLowerCase().includes(input)) ||
            (member.last_name && member.last_name.toLowerCase().includes(input)) ||
            (member.register_number && member.register_number.toString().includes(input)) ||
            (member.nic_number && member.nic_number.toLowerCase().includes(input)) ||
            (member.town_one && member.town_one.toLowerCase().includes(input)) ||
            (member.town_two && member.town_two.toLowerCase().includes(input))
          );
        })
      );
    });
  }

  navigateToAddMember() {
    this.router.navigate(['/add-member']);
  }

  viewMember(register_number: number) {
    this.router.navigate(['/single-member/', register_number]);
  }
}
