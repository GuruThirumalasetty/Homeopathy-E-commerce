import { Component, OnInit, OnDestroy, computed, effect, signal } from '@angular/core';
import { CommonModule, NgFor, NgIf } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';

import { Event, EventStatus, EventFilters, hasEventPermission, EventPermission } from '../../core/models/event';
import { EventBusinessLogic } from '../../core/utils/event-business-logic';
import { ApiService } from '../../core/services/api.service';
import { NotificationService } from '../../core/services/notification.service';
import { AuthService } from '../../core/services/auth.service';
import { EventFormComponent } from '../event-form/event-form';

@Component({
  selector: 'app-event-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, EventFormComponent],
  templateUrl: './event-admin-dashboard.html',
  styleUrls: ['./event-admin-dashboard.scss']
})
export class EventAdminDashboardComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private statusUpdateIntervalId: ReturnType<typeof setInterval> | null = null;
  
  private readonly eventsSignal = signal<Event[]>([]);
  private readonly loadingSignal = signal(false);
  private readonly filtersSignal = signal<EventFilters>({
    searchTerm: '',
    status: [],
    location: '',
    organizer: ''
  });
  private readonly sortBySignal = signal<'eventName' | 'eventStartTime' | 'status' | 'capacity'>('eventStartTime');
  private readonly sortDirectionSignal = signal<'asc' | 'desc'>('asc');
  private readonly currentPageSignal = signal(1);
  readonly itemsPerPage = 10;
  private readonly viewModeSignal = signal<'grid' | 'list'>('list');
  private readonly selectedEventSignal = signal<Event | null>(null);
  private readonly showEventFormSignal = signal(false);
  private readonly showFiltersSignal = signal(false);

  private readonly filteredEventsSignal = computed(() => this.computeFilteredEvents());
  private readonly paginatedEventsSignal = computed(() => {
    const filtered = this.filteredEventsSignal();
    const start = (this.currentPageSignal() - 1) * this.itemsPerPage;
    return filtered.slice(start, start + this.itemsPerPage);
  });
  private readonly totalPagesSignal = computed(() => Math.max(1, Math.ceil(this.filteredEventsSignal().length / this.itemsPerPage)));
  private readonly dashboardStatsSignal = computed(() => this.computeDashboardStats());

  constructor(
    private apiService: ApiService,
    private notificationService: NotificationService,
    private authService: AuthService
  ) {
    effect(() => {
      const totalPages = this.totalPagesSignal();
      const currentPage = this.currentPageSignal();
      if (currentPage > totalPages) {
        this.currentPageSignal.set(totalPages);
      }
    });
  }

  get events(): Event[] {
    return this.eventsSignal();
  }

  get filteredEvents(): Event[] {
    return this.filteredEventsSignal();
  }

  get paginatedEvents(): Event[] {
    return this.paginatedEventsSignal();
  }

  get totalPages(): number {
    return this.totalPagesSignal();
  }

  get totalEvents(): number {
    return this.dashboardStatsSignal().total;
  }

  get upcomingEvents(): number {
    return this.dashboardStatsSignal().upcoming;
  }

  get inProgressEvents(): number {
    return this.dashboardStatsSignal().inProgress;
  }

  get completedEvents(): number {
    return this.dashboardStatsSignal().completed;
  }

  get totalAttendees(): number {
    return this.dashboardStatsSignal().totalAttendees;
  }

  get averageCapacityUtilization(): number {
    return this.dashboardStatsSignal().averageCapacityUtilization;
  }

  get loading(): boolean {
    return this.loadingSignal();
  }

  get viewMode(): 'grid' | 'list' {
    return this.viewModeSignal();
  }

  get selectedEvent(): Event | null {
    return this.selectedEventSignal();
  }

  get showEventForm(): boolean {
    return this.showEventFormSignal();
  }

  get showFilters(): boolean {
    return this.showFiltersSignal();
  }
  toggleFilters() {
    this.showFiltersSignal.update(prev => !prev);
  }

  get currentPage(): number {
    return this.currentPageSignal();
  }

  get sortBy(): 'eventName' | 'eventStartTime' | 'status' | 'capacity' {
    return this.sortBySignal();
  }

  get sortDirection(): 'asc' | 'desc' {
    return this.sortDirectionSignal();
  }

  get filters(): EventFilters {
    return this.filtersSignal();
  }

  get canGoToPreviousPage(): boolean {
    return this.currentPageSignal() > 1;
  }

  get canGoToNextPage(): boolean {
    return this.currentPageSignal() < this.totalPagesSignal();
  }

  ngOnInit(): void {
    this.loadEvents();
    this.startStatusUpdateTimer();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    // Fix: Clear interval to prevent memory leak
    if (this.statusUpdateIntervalId) {
      clearInterval(this.statusUpdateIntervalId);
      this.statusUpdateIntervalId = null;
    }
  }

  private loadEvents(): void {
    this.loadingSignal.set(true);

    this.apiService.getEvents()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (events: Event[]) => {
          this.eventsSignal.set(events.map(event => this.enrichEventData(event)));
          this.loadingSignal.set(false);
        },
        error: (error: Error) => {
          this.loadingSignal.set(false);
          this.notificationService.notify('Failed to load events: ' + error.message, 'error');
        }
      });
  }

  private enrichEventData(event: Event): Event {
    // Recalculate status based on current time
    const currentStatus = EventBusinessLogic.calculateEventStatus(
      event.eventStartTime, 
      event.eventEndTime
    );
    
    return {
      ...event,
      status: currentStatus,
      isEditable: EventBusinessLogic.isEventEditable(event),
      isCapacityModifiable: EventBusinessLogic.isCapacityModifiable(event)
    };
  }


  onFilterChange(filters: Partial<EventFilters>): void {
    this.filtersSignal.update(current => ({ ...current, ...filters }));
    this.currentPageSignal.set(1);
  }

  onSortChange(sortBy: typeof this.sortBy): void {
    if (this.sortBy === sortBy) {
      this.sortDirectionSignal.set(this.sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortBySignal.set(sortBy);
      this.sortDirectionSignal.set('asc');
    }
    this.currentPageSignal.set(1);
  }

  onPageChange(page: number): void {
    if (page < 1 || page > this.totalPages) {
      return;
    }
    this.currentPageSignal.set(page);
  }

  onViewModeChange(mode: 'grid' | 'list'): void {
    this.viewModeSignal.set(mode);
  }

  onEventSelect(event: Event): void {
    this.selectedEventSignal.set(event);
  }



  onEventFormClose(): void {
    this.showEventFormSignal.set(false);
    this.selectedEventSignal.set(null);
    this.loadEvents(); // Refresh data
  }

  onEventDeleted(eventId: string): void {
    this.eventsSignal.update(events => events.filter(e => e.id !== eventId));
    this.notificationService.notify('Event deleted successfully', 'success');
  }

  onEventStatusChange(eventId: string, newStatus: EventStatus): void {
    this.eventsSignal.update(events =>
      events.map(event => {
        if (event.id !== eventId) {
          return event;
        }
        const updated = { ...event, status: newStatus };
        return {
          ...updated,
          isEditable: EventBusinessLogic.isEventEditable(updated),
          isCapacityModifiable: EventBusinessLogic.isCapacityModifiable(updated)
        };
      })
    );
  }

  private startStatusUpdateTimer(): void {
    // Fix: Store interval ID for cleanup in ngOnDestroy
    this.statusUpdateIntervalId = setInterval(() => {
      try {
        const currentEvents = this.eventsSignal();
        const shouldUpdate = currentEvents.some(event => {
          const newStatus = EventBusinessLogic.calculateEventStatus(
            event.eventStartTime, 
            event.eventEndTime
          );
          return newStatus !== event.status;
        });

        if (shouldUpdate) {
          this.eventsSignal.set(currentEvents.map(event => this.enrichEventData(event)));
        }
      } catch (error) {
        console.error('Error updating event statuses:', error);
      }
    }, 60000); // 1 minute
  }

  getEventStatusInfo(status: EventStatus) {
    return EventBusinessLogic.getEventStatusInfo(status);
  }

  formatEventTime(dateTimeString: string, timeZone: string = 'IST'): string {
    return EventBusinessLogic.formatEventTime(dateTimeString, timeZone);
  }

  getRemainingCapacity(event: Event): number {
    return EventBusinessLogic.getRemainingCapacity(event);
  }

  hasWaitlist(event: Event): boolean {
    return EventBusinessLogic.hasWaitlist(event);
  }



  toggleStatusFilter(status: string): void {
    const statusEnum = status as EventStatus;
    this.filtersSignal.update(current => {
      const currentStatus = current.status || [];
      const nextStatus = currentStatus.includes(statusEnum)
        ? currentStatus.filter(s => s !== statusEnum)
        : [...currentStatus, statusEnum];
      return { ...current, status: nextStatus };
    });
    this.currentPageSignal.set(1);
  }

  onDateRangeChange(type: 'start' | 'end', value: string): void {
    this.filtersSignal.update(current => {
      const dateRange = current.dateRange ? { ...current.dateRange } : { start: '', end: '' };
      dateRange[type] = value;
      return { ...current, dateRange };
    });
    this.currentPageSignal.set(1);
  }

  clearFilters(): void {
    this.filtersSignal.set({
      searchTerm: '',
      status: [],
      location: '',
      organizer: '',
      dateRange: undefined,
      capacityRange: undefined
    });
    this.currentPageSignal.set(1);
  }

  toggleSortDirection(): void {
    this.sortDirectionSignal.set(this.sortDirection === 'asc' ? 'desc' : 'asc');
  }

  getSortIcon(column: string): string {
    if (this.sortBy !== column) {
      return 'fas fa-sort text-muted';
    }
    
    return this.sortDirection === 'asc' ? 'fas fa-sort-up' : 'fas fa-sort-down';
  }



  onEventSaved(event: Event): void {
    this.onEventFormClose();
    this.loadEvents();
  }

  getPageNumbers(): number[] {
    const pages: number[] = [];
    const startPage = Math.max(1, this.currentPage - 2);
    const endPage = Math.min(this.totalPages, this.currentPage + 2);
    
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    
    return pages;
  }

  getMin(a: number, b: number): number {
    return Math.min(a, b);
  }

  // Date range helper properties for template binding
  get dateRangeStart(): string {
    return this.filtersSignal().dateRange?.start || '';
  }

  get dateRangeEnd(): string {
    return this.filtersSignal().dateRange?.end || '';
  }

  onDateRangeStartChange(value: string): void {
    this.onDateRangeChange('start', value);
  }

  onDateRangeEndChange(value: string): void {
    this.onDateRangeChange('end', value);
  }

  // Status filter helper for template
  isStatusSelected(status: string): boolean {
    const statusEnum = status as EventStatus;
    return this.filtersSignal().status?.includes(statusEnum) || false;
  }

  // Permission-based access control methods
  canCreateEvent(): boolean {
    const userRole = this.authService.user()?.role;
    return userRole ? hasEventPermission(userRole, EventPermission.CREATE) : false;
  }

  canEditEvent(event: Event): boolean {// used to check if the user has permission to edit the event
    const userRole = this.authService.user()?.role;
    if (!userRole) return false;
    
    // Check if event is editable according to business logic
    if (!event.isEditable) return false;
    
    return hasEventPermission(userRole, EventPermission.EDIT);
  }

  canDeleteEvent(event: Event): boolean {// used to check if the user has permission to delete the event
    const userRole = this.authService.user()?.role;
    if (!userRole) return false;
    
    // Cannot delete in-progress events
    if (event.status === EventStatus.IN_PROGRESS) return false;
    
    return hasEventPermission(userRole, EventPermission.DELETE);
  }

  canManageCapacity(event: Event): boolean {// used to check if the user has permission to manage the event capacity
    const userRole = this.authService.user()?.role;
    if (!userRole) return false;
    
    // Check if event capacity is modifiable according to business logic
    if (!event.isCapacityModifiable) return false;
    
    return hasEventPermission(userRole, EventPermission.MANAGE_CAPACITY);
  }

  canViewAttendees(event: Event): boolean {// used to check if the user has permission to view the event attendees
    const userRole = this.authService.user()?.role;
    return userRole ? hasEventPermission(userRole, EventPermission.VIEW_ATTENDEES) : false;
  }

  canExportEvents(): boolean {// used to check if the user has permission to export the events
    const userRole = this.authService.user()?.role;
    return userRole ? hasEventPermission(userRole, EventPermission.EXPORT_DATA) : false;
  }

  canManageStatus(event: Event): boolean {// used to check if the user has permission to manage the event status
    const userRole = this.authService.user()?.role;
    return userRole ? hasEventPermission(userRole, EventPermission.MANAGE_STATUS) : false;
  }

  // Enhanced event form access
  onCreateEvent(): void {// used to create a new event
    if (!this.canCreateEvent()) {
      this.notificationService.notify('You do not have permission to create events', 'error');
      return;
    }
    this.selectedEventSignal.set(null);
    this.showEventFormSignal.set(true);
  }

  onEditEvent(event: Event): void {// used to edit an event
    if (!this.canEditEvent(event)) {
      this.notificationService.notify('You do not have permission to edit this event', 'error');
      return;
    }
    this.selectedEventSignal.set(event);
    this.showEventFormSignal.set(true);
  }

  onDeleteEvent(event: Event): void {// used to delete an event
    if (!this.canDeleteEvent(event)) {
      this.notificationService.notify('You do not have permission to delete this event', 'error');
      return;
    }

    if (confirm(`Are you sure you want to delete "${event.eventName}"?`)) {
      this.apiService.deleteEvent(event.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.onEventDeleted(event.id);
            this.notificationService.notify('Event deleted successfully', 'success');
          },
          error: (error: Error) => {
            this.notificationService.notify('Failed to delete event: ' + error.message, 'error');
          }
        });
    }
  }

  exportEvents(format: 'csv' | 'pdf'): void {// used to export the events
    if (!this.canExportEvents()) {
      this.notificationService.notify('You do not have permission to export events', 'error');
      return;
    }

    this.apiService.exportEvents(this.filteredEvents, format)
      .subscribe({
        next: (blob: Blob) => {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `events_${new Date().toISOString().split('T')[0]}.${format}`;
          a.click();
          window.URL.revokeObjectURL(url);
          this.notificationService.notify(`Events exported as ${format.toUpperCase()}`, 'success');
        },
        error: (error: Error) => {
          this.notificationService.notify('Failed to export events: ' + error.message, 'error');
        }
      });
  }

  onViewAttendees(event: Event): void {// used to view the event attendees
    if (!this.canViewAttendees(event)) {
      this.notificationService.notify('You do not have permission to view attendees for this event', 'error');
      return;
    }
    this.notificationService.notify(`Viewing attendees for ${event.eventName}`, 'info');
  }

  private computeFilteredEvents(): Event[] {// used to filter the events
    const events = [...this.eventsSignal()];
    const filters = this.filtersSignal();
    const sortBy = this.sortBySignal();
    const sortDirection = this.sortDirectionSignal();

    let filtered = events;

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
      const { min, max } = filters.capacityRange;
      filtered = filtered.filter(event => {
        const capacity = event.capacity.maximumAttendeeLimit;
        return capacity >= min && capacity <= max;
      });
    }

    filtered.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'eventName':
          comparison = a.eventName.localeCompare(b.eventName);
          break;
        case 'eventStartTime':
          comparison = new Date(a.eventStartTime).getTime() - new Date(b.eventStartTime).getTime();
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        case 'capacity':
          comparison = a.capacity.maximumAttendeeLimit - b.capacity.maximumAttendeeLimit;
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }

  private computeDashboardStats() {
    const events = this.eventsSignal();
    const total = events.length;
    const upcoming = events.filter(e => e.status === EventStatus.UPCOMING).length;
    const inProgress = events.filter(e => e.status === EventStatus.IN_PROGRESS).length;
    const completed = events.filter(e => e.status === EventStatus.COMPLETED).length;

    const totalAttendees = events.reduce((sum, event) => sum + (event.capacity.currentRegistrationCount || 0), 0);
    const totalCapacity = events.reduce((sum, event) => sum + (event.capacity.maximumAttendeeLimit || 0), 0);

    return {
      total,
      upcoming,
      inProgress,
      completed,
      totalAttendees,
      averageCapacityUtilization: totalCapacity > 0
        ? Math.round((totalAttendees / totalCapacity) * 100)
        : 0
    };
  }
}
