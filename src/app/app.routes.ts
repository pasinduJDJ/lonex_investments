import { Routes } from '@angular/router';
import { HomeComponent } from './components/home/home.component';
import { MembersManageScreenComponent } from './components/members-manage-screen/members-manage-screen.component';
import { LoanManageScreenComponent } from './components/loan-manage-screen/loan-manage-screen.component';
import { ProfitsManageScreenComponent } from './components/profits-manage-screen/profits-manage-screen.component';
import { ProfileManageScreenComponent } from './components/profile-manage-screen/profile-manage-screen.component';
import { AddMemberScreenComponent } from './components/add-member-screen/add-member-screen.component';
import { AddLoanScreenComponent } from './components/add-loan-screen/add-loan-screen.component';
import { SingleMemberScreenComponent } from './components/single-member-screen/single-member-screen.component';
import { SingleLoanScreenComponent } from './components/single-loan-screen/single-loan-screen.component';
import { AddPaymentsComponent } from './components/add-payments/add-payments.component';
import { LoginComponent } from './components/login/login.component';
import { AuthGuard } from './service/auth.guard';

export const routes: Routes = [
    { path: '', redirectTo: 'login', pathMatch: 'full' },
    { path: 'login', component: LoginComponent },
    { path: 'home', component: HomeComponent, canActivate: [AuthGuard] },
    { path: 'member', component: MembersManageScreenComponent, canActivate: [AuthGuard] },
    { path: 'loan', component: LoanManageScreenComponent, canActivate: [AuthGuard] },
    { path: 'profit', component: ProfitsManageScreenComponent, canActivate: [AuthGuard] },
    { path: 'profile', component: ProfileManageScreenComponent, canActivate: [AuthGuard] },
    { path: 'add-member', component: AddMemberScreenComponent, canActivate: [AuthGuard] },
    { path: 'add-loan', component: AddLoanScreenComponent, canActivate: [AuthGuard] },
    { path: 'single-member/:register_number', component: SingleMemberScreenComponent, canActivate: [AuthGuard] },
    { path: 'single-loan/:loan_number', component: SingleLoanScreenComponent, canActivate: [AuthGuard] },
    { path: 'add-payments', component: AddPaymentsComponent, canActivate: [AuthGuard] },
];
