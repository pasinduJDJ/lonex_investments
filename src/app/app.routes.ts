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
import { AnalysisComponent } from './components/analysis/analysis.component';
import { FinanceTransactionsComponent } from './components/finance-transactions/finance-transactions.component';
import { FinanceAccountsComponent } from './components/finance-accounts/finance-accounts.component';
import { LoginComponent } from './components/login/login.component';
import { CustomerReportsComponent } from './components/customer-reports/customer-reports.component';
import { LoanReportsComponent } from './components/loan-reports/loan-reports.component';
import { PaymentReportsComponent } from './components/payment-reports/payment-reports.component';
import { FinanceReportsComponent } from './components/finance-reports/finance-reports.component';
import { AuthGuard } from './service/auth.guard';

export const routes: Routes = [
    { path: '', redirectTo: 'login', pathMatch: 'full' },
    { path: 'login', component: LoginComponent },
    { path: 'home', component: HomeComponent, canActivate: [AuthGuard] },
    { path: 'member', component: MembersManageScreenComponent, canActivate: [AuthGuard] },
    { path: 'member/reports', redirectTo: 'member/reports/customer-master', pathMatch: 'full' },
    { path: 'member/reports/:type', component: CustomerReportsComponent, canActivate: [AuthGuard] },
    { path: 'loan', component: LoanManageScreenComponent, canActivate: [AuthGuard] },
    { path: 'loan/reports', redirectTo: 'loan/reports/loan-history', pathMatch: 'full' },
    { path: 'loan/reports/:type', component: LoanReportsComponent, canActivate: [AuthGuard] },
    { path: 'profit', component: ProfitsManageScreenComponent, canActivate: [AuthGuard] },
    { path: 'transactions', component: FinanceTransactionsComponent, canActivate: [AuthGuard] },
    { path: 'accounts', component: FinanceAccountsComponent, canActivate: [AuthGuard] },
    { path: 'finance/reports', redirectTo: 'finance/reports/account-history', pathMatch: 'full' },
    { path: 'finance/reports/:type', component: FinanceReportsComponent, canActivate: [AuthGuard] },
    { path: 'profit/reports', redirectTo: 'finance/reports/account-history', pathMatch: 'full' },
    { path: 'profit/reports/:type', redirectTo: 'finance/reports/:type', pathMatch: 'full' },
    { path: 'analysis', component: AnalysisComponent, canActivate: [AuthGuard] },
    { path: 'analysis/operational', component: AnalysisComponent, canActivate: [AuthGuard] },
    { path: 'analysis/reports', redirectTo: 'analysis/reports/payment-history', pathMatch: 'full' },
    { path: 'analysis/reports/:type', component: PaymentReportsComponent, canActivate: [AuthGuard] },
    { path: 'profile', component: ProfileManageScreenComponent, canActivate: [AuthGuard] },
    { path: 'add-member', component: AddMemberScreenComponent, canActivate: [AuthGuard] },
    { path: 'add-loan', component: AddLoanScreenComponent, canActivate: [AuthGuard] },
    { path: 'single-member/:register_number', component: SingleMemberScreenComponent, canActivate: [AuthGuard] },
    { path: 'single-loan/:loan_number', component: SingleLoanScreenComponent, canActivate: [AuthGuard] },
    { path: 'add-payments', component: AddPaymentsComponent, canActivate: [AuthGuard] },
];
