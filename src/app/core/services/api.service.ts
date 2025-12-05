import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { map, catchError, finalize, switchMap } from 'rxjs/operators';
import { Order, Transaction } from '../models/order';
import { User, Permission, Role, RolePermission } from '../models/user';
import { CartItem, Product } from '../models/product';
import { Address } from '../models/address';
import { Subscription } from '../models/subscription';
import { Event, EventStatus, EventFilters, EventFormData } from '../models/event';
import { EventBusinessLogic } from '../utils/event-business-logic';
import { LoadingService } from './loading.service';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly baseUrl = 'http://localhost:3000';
  private readonly eventsEndpoint = `${this.baseUrl}/events`;

  constructor(private http: HttpClient, private loadingService: LoadingService) {}

  // Products
  getProducts(): Observable<any[]> {
    this.loadingService.startLoading();
    return this.http.get<any[]>(`${this.baseUrl}/products`).pipe(
      finalize(() => this.loadingService.stopLoading())
    );
  }

  // Get single product by id
  getProductById(id: number | string): Observable<any> {
    this.loadingService.startLoading();
    // Try direct resource fetch first (/products/:id). If that fails (404),
    // fall back to a query by id (/products?id=:id) which json-server also supports.
    return this.http.get<any>(`${this.baseUrl}/products/${id}`).pipe(
      catchError(() =>
        this.http.get<any[]>(`${this.baseUrl}/products?id=${id}`).pipe(
          map(list => (list && list.length > 0) ? list[0] : null)
        )
      ),
      finalize(() => this.loadingService.stopLoading())
    );
  }

  // Create a product
  createProduct(product: any): Observable<any> {
    this.loadingService.startLoading();
    return this.http.post<any>(`${this.baseUrl}/products`, product).pipe(
      finalize(() => this.loadingService.stopLoading())
    );
  }

  // Update a product
  updateProduct(id: number | string, updates: Partial<any>): Observable<any> {
    this.loadingService.startLoading();
    return this.http.patch<any>(`${this.baseUrl}/products/${id}`, updates).pipe(
      finalize(() => this.loadingService.stopLoading())
    );
  }

  // Delete a product
  deleteProduct(id: number | string): Observable<any> {
    this.loadingService.startLoading();
    return this.http.delete<any>(`${this.baseUrl}/products/${id}`).pipe(
      finalize(() => this.loadingService.stopLoading())
    );
  }

  // Subscriptions
  getSubscriptions(): Observable<Subscription[]> {
    this.loadingService.startLoading();
    return this.http.get<Subscription[]>(`${this.baseUrl}/subscriptions`).pipe(
      finalize(() => this.loadingService.stopLoading())
    );
  }

  // Get single subscription by id
  getSubscriptionById(id: number | string): Observable<Subscription | null> {
    this.loadingService.startLoading();
    // Try direct resource fetch first (/subscriptions/:id). If that fails (404),
    // fall back to a query by id (/subscriptions?id=:id) which json-server also supports.
    return this.http.get<Subscription>(`${this.baseUrl}/subscriptions/${id}`).pipe(
      catchError(() =>
        this.http.get<Subscription[]>(`${this.baseUrl}/subscriptions?id=${id}`).pipe(
          map(list => (list && list.length > 0) ? list[0] : null)
        )
      ),
      finalize(() => this.loadingService.stopLoading())
    );
  }

  // Create a subscription
  createSubscription(subscription: Omit<Subscription, 'id'>): Observable<Subscription> {
    this.loadingService.startLoading();
    return this.http.post<Subscription>(`${this.baseUrl}/subscriptions`, subscription).pipe(
      finalize(() => this.loadingService.stopLoading())
    );
  }

  // Update a subscription
  updateSubscription(id: number | string, updates: Partial<Subscription>): Observable<Subscription> {
    this.loadingService.startLoading();
    // For JSON Server, PUT requires the complete object
    return this.getSubscriptionById(id).pipe(
      switchMap((currentSubscription: Subscription | null) => {
        if (!currentSubscription) {
          throw new Error('Subscription not found');
        }
        const updatedSubscription = { ...currentSubscription, ...updates, id: currentSubscription.id };
        return this.http.put<Subscription>(`${this.baseUrl}/subscriptions/${id}`, updatedSubscription);
      }),
      finalize(() => this.loadingService.stopLoading())
    );
  }

  // Delete a subscription
  deleteSubscription(id: number | string): Observable<any> {
    this.loadingService.startLoading();
    return this.http.delete<any>(`${this.baseUrl}/subscriptions/${id}`).pipe(
      finalize(() => this.loadingService.stopLoading())
    );
  }

  // Orders
  getOrders(): Observable<Order[]> {
    this.loadingService.startLoading();
    return this.http.get<Order[]>(`${this.baseUrl}/orders`).pipe(
      finalize(() => this.loadingService.stopLoading())
    );
  }
  //get orders based on order id
  getOrdersByOrderId(order_id : number | string): Observable<Order[]> {
    this.loadingService.startLoading();
    return this.http.get<Order[]>(`${this.baseUrl}/orders?id=${order_id}`).pipe(
      finalize(() => this.loadingService.stopLoading())
    );
  }

  // Get orders (optionally by user)
  getOrdersByUser(userId: string): Observable<Order[]> {
    this.loadingService.startLoading();
    return this.http.get<Order[]>(`${this.baseUrl}/orders?userId=${userId}`).pipe(
      finalize(() => this.loadingService.stopLoading())
    );
  }

  // Place an order (creates an order record)
  placeOrder(order: Order | any): Observable<Order> {
    this.loadingService.startLoading();
    return this.http.post<Order>(`${this.baseUrl}/orders`, order).pipe(
      finalize(() => this.loadingService.stopLoading())
    );
  }

  // Update an order (patch)
  updateOrder(id: number | string, updates: Partial<Order>): Observable<Order> {
    this.loadingService.startLoading();
    return this.http.patch<Order>(`${this.baseUrl}/orders/${id}`, updates as any).pipe(
      finalize(() => this.loadingService.stopLoading())
    );
  }
  give_rating_to_ordered_product(id: number | string, updates: Partial<Order>): Observable<Order> {
    this.loadingService.startLoading();
    return this.http.patch<Order>(`${this.baseUrl}/orders/${id}`, updates as any).pipe(
      finalize(() => this.loadingService.stopLoading())
    );
  }

  // Transactions
  getTransactions(): Observable<Transaction[]> {
    this.loadingService.startLoading();
    return this.http.get<Transaction[]>(`${this.baseUrl}/transactions`).pipe(
      finalize(() => this.loadingService.stopLoading())
    );
  }

  // Get transactions by user (filters by user's order IDs)
  getTransactionsByUser(userId: string): Observable<Transaction[]> {
    this.loadingService.startLoading();
    return this.http.get<Transaction[]>(`${this.baseUrl}/transactions?userId=${userId}`).pipe(
      finalize(() => this.loadingService.stopLoading())
    );
  }

  // Create a transaction record
  createTransaction(tx: Transaction | any): Observable<Transaction> {
    this.loadingService.startLoading();
    return this.http.post<Transaction>(`${this.baseUrl}/transactions`, tx).pipe(
      finalize(() => this.loadingService.stopLoading())
    );
  }

  // Users
  getUsers(): Observable<User[]> {
    this.loadingService.startLoading();
    return this.http.get<User[]>(`${this.baseUrl}/users`).pipe(
      finalize(() => this.loadingService.stopLoading())
    );
  }

  // Create a new user
  createUser(user: Partial<User & { password?: string }>): Observable<User> {
    this.loadingService.startLoading();
    return this.http.post<User>(`${this.baseUrl}/users`, user as any).pipe(
      finalize(() => this.loadingService.stopLoading())
    );
  }

  // Update existing user
  updateUser(id: string | number, updates: Partial<User & { password?: string }>): Observable<User> {
    this.loadingService.startLoading();
    return this.http.patch<User>(`${this.baseUrl}/users/${id}`, updates as any).pipe(
      finalize(() => this.loadingService.stopLoading())
    );
  }

  // Delete a user
  deleteUser(id: string | number): Observable<any> {
    this.loadingService.startLoading();
    return this.http.delete<any>(`${this.baseUrl}/users/${id}`).pipe(
      finalize(() => this.loadingService.stopLoading())
    );
  }

  // Cart (all carts or by user)
  getCart(userId?: string): Observable<Product[]> {
    this.loadingService.startLoading();
    const obs = userId ? this.http.get<Product[]>(`${this.baseUrl}/cart?userId=${userId}`) : this.http.get<Product[]>(`${this.baseUrl}/cart`);
    return obs.pipe(finalize(() => this.loadingService.stopLoading()));
  }

  // Add item to cart (creates a cart record)
  addCartItem(item: CartItem | any): Observable<any> {
    this.loadingService.startLoading();
    return this.http.post<any>(`${this.baseUrl}/cart`, item).pipe(
      finalize(() => this.loadingService.stopLoading())
    );
  }

  // Add subscription to cart
  addSubscriptionToCart(subscriptionData: any): Observable<any> {
    this.loadingService.startLoading();
    return this.http.post<any>(`${this.baseUrl}/cart`, subscriptionData).pipe(
      finalize(() => this.loadingService.stopLoading())
    );
  }

  // Update cart item by id
  updateCartItem(id: number | string, updates: Partial<any>): Observable<any> {
    this.loadingService.startLoading();
    return this.http.patch<any>(`${this.baseUrl}/cart/${id}`, updates).pipe(
      finalize(() => this.loadingService.stopLoading())
    );
  }

  // Remove cart item by id
  removeCartItem(id: number | string): Observable<any> {
    this.loadingService.startLoading();
    return this.http.delete<any>(`${this.baseUrl}/cart/${id}`).pipe(
      finalize(() => this.loadingService.stopLoading())
    );
  }

  // Clear all cart items for a user (performs multiple deletes)
  clearCartForUser(userId: string): Observable<void> {
    this.loadingService.startLoading();
    // json-server doesn't support bulk deletes, so clients should fetch items then delete each.
    // This helper is a convenience wrapper but actual deletion is done by the client code.
    return new Observable<void>(subscriber => {
      this.getCart(userId).subscribe({
        next: (items) => {
          const deletes = items.map((it: any) => this.removeCartItem(it.id));
          // run deletes sequentially
          let idx = 0;
          const runNext = () => {
            if (idx >= deletes.length) {
              subscriber.next();
              subscriber.complete();
              return;
            }
            deletes[idx].subscribe({
              next: () => { idx++; runNext(); },
              error: (err) => { subscriber.error(err); }
            });
          };
          runNext();
        },
        error: (err) => subscriber.error(err)
      });
    }).pipe(finalize(() => this.loadingService.stopLoading()));
  }

  // Get cart items by user (updated to handle both products and subscriptions)
  getCartByUser(userId: string): Observable<any[]> {
    this.loadingService.startLoading();
    return this.http.get<any[]>(`${this.baseUrl}/cart?userId=${userId}`).pipe(
      finalize(() => this.loadingService.stopLoading())
    );
  }

  getCharges(): Observable<any[]> {
    this.loadingService.startLoading();
    return this.http.get<any[]>(`${this.baseUrl}/charges`).pipe(
      finalize(() => this.loadingService.stopLoading())
    );
  }

  // Addresses
  getAddresses(userId: string): Observable<Address[]> {
    this.loadingService.startLoading();
    return this.http.get<Address[]>(`${this.baseUrl}/addresses?userId=${userId}`).pipe(
      finalize(() => this.loadingService.stopLoading())
    );
  }

  createAddress(address: Address): Observable<Address> {
    this.loadingService.startLoading();
    return this.http.post<Address>(`${this.baseUrl}/addresses`, address).pipe(
      finalize(() => this.loadingService.stopLoading())
    );
  }

  updateAddress(id: string, updates: Partial<Address>): Observable<Address> {
    this.loadingService.startLoading();
    return this.http.patch<Address>(`${this.baseUrl}/addresses/${id}`, updates).pipe(
      finalize(() => this.loadingService.stopLoading())
    );
  }

  deleteAddress(id: string): Observable<any> {
    this.loadingService.startLoading();
    return this.http.delete<any>(`${this.baseUrl}/addresses/${id}`).pipe(
      finalize(() => this.loadingService.stopLoading())
    );
  }

  // roles
  getRoles(): Observable<Role[]> {
    this.loadingService.startLoading();
    return this.http.get<Role[]>(`${this.baseUrl}/roles`).pipe(
      finalize(() => this.loadingService.stopLoading())
    );
  }

  getPermissions(): Observable<Permission[]> {
    this.loadingService.startLoading();
    return this.http.get<Permission[]>(`${this.baseUrl}/permissions`).pipe(
      finalize(() => this.loadingService.stopLoading())
    );
  }

  getRolePermissions(): Observable<Permission[]> {
    this.loadingService.startLoading();
    return this.http.get<Permission[]>(`${this.baseUrl}/role_permissions`).pipe(
      finalize(() => this.loadingService.stopLoading())
    );
  }

  createRole(role: { name: string, description: string, permissions: RolePermission[] }): Observable<any> {
    this.loadingService.startLoading();
    return this.http.post(`${this.baseUrl}/roles`, role).pipe(
      finalize(() => this.loadingService.stopLoading())
    );
  }

  updateRole(id: number, role: { name: string, description: string, permissions: RolePermission[] }): Observable<any> {
    this.loadingService.startLoading();
    return this.http.put(`${this.baseUrl}/roles/${id}`, role).pipe(
      finalize(() => this.loadingService.stopLoading())
    );
  }

  deleteRole(id: number): Observable<any> {
    this.loadingService.startLoading();
    return this.http.delete(`${this.baseUrl}/roles/${id}`).pipe(
      finalize(() => this.loadingService.stopLoading())
    );
  }

  getRolesWithPermissions(): Observable<Role[]> {
    this.loadingService.startLoading();
    return this.http.get<Role[]>(`${this.baseUrl}/roles`).pipe(
      switchMap(roles => {
        return this.getRolePermissions().pipe(
          map(permissions => {
            return roles.map(role => ({
              ...role,
              fullPermissions: permissions.filter(p => role.permissions.some(rp => rp.permission_id === p.permission_id))
            }));
          })
        );
      }),
      finalize(() => this.loadingService.stopLoading())
    );
  }

  // Categories
  getCategories(): Observable<any[]> {
    this.loadingService.startLoading();
    return this.http.get<any[]>(`${this.baseUrl}/categories`).pipe(
      finalize(() => this.loadingService.stopLoading())
    );
  }

  createCategory(category: any): Observable<any> {
    this.loadingService.startLoading();
    return this.http.post<any>(`${this.baseUrl}/categories`, category).pipe(
      finalize(() => this.loadingService.stopLoading())
    );
  }

  updateCategory(id: string, updates: Partial<any>): Observable<any> {
    this.loadingService.startLoading();
    return this.http.patch<any>(`${this.baseUrl}/categories/${id}`, updates).pipe(
      finalize(() => this.loadingService.stopLoading())
    );
  }

  deleteCategory(id: string): Observable<any> {
    this.loadingService.startLoading();
    return this.http.delete<any>(`${this.baseUrl}/categories/${id}`).pipe(
      finalize(() => this.loadingService.stopLoading())
    );
  }

  // Events
  getEvents(filters?: EventFilters): Observable<Event[]> {
    this.loadingService.startLoading();
    return this.http.get<Event[]>(this.eventsEndpoint).pipe(
      map(events => events.map(event => this.enrichEventData(event))),
      map(events => this.filterEventsCollection(events, filters)),
      catchError(error => this.handleEventError('Failed to load events', error)),
      finalize(() => this.loadingService.stopLoading())
    );
  }

  getEventById(id: string): Observable<Event> {
    this.loadingService.startLoading();
    return this.fetchEventById(id).pipe(
      catchError(error => this.handleEventError('Failed to load event details', error)),
      finalize(() => this.loadingService.stopLoading())
    );
  }

  createEvent(eventData: EventFormData): Observable<Event> {
    this.loadingService.startLoading();

    const eventForValidation: Partial<Event> = {
      ...eventData,
      speakers: eventData.speakers?.map(speaker => ({
        ...speaker,
        id: `speaker_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
      })) || [],
      capacity: {
        maximumAttendeeLimit: eventData.capacity.maximumAttendeeLimit,
        currentRegistrationCount: 0,
        waitlistCount: 0,
        modificationPermissions: {
          canReduceCapacity: true
        }
      }
    };

    const validation = EventBusinessLogic.validateEventData(eventForValidation);
    if (!validation.isValid) {
      this.loadingService.stopLoading();
      return throwError(() => new Error(validation.errors.join(', ')));
    }

    return this.http.get<Event[]>(this.eventsEndpoint).pipe(
      map(existingEvents => {
        const timeConflicts = EventBusinessLogic.checkTimeConflicts(
          {
            eventStartTime: eventData.eventStartTime,
            eventEndTime: eventData.eventEndTime,
            eventLocation: eventData.eventLocation
          },
          existingEvents
        );

        if (timeConflicts.hasConflict) {
          throw new Error(`Time conflict detected with existing events at ${eventData.eventLocation.venueName}`);
        }

        return existingEvents;
      }),
      switchMap(() => this.http.post<Event>(this.eventsEndpoint, this.prepareEventPayload(eventData))),
      map(event => this.enrichEventData(event)),
      catchError(error => this.handleEventError('Failed to create event', error)),
      finalize(() => this.loadingService.stopLoading())
    );
  }

  updateEvent(id: string, eventData: Partial<EventFormData>): Observable<Event> {
    this.loadingService.startLoading();

    return this.fetchEventById(id).pipe(
      switchMap(existingEvent => {
        if (!EventBusinessLogic.isEventEditable(existingEvent)) {
          return throwError(() => new Error('Event cannot be modified because it has been completed'));
        }

        const updatedData = { ...existingEvent, ...eventData };
        const validationData: Partial<Event> = {
          ...updatedData,
          speakers: updatedData.speakers ? updatedData.speakers.map((speaker, index) => ({
            ...speaker,
            id: `speaker_${Date.now()}_${index}_${Math.random().toString(36).substring(2, 11)}`
          })) : existingEvent.speakers,
          capacity: {
            maximumAttendeeLimit: (updatedData.capacity as any)?.maximumAttendeeLimit || existingEvent.capacity.maximumAttendeeLimit,
            currentRegistrationCount: existingEvent.capacity.currentRegistrationCount,
            waitlistCount: existingEvent.capacity.waitlistCount,
            modificationPermissions: existingEvent.capacity.modificationPermissions
          }
        };

        const validation = EventBusinessLogic.validateEventData(validationData);
        if (!validation.isValid) {
          return throwError(() => new Error(validation.errors.join(', ')));
        }

        return this.http.get<Event[]>(this.eventsEndpoint).pipe(
          map(allEvents => {
            const timeConflicts = EventBusinessLogic.checkTimeConflicts(
              {
                id,
                eventStartTime: updatedData.eventStartTime!,
                eventEndTime: updatedData.eventEndTime!,
                eventLocation: updatedData.eventLocation!
              },
              allEvents
            );

            if (timeConflicts.hasConflict) {
              throw new Error(`Time conflict detected with existing events at ${updatedData.eventLocation!.venueName}`);
            }

            return allEvents;
          }),
          switchMap(() => this.http.put<Event>(`${this.eventsEndpoint}/${id}`, this.prepareEventPayload(updatedData))),
          map(event => this.enrichEventData(event))
        );
      }),
      catchError(error => this.handleEventError('Failed to update event', error)),
      finalize(() => this.loadingService.stopLoading())
    );
  }

  deleteEvent(id: string): Observable<void> {
    this.loadingService.startLoading();

    return this.fetchEventById(id).pipe(
      switchMap(event => {
        if (event.status === EventStatus.IN_PROGRESS) {
          return throwError(() => new Error('Cannot delete an event that is currently in progress'));
        }

        return this.http.delete<void>(`${this.eventsEndpoint}/${id}`);
      }),
      catchError(error => this.handleEventError('Failed to delete event', error)),
      finalize(() => this.loadingService.stopLoading())
    );
  }

  exportEvents(events: Event[], format: 'csv' | 'pdf'): Observable<Blob> {
    const enrichedEvents = events.map(event => this.enrichEventData(event));
    if (format === 'csv') {
      const csv = this.generateCsvForEvents(enrichedEvents);
      return of(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    }

    const textContent = enrichedEvents.map(event => (
      `${event.eventName} | ${event.eventLocation.venueName}, ${event.eventLocation.city} | ${event.eventStartTime} - ${event.eventEndTime}`
    )).join('\n');

    return of(new Blob([textContent], { type: 'text/plain' }));
  }

  private fetchEventById(id: string): Observable<Event> {
    return this.http.get<Event>(`${this.eventsEndpoint}/${id}`).pipe(
      map(event => this.enrichEventData(event))
    );
  }

  private filterEventsCollection(events: Event[], filters?: EventFilters): Event[] {
    if (!filters) {
      return [...events];
    }

    let filtered = [...events];

    if (filters.searchTerm?.trim()) {
      const term = filters.searchTerm.toLowerCase();
      filtered = filtered.filter(event =>
        event.eventName.toLowerCase().includes(term) ||
        event.eventLocation.venueName.toLowerCase().includes(term) ||
        event.conductorDetails.primaryOrganizer.name.toLowerCase().includes(term)
      );
    }

    if (filters.status?.length) {
      filtered = filtered.filter(event => filters.status!.includes(event.status));
    }

    if (filters.dateRange?.start && filters.dateRange?.end) {
      filtered = filtered.filter(event => {
        const eventDate = new Date(event.eventStartTime);
        return eventDate >= new Date(filters.dateRange!.start) && eventDate <= new Date(filters.dateRange!.end);
      });
    }

    if (filters.location?.trim()) {
      const location = filters.location.toLowerCase();
      filtered = filtered.filter(event =>
        event.eventLocation.city.toLowerCase().includes(location) ||
        event.eventLocation.venueName.toLowerCase().includes(location)
      );
    }

    if (filters.organizer?.trim()) {
      const organizer = filters.organizer.toLowerCase();
      filtered = filtered.filter(event =>
        event.conductorDetails.primaryOrganizer.name.toLowerCase().includes(organizer)
      );
    }

    if (filters.capacityRange) {
      filtered = filtered.filter(event => {
        const capacity = event.capacity.maximumAttendeeLimit;
        return capacity >= filters.capacityRange!.min && capacity <= filters.capacityRange!.max;
      });
    }

    return filtered;
  }

  private enrichEventData(event: Event): Event {
    return {
      ...event,
      status: EventBusinessLogic.calculateEventStatus(
        event.eventStartTime,
        event.eventEndTime
      ),
      isEditable: EventBusinessLogic.isEventEditable(event),
      isCapacityModifiable: EventBusinessLogic.isCapacityModifiable(event),
      timeZone: event.timeZone || 'IST'
    };
  }

  private prepareEventPayload(eventData: Partial<EventFormData>): any {
    return {
      ...eventData,
      status: EventBusinessLogic.calculateEventStatus(
        eventData.eventStartTime!,
        eventData.eventEndTime!
      ),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      auditTrail: [EventBusinessLogic.generateAuditTrail(
        '',
        'created',
        'current-user',
        undefined,
        'Event created'
      )]
    };
  }

  private handleEventError(message: string, error: any): Observable<never> {
    const errorMessage = error?.error?.message || error?.message || message;
    return throwError(() => new Error(errorMessage));
  }

  private generateCsvForEvents(events: Event[]): string {
    const headers = [
      'Event Name',
      'Venue',
      'City',
      'Start Time',
      'End Time',
      'Status',
      'Capacity'
    ];

    const rows = events.map(event => ([
      `"${event.eventName}"`,
      `"${event.eventLocation.venueName}"`,
      `"${event.eventLocation.city}"`,
      `"${event.eventStartTime}"`,
      `"${event.eventEndTime}"`,
      `"${event.status}"`,
      `"${event.capacity.currentRegistrationCount}/${event.capacity.maximumAttendeeLimit}"`
    ]).join(','));

    return [headers.join(','), ...rows].join('\n');
  }
}
