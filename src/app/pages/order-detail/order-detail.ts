import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner';
import { Order, Transaction } from '../../core/models/order';
import { Address } from '../../core/models/address';
import { User } from '../../core/models/user';
// Dynamic import for pdfmake to avoid build issues
let pdfMakeInstance: any = null;

const loadPdfMake = async () => {
  if (!pdfMakeInstance) {
    const pdfMakeModule = await import('pdfmake/build/pdfmake');
    const pdfFontsModule = await import('pdfmake/build/vfs_fonts');
    pdfMakeInstance = pdfMakeModule.default;
    pdfMakeInstance.vfs = pdfFontsModule.default.vfs;
  }
  return pdfMakeInstance;
};

@Component({
  selector: 'app-order-detail',
  standalone: true,
  imports: [CommonModule, LoadingSpinnerComponent],
  templateUrl: './order-detail.html',
  styleUrl: './order-detail.scss'
})
export class OrderDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly api = inject(ApiService);

  protected readonly order = signal<Order | null>(null);
  protected readonly address = signal<Address | null>(null);
  protected readonly transactions = signal<Transaction[]>([]);
  protected readonly user = signal<User | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly isGeneratingPdf = signal(false);

  // Computed signals for transaction segregation
  protected readonly successTransactions = computed(() =>
    this.transactions().filter(t => t.status === 'success')
  );

  protected readonly refundTransactions = computed(() =>
    this.transactions().filter(t => t.status === 'refunded')
  );

  protected readonly totalRefunded = computed(() =>
    this.refundTransactions().reduce((sum, t) => sum + t.amount, 0)
  );

  protected readonly netPaid = computed(() => {
    const order = this.order();
    return order ? order.total - this.totalRefunded() : 0;
  });

  protected readonly totalPaid = computed(() =>
    this.successTransactions().reduce((sum, t) => sum + t.amount, 0)
  );

  constructor() {
    const orderId = this.route.snapshot.paramMap.get('id');
    if (!orderId) {
      this.error.set('Order ID not found');
      return;
    }

    this.loadOrderDetails(orderId);
  }

  private loadOrderDetails(orderId: string) {
    // Fetch order
    this.api.getOrdersByOrderId(orderId).subscribe({
      next: (orders) => {
        if (orders && orders.length > 0) {
          const order = orders[0];
          this.order.set(order);

          // Fetch user details
          this.api.getUsers().subscribe({
            next: (users) => {
              const user = users.find(u => u.id === order.createdBy);
              if (user) {
                let customer = { ...user, name : order.name || '', email : order.email }
                this.user.set(customer);
              }
            },
            error: () => {} // Optional, user details not critical
          });

          // Fetch address
          this.api.getAddresses(order.createdBy).subscribe({
            next: (addresses) => {
              const address = addresses.find(a => a.id === order.address_id);
              if (address) {
                this.address.set(address);
              }
            },
            error: () => {} // Optional
          });

          // Fetch transactions for this order
           this.api.getTransactions().subscribe({
             next: (allTransactions) => {
               const orderTransactions = allTransactions.filter(t => t.orderId === order.id);
               this.transactions.set(orderTransactions);
             },
             error: () => {} // Optional
           });
        } else {
          this.error.set('Order not found');
        }
      },
      error: (err) => {
        this.error.set('Failed to load order details');
        console.error('Error loading order:', err);
      }
    });
  }

  protected goBack() {
    // Use browser's back navigation to respect user's browsing history
    this.location.back();
  }
  protected open_product_detail(product_id : number | string) {
    this.router.navigate(['/product/' + product_id]);
  }
  protected give_rating(order : any, item : any, star : number) {
    item.rating = star;
    this.api.give_rating_to_ordered_product(order.id, order).subscribe({
      next : () => {}/*this.loadOrderDetails()*/,
      error : () => {}
    });
  }

  protected getTotalDiscount(order: Order): number {
    return order.items.reduce((sum, item) => sum + (item.discountAmount || 0) * item.quantity, 0);
  }

  protected hasDiscount(order: Order): boolean {
    return order.items.some(item => item.discountAmount && item.discountAmount > 0);
  }

  protected getTransactionIcon(method: string): string {
    const icons: { [key: string]: string } = {
      'card': 'fa-credit-card',
      'upi': 'fa-mobile-alt',
      'netbanking': 'fa-university',
      'wallet': 'fa-wallet'
    };
    return icons[method] || 'fa-credit-card';
  }

  protected async downloadInvoice(): Promise<void> {
    const order = this.order();
    const user = this.user();
    const address = this.address();
    const transactions = this.transactions();

    if (!order || !user) {
      alert('Order or user data not available');
      return;
    }

    this.isGeneratingPdf.set(true);

    try {
      // Load pdfmake dynamically
      const pdfMake = await loadPdfMake();

      const docDefinition: any = {
        content: [
          // Header
          {
            text: 'INVOICE',
            style: 'header',
            alignment: 'center',
            margin: [0, 0, 0, 20]
          },

          // Order Info
          {
            columns: [
              {
                text: `Order ID: ${order.id}`,
                style: 'subheader'
              },
              {
                text: `Date: ${new Date(order.createdAt).toLocaleDateString()}`,
                style: 'subheader',
                alignment: 'right'
              }
            ],
            margin: [0, 0, 0, 10]
          },

          // Customer Details
          {
            text: 'Customer Details',
            style: 'sectionHeader',
            margin: [0, 10, 0, 5]
          },
          {
            text: `Name: ${order.name || user.name}`,
            margin: [0, 0, 0, 2]
          },
          {
            text: `Email: ${order.email || user.email}`,
            margin: [0, 0, 0, 2]
          },
          {
            text: `Mobile: ${user.mobile_number || 'N/A'}`,
            margin: [0, 0, 0, 10]
          },

          // Shipping Address
          ...(address ? [
            {
              text: 'Shipping Address',
              style: 'sectionHeader',
              margin: [0, 10, 0, 5]
            },
            {
              text: `${address.name}\n${address.street}\n${address.city}, ${address.state} ${address.zipCode}\n${address.country}`,
              margin: [0, 0, 0, 10]
            }
          ] : []),

          // Product List
          {
            text: 'Product Details',
            style: 'sectionHeader',
            margin: [0, 10, 0, 5]
          },
          {
            table: {
              headerRows: 1,
              widths: ['*', 'auto', 'auto', 'auto'],
              body: [
                [
                  { text: 'Product', style: 'tableHeader' },
                  { text: 'Description', style: 'tableHeader' },
                  { text: 'Qty', style: 'tableHeader' },
                  { text: 'Price', style: 'tableHeader' }
                ],
                ...order.items.map((item: any) => [
                  item.title || item.name,
                  item.description || 'N/A',
                  item.quantity,
                  `₹${(item.purchasePrice || item.price) * item.quantity}`
                ])
              ]
            },
            margin: [0, 0, 0, 10]
          },

          // Order Summary
          {
            text: 'Order Summary',
            style: 'sectionHeader',
            margin: [0, 10, 0, 5]
          },
          {
            table: {
              widths: ['*', 'auto'],
              body: [
                ['Subtotal', `₹${order.subtotal}`],
                ...(this.hasDiscount(order) ? [['Total Discount', `-₹${this.getTotalDiscount(order)}`]] : []),
                [`Tax (${order.gst || 0}%)`, `₹${order.tax}`],
                ['Shipping', `₹${order.shipping}`],
                [{ text: 'Total Amount', bold: true }, { text: `₹${order.total}`, bold: true }]
              ]
            },
            margin: [0, 0, 0, 10]
          },

          // Transaction Details
          ...(transactions.length > 0 ? [
            {
              text: 'Transaction Details',
              style: 'sectionHeader',
              margin: [0, 10, 0, 5]
            },
            {
              table: {
                headerRows: 1,
                widths: ['*', 'auto', 'auto', 'auto'],
                body: [
                  [
                    { text: 'Transaction ID', style: 'tableHeader' },
                    { text: 'Method', style: 'tableHeader' },
                    { text: 'Status', style: 'tableHeader' },
                    { text: 'Date', style: 'tableHeader' }
                  ],
                  ...transactions.map((tx: Transaction) => [
                    tx.id,
                    tx.method,
                    tx.status,
                    new Date(tx.createdAt).toLocaleDateString()
                  ])
                ]
              }
            }
          ] : [])
        ],
        styles: {
          header: {
            fontSize: 24,
            bold: true,
            color: '#2563eb'
          },
          subheader: {
            fontSize: 12,
            bold: true
          },
          sectionHeader: {
            fontSize: 14,
            bold: true,
            color: '#374151',
            margin: [0, 5, 0, 5]
          },
          tableHeader: {
            bold: true,
            fillColor: '#f3f4f6'
          }
        }
      };

      pdfMake.createPdf(docDefinition).download(`Invoice_Order_${order.id}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate invoice. Please try again.');
    } finally {
      this.isGeneratingPdf.set(false);
    }
  }
}