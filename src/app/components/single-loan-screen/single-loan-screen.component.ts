import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { LoanManageService, LoanWithClient } from '../../service/loan-manage.service';
import { CommonModule } from '@angular/common';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { Router } from '@angular/router';
import { SupabaseService } from '../../service/supabase.service';


@Component({
  selector: 'app-single-loan-screen',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './single-loan-screen.component.html',
  styleUrl: './single-loan-screen.component.css'
})
export class SingleLoanScreenComponent implements OnInit {
  loan$: Observable<LoanWithClient | undefined> = of(undefined);
  showCompleteConfirm = false;
  showSuccessMsg = false;
  installmentStats: {
    expected: number;
    paid: number;
    remaining: number;
    totalPaid: number;
    installmentAmount: number;
  } | null = null;

  constructor(
    private route: ActivatedRoute,
    private loanService: LoanManageService,
    private router: Router,
    private supabaseService: SupabaseService
  ) {}

  ngOnInit() {
    const loan_number = this.route.snapshot.paramMap.get('loan_number')!;
    this.loan$ = this.loanService.getLoanByNumber(loan_number).pipe(
      map((loan) => loan ? loan : undefined)
    );
    this.loan$.subscribe(async (loan) => {
      if (loan) {
        this.installmentStats = await this.loanService.getInstallmentStats(loan);
      } else {
        this.installmentStats = null;
      }
    });
  }

  completeLoan(loan: LoanWithClient) {
    this.loanService.updateLoanStatus(loan.id, 'closed').subscribe(() => {
      this.showCompleteConfirm = false;
      this.showSuccessMsg = true;
    });
  }

  async getPrint(loan: LoanWithClient, installmentStats: any) {
    // Dynamically import pdfMake and fonts
    const pdfMakeModule = await import('pdfmake/build/pdfmake');
    const pdfFonts = await import('pdfmake/build/vfs_fonts');
    (pdfMakeModule as any).vfs = (pdfFonts as any).pdfMake.vfs;

    const docDefinition = {
      content: [
        { text: `Loan Details (${loan.loan_reg_number})`, style: 'header' },
        { text: '\n' },
        { text: `Client Name: ${loan.client.first_name} ${loan.client.last_name}` },
        {
          text: `Client Address: ${loan.client.home_number || ''} ${loan.client.street_address || ''} ${loan.client.town_one || ''} ${loan.client.town_two || ''} ${loan.client.group ? '| ' + loan.client.group : ''}`
        },
        { text: `Loan Register Number: ${loan.loan_reg_number}` },
        { text: `Loan Type: ${loan.loan_type}` },
        { text: `Status: ${loan.status}` },
        { text: `Loan Amount: ${loan.principal_amount}` },
        { text: `Document Charges: ${loan.document_charge}` },
        { text: `Interest Rate: ${loan.interest_rate}%` },
        { text: `Total Due: ${loan.total_amount_due}` },
        { text: `Per Installment Amount: ${installmentStats.installmentAmount}` },
        { text: `Total Paid: ${loan.total_paid}` },
        { text: `Remaining Amount: ${loan.remaining_amount}` },
        { text: '\n' },
        { text: 'Installment Stats', style: 'subheader' },
        {
          table: {
            widths: ['*', '*', '*', '*'],
            body: [
              ['Expected', 'Paid', 'Remaining', 'Total Paid'],
              [
                installmentStats.expected,
                installmentStats.paid,
                installmentStats.remaining,
                installmentStats.totalPaid
              ]
            ]
          }
        },
        { text: '\n' },
        { text: `Start Date: ${loan.start_date}` },
        { text: `End Date: ${loan.end_date}` },
        { text: `Created Date: ${loan.created_at}` }
      ],
      styles: {
        header: {
          fontSize: 18,
          bold: true,
          color: '#1976d2'
        },
        subheader: {
          fontSize: 14,
          bold: true,
          margin: [0, 10, 0, 4] as [number, number, number, number]
        }
      }
    };

    (pdfMakeModule as any).createPdf(docDefinition).download(`LoanDetails_${loan.loan_reg_number}.pdf`);
  }

  async getDocx(loan: LoanWithClient, installmentStats: any) {
    const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle, ShadingType, ImageRun } = await import('docx');

    // Helper for bold label
    const label = (text: string) => new TextRun({ text, bold: true, font: 'Arial', size: 22 });
    const value = (text: string) => new TextRun({ text, font: 'Arial', size: 22 });
    const sectionHeader = (text: string) => new Paragraph({
      children: [new TextRun({ text, bold: true, font: 'Arial', size: 24 })],
      spacing: { after: 120 },
    });

    // Try to load logo image from assets (browser fetch as base64)
    let logoImage: InstanceType<typeof ImageRun> | undefined = undefined;
    try {
      const response = await fetch('assets/logo.png');
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      logoImage = new (ImageRun as any)({
        data: arrayBuffer,
        transformation: { width: 48, height: 48 },
      });
    } catch (e) {
      // If logo not found, skip
    }

    // Header row with logo - title - logo
    const headerRow = new TableRow({
      children: [
        new TableCell({
          children: [logoImage ? new Paragraph({ children: [logoImage], alignment: AlignmentType.CENTER }) : new Paragraph('')],
          verticalAlign: 'center',
          borders: { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } },
        }),
        new TableCell({
          children: [
            new Paragraph({
              children: [new TextRun({ text: 'Lonex Investments', bold: true, size: 48, font: 'Arial', color: '#003566' })],
              alignment: AlignmentType.CENTER,
            }),
          ],
          verticalAlign: 'center',
          borders: { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } },
        }),
        new TableCell({
          children: [logoImage ? new Paragraph({ children: [logoImage], alignment: AlignmentType.CENTER }) : new Paragraph('')],
          verticalAlign: 'center',
          borders: { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } },
        }),
      ],
      height: { value: 100, rule: 'atLeast' },
    });

    // Main details table rows (with merged cells and section headers)
    const detailsRows = [
      // Section: Loan Details
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: 'Loan Details', bold: true, size: 24, font: 'Arial' })] })],
            columnSpan: 4,
            shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'EDEDED' },
            borders: { top: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, left: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, right: { style: BorderStyle.SINGLE, size: 1, color: '000000' } },
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph('Client Name')], borders: { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } } }),
          new TableCell({ children: [new Paragraph(loan.client.first_name + ' ' + loan.client.last_name)], borders: { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } }, columnSpan: 3 }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph('CLient Address')], borders: { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } } }),
          new TableCell({ children: [new Paragraph(`${loan.client.home_number || ''} ${loan.client.street_address || ''} ${loan.client.town_one || ''} ${loan.client.town_two || ''}${loan.client.group ? ' | ' + loan.client.group : ''}`)], borders: { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } }, columnSpan: 3 }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph('Loan Number')], borders: { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } } }),
          new TableCell({ children: [new Paragraph((loan.loan_reg_number || '').toString())], borders: { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } }, columnSpan: 3 }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph('Loan Type')], borders: { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } } }),
          new TableCell({ children: [new Paragraph((loan.loan_type || '').toString())], borders: { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } } }),
          new TableCell({ children: [new Paragraph('Loan Status')], borders: { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } } }),
          new TableCell({ children: [new Paragraph((loan.status || '').toString())], borders: { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } } }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph('Loan Amount')], borders: { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } } }),
          new TableCell({ children: [new Paragraph((loan.principal_amount !== undefined ? loan.principal_amount : '').toString())], borders: { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } } }),
          new TableCell({ children: [new Paragraph('Loan Rate')], borders: { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } } }),
          new TableCell({ children: [new Paragraph((loan.interest_rate !== undefined ? loan.interest_rate : '').toString())], borders: { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } } }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph('Document Charges')], borders: { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } } }),
          new TableCell({ children: [new Paragraph((loan.document_charge !== undefined ? loan.document_charge : '').toString())], borders: { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } }, columnSpan: 3 }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph('Due Amount')], borders: { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } } }),
          new TableCell({ children: [new Paragraph((loan.total_amount_due !== undefined ? loan.total_amount_due : '').toString())], borders: { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } }, columnSpan: 3 }),
        ],
      }),
      // Section: Installment Details
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: 'Installment Details', bold: true, size: 24, font: 'Arial' })] })],
            columnSpan: 4,
            shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'EDEDED' },
            borders: { top: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, left: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, right: { style: BorderStyle.SINGLE, size: 1, color: '000000' } },
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph('Per Installment Amount')], borders: { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } } }),
          new TableCell({ children: [new Paragraph((installmentStats.installmentAmount !== undefined ? installmentStats.installmentAmount : '').toString())], borders: { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } } }),
          new TableCell({ children: [new Paragraph('')], borders: { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } }, columnSpan: 2 }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph('Paid Amount')], borders: { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } } }),
          new TableCell({ children: [new Paragraph((loan.total_paid !== undefined ? loan.total_paid : '').toString())], borders: { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } } }),
          new TableCell({ children: [new Paragraph('Paid Installments')], borders: { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } } }),
          new TableCell({ children: [new Paragraph((installmentStats.paid !== undefined ? installmentStats.paid : '').toString())], borders: { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } } }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph('Remaining Amount')], borders: { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } } }),
          new TableCell({ children: [new Paragraph((loan.remaining_amount !== undefined ? loan.remaining_amount : '').toString())], borders: { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } } }),
          new TableCell({ children: [new Paragraph('Remaining installments')], borders: { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } } }),
          new TableCell({ children: [new Paragraph((installmentStats.remaining !== undefined ? installmentStats.remaining : '').toString())], borders: { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } } }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph('Loan Issue Date')], borders: { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } } }),
          new TableCell({ children: [new Paragraph((loan.start_date !== undefined ? loan.start_date : '').toString())], borders: { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } } }),
          new TableCell({ children: [new Paragraph('')], borders: { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } }, columnSpan: 2 }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph('Loan Settlement Date')], borders: { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } } }),
          new TableCell({ children: [new Paragraph((loan.end_date !== undefined ? loan.end_date : '').toString())], borders: { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } } }),
          new TableCell({ children: [new Paragraph('')], borders: { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } }, columnSpan: 2 }),
        ],
      }),
    ];

    // Compose document
    const doc = new Document({
      sections: [
        {
          children: [
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [headerRow],
              borders: { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, insideVertical: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } },
            }),
            new Paragraph({ text: ' ' }),
            new Table({
              width: { size: 80, type: WidthType.PERCENTAGE },
              rows: detailsRows,
              alignment: AlignmentType.CENTER,
              borders: { top: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, left: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, right: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, insideVertical: { style: BorderStyle.SINGLE, size: 1, color: '000000' } },
            }),
          ],
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `LoanDetails_${loan.loan_reg_number}.docx`;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  async deleteLoan(loan_reg_number: number) {
    if (!confirm('Are you sure you want to delete this loan Record?')) return;
    this.loanService.deleteLoanByRegNumber(loan_reg_number).subscribe({
      next: () => {
        this.router.navigate(['/loan-manage']);
      },
      error: () => {
        alert('Failed to delete loan.');
      }
    });
  }
}