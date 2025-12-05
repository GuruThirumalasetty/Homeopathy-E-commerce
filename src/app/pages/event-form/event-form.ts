import { Component, OnInit, OnDestroy, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormArray, AbstractControl, FormControl } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { firstValueFrom } from 'rxjs';

import { Event, EventFormData, EventValidationErrors, SpeakerDetails } from '../../core/models/event';
import { EventBusinessLogic } from '../../core/utils/event-business-logic';
import { ApiService } from '../../core/services/api.service';
import { NotificationService } from '../../core/services/notification.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-event-form',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './event-form.html',
  styleUrls: ['./event-form.scss'],
  providers: [DatePipe]
})
export class EventFormComponent implements OnInit, OnDestroy {
  @Input() event: Event | null = null;
  @Input() isEditMode = false;
  @Output() formClose = new EventEmitter<void>();
  @Output() eventSaved = new EventEmitter<Event>();
  
  private destroy$ = new Subject<void>();
  
  eventForm!: FormGroup;
  loading = signal(false);
  validationErrors = signal<EventValidationErrors>({});
  selectedTimezone = 'Asia/Calcutta';
  
  // Available timezones for selection
  timezones = [
    { value: 'UTC', label: 'UTC (Universal Time)' },
    { value: 'America/New_York', label: 'Eastern Time (ET)' },
    { value: 'America/Chicago', label: 'Central Time (CT)' },
    { value: 'America/Denver', label: 'Mountain Time (MT)' },
    { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
    { value: 'Europe/London', label: 'Greenwich Mean Time (GMT)' },
    { value: 'Europe/Paris', label: 'Central European Time (CET)' },
    { value: 'Asia/Tokyo', label: 'Japan Standard Time (JST)' },
    { value: 'Asia/Calcutta', label: 'India Standard Time (IST)' },
    { value: 'Australia/Sydney', label: 'Australian Eastern Time (AEST)' }
  ];

  // Available agenda items
  agendaItems: Array<{ timeSlots: Array<{ startTime: string; endTime: string; activity: string; presenter?: string; }> }> = [
    {
      timeSlots: [
        { startTime: '09:00', endTime: '09:30', activity: 'Registration & Welcome', presenter: '' },
        { startTime: '09:30', endTime: '10:30', activity: 'Opening Keynote', presenter: '' },
        { startTime: '10:30', endTime: '11:00', activity: 'Coffee Break', presenter: '' },
        { startTime: '11:00', endTime: '12:00', activity: 'Session 1', presenter: '' },
        { startTime: '12:00', endTime: '13:00', activity: 'Lunch Break', presenter: '' },
        { startTime: '13:00', endTime: '14:00', activity: 'Session 2', presenter: '' },
        { startTime: '14:00', endTime: '14:30', activity: 'Afternoon Break', presenter: '' },
        { startTime: '14:30', endTime: '15:30', activity: 'Closing Session', presenter: '' },
        { startTime: '15:30', endTime: '16:00', activity: 'Networking', presenter: '' }
      ]
    }
  ];

  constructor(
    private formBuilder: FormBuilder,
    private apiService: ApiService,
    private notificationService: NotificationService,
    private authService: AuthService,
    private date_pipe : DatePipe
  ) {}

  ngOnInit(): void {
    this.initializeForm();
    // Check if we have an event to edit
    if (this.event) {
      this.isEditMode = true;
      this.populateFormWithEventData();
    } else {
      this.isEditMode = false;
    }
    this.setupFormValidation();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeForm(): void {
    this.eventForm = this.formBuilder.group({
      eventName: ['', [Validators.required, Validators.maxLength(100)]],
      eventLocation: this.formBuilder.group({
        venueName: ['', [Validators.required]],
        address: ['', [Validators.required]],
        city: ['', [Validators.required]],
        state: ['', [Validators.required]],
        zipCode: ['', [Validators.required]],
        country: ['', [Validators.required]]
      }),
      eventStartTime: ['', [Validators.required, this.futureDateValidator()]],
      eventEndTime: ['', [Validators.required, this.futureDateValidator()]],
      timeZone: [this.selectedTimezone, Validators.required],
      eventDetails: this.formBuilder.group({
        mealArrangements: this.formBuilder.group({
          lunch: [false],
          refreshments: [true],
          dietaryRestrictions: [[]],
          specialDietaryNeeds: ['']
        }),
        agendaSchedule: this.formBuilder.group({
          timeSlots: [this.agendaItems[0].timeSlots]
        }),
        specialRequirements: this.formBuilder.array([]),
        equipmentNeeds: this.formBuilder.array([]),
        parkingInformation: [''],
        additionalNotes: ['']
      }),
      conductorDetails: this.formBuilder.group({
        primaryOrganizer: this.formBuilder.group({
          name: ['', [Validators.required]],
          title: ['', [Validators.required]],
          email: ['', [Validators.required, Validators.email]],
          phone: ['', [Validators.required]],
          department: ['', [Validators.required]]
        }),
        backupCoordinator: this.formBuilder.group({
          name: [''],
          title: [''],
          email: [''],
          phone: ['']
        })
      }),
      speakers: this.formBuilder.array([]),
      capacity: this.formBuilder.group({
        maximumAttendeeLimit: [50, [Validators.required, Validators.min(1), Validators.max(1000)]]
      })
    });

    // Add initial speaker
    this.addSpeaker();
  }

  private populateFormWithEventData(): void {
    if (!this.event) return;

    this.eventForm.patchValue({
      eventName: this.event.eventName,
      eventLocation: this.event.eventLocation,
      eventStartTime: this.formatDateTimeForInput(this.event.eventStartTime),
      eventEndTime: this.formatDateTimeForInput(this.event.eventEndTime),
      timeZone: this.event.timeZone || 'Asia/Calcutta',
      eventDetails: {
        mealArrangements: this.event.eventDetails?.mealArrangements || {
          lunch: false,
          refreshments: true,
          dietaryRestrictions: [],
          specialDietaryNeeds: ''
        },
        agendaSchedule: this.event.eventDetails?.agendaSchedule || {
          timeSlots: []
        },
        parkingInformation: this.event.eventDetails?.parkingInformation || '',
        additionalNotes: this.event.eventDetails?.additionalNotes || ''
      },
      conductorDetails: this.event.conductorDetails,
      capacity: {
        maximumAttendeeLimit: this.event.capacity.maximumAttendeeLimit
      }
    });

    // Clear existing speakers and populate with event speakers
    this.speakers.clear();
    if (this.event.speakers && this.event.speakers.length > 0) {
      this.event.speakers.forEach(speaker => this.addSpeaker(speaker));
    } else {
      // Ensure at least one speaker exists
      this.addSpeaker();
    }

    // Populate equipment needs
    this.equipmentNeeds.clear();
    if (this.event.eventDetails?.equipmentNeeds && Array.isArray(this.event.eventDetails.equipmentNeeds)) {
      this.event.eventDetails.equipmentNeeds.forEach((need: string) => {
        this.equipmentNeeds.push(this.formBuilder.control(need));
      });
    }

    // Populate special requirements
    this.specialRequirements.clear();
    if (this.event.eventDetails?.specialRequirements && Array.isArray(this.event.eventDetails.specialRequirements)) {
      this.event.eventDetails.specialRequirements.forEach((req: string) => {
        this.specialRequirements.push(this.formBuilder.control(req));
      });
    }

    // Set timezone
    this.selectedTimezone = this.event.timeZone || 'Asia/Calcutta';
    this.isEditMode = true;
  }

  private setupFormValidation(): void {
    // Real-time validation for date/time fields
    this.eventForm.get('eventStartTime')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.validateEventTimes());

    this.eventForm.get('eventEndTime')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.validateEventTimes());

    // Real-time validation for capacity
    this.eventForm.get('capacity.maximumAttendeeLimit')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.validateCapacity());

    // Validate event name uniqueness
    this.eventForm.get('eventName')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.validateEventName());
  }

  private futureDateValidator() {
    return (control: any) => {
      if (!control.value) return null;
      try {
        const selectedDate = new Date(control.value);
        if (isNaN(selectedDate.getTime())) {
          return { invalidDate: true };
        }
        const now = new Date();
        // Allow dates up to 1 minute in the past to account for form submission timing
        const oneMinuteAgo = new Date(now.getTime() - 60000);
        return selectedDate > oneMinuteAgo ? null : { futureDateRequired: true };
      } catch {
        return { invalidDate: true };
      }
    };
  }

  private validateEventTimes(): void {
    const startTime = this.eventForm.get('eventStartTime')?.value;
    const endTime = this.eventForm.get('eventEndTime')?.value;

    if (startTime && endTime) {
      const start = new Date(startTime);
      const end = new Date(endTime);

      if (end <= start) {
        this.eventForm.get('eventEndTime')?.setErrors({ endTimeInvalid: true });
      } else {
        // Clear endTime errors but preserve other validators
        const currentErrors = this.eventForm.get('eventEndTime')?.errors;
        if (currentErrors && 'endTimeInvalid' in currentErrors) {
          delete (currentErrors as any)['endTimeInvalid'];
          this.eventForm.get('eventEndTime')?.setErrors(Object.keys(currentErrors).length ? currentErrors : null);
        }
      }
    }
  }

  private validateCapacity(): void {
    const currentRegistrations = this.event?.capacity.currentRegistrationCount || 0;
    const newLimit = this.eventForm.get('capacity.maximumAttendeeLimit')?.value;

    if (newLimit && newLimit < currentRegistrations) {
      this.eventForm.get('capacity.maximumAttendeeLimit')?.setErrors({
        capacityTooLow: true,
        currentRegistrations
      });
    } else {
      // Clear capacity errors but preserve other validators
      const currentErrors = this.eventForm.get('capacity.maximumAttendeeLimit')?.errors;
      if (currentErrors && 'capacityTooLow' in currentErrors) {
        delete (currentErrors as any)['capacityTooLow'];
        this.eventForm.get('capacity.maximumAttendeeLimit')?.setErrors(
          Object.keys(currentErrors).length ? currentErrors : null
        );
      }
    }
  }

  private validateEventName(): void {
    if (!this.eventForm.get('eventName')?.value) return;

    const eventName = this.eventForm.get('eventName')?.value.trim();
    if (eventName.length === 0) return;

    // This would typically involve checking against existing events
    // For now, we'll just validate format
  }

  // Speaker Management
  get speakers(): FormArray {
    return this.eventForm.get('speakers') as FormArray;
  }

  addSpeaker(speakerData?: any): void {
    const speakerForm = this.formBuilder.group({
      id: [speakerData?.id || `speaker_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`],
      name: [speakerData?.name || '', [Validators.required]],
      bio: [speakerData?.bio || ''],
      credentials: [speakerData?.credentials || ''],
      sessionTopic: [speakerData?.sessionTopic || '', [Validators.required]],
      sessionDuration: [speakerData?.sessionDuration || 60, [Validators.required, Validators.min(1), Validators.max(480)]],
      email: [speakerData?.email || '', [Validators.email]],
      phone: [speakerData?.phone || ''],
      specialRequirements: [speakerData?.specialRequirements || []],
      avRequirements: [speakerData?.avRequirements || ''],
      seatingRequirements: [speakerData?.seatingRequirements || '']
    });

    this.speakers.push(speakerForm);
  }

  removeSpeaker(index: number): void {
    this.speakers.removeAt(index);
  }

  // Dietary restrictions management
  onDietaryRestrictionsChange(event: any): void {
    const dietaryRestrictions = Array.from(event.target.selectedOptions)
      .map((option: any) => option.value);
    this.eventForm.get('eventDetails.mealArrangements.dietaryRestrictions')?.setValue(dietaryRestrictions);
  }

  // Special requirements management
  get specialRequirements(): FormArray {
    const eventDetails = this.eventForm.get('eventDetails') as FormGroup;
    return eventDetails.get('specialRequirements') as FormArray;
  }

  getSpecialRequirementControl(index: number): FormControl {
    return this.specialRequirements.at(index) as FormControl;
  }

  addSpecialRequirement(): void {
    this.specialRequirements.push(this.formBuilder.control(''));
  }

  removeSpecialRequirement(index: number): void {
    if (this.specialRequirements.length > 0) {
      this.specialRequirements.removeAt(index);
    }
  }

  // Equipment needs management
  get equipmentNeeds(): FormArray {
    const eventDetails = this.eventForm.get('eventDetails') as FormGroup;
    return eventDetails.get('equipmentNeeds') as FormArray;
  }

  getEquipmentNeedControl(index: number): FormControl {
    return this.equipmentNeeds.at(index) as FormControl;
  }

  addEquipmentNeed(): void {
    this.equipmentNeeds.push(this.formBuilder.control(''));
  }

  removeEquipmentNeed(index: number): void {
    if (this.equipmentNeeds.length > 0) {
      this.equipmentNeeds.removeAt(index);
    }
  }

  // Agenda management
  addAgendaItem(): void {
    const agendaItems = this.eventForm.get('eventDetails.agendaSchedule.timeSlots')?.value || [];
    agendaItems.push({
      startTime: '',
      endTime: '',
      activity: '',
      presenter: ''
    });
    this.eventForm.get('eventDetails.agendaSchedule.timeSlots')?.setValue(agendaItems);
  }

  removeAgendaItem(index: number): void {
    const agendaItems = this.eventForm.get('eventDetails.agendaSchedule.timeSlots')?.value || [];
    agendaItems.splice(index, 1);
    this.eventForm.get('eventDetails.agendaSchedule.timeSlots')?.setValue(agendaItems);
  }

  // Timezone management
  onTimezoneChange(): void {
    this.selectedTimezone = this.eventForm.get('timeZone')?.value;
  }

  // Form submission
  onSubmit(): void {
    if (this.eventForm.valid) {
      this.saveEvent();
    } else {
      this.markFormGroupTouched(this.eventForm);
      this.scrollToFirstError();
    }
  }

  private async saveEvent(): Promise<void> {
    this.loading.set(true);
    this.validationErrors.set({});

    try {
      const formData = this.prepareFormData();
      
      let savedEvent: Event;
      
      if (this.isEditMode && this.event) {
        savedEvent = await firstValueFrom(this.apiService.updateEvent(this.event.id, formData));
      } else {
        savedEvent = await firstValueFrom(this.apiService.createEvent(formData));
      }

      this.notificationService.notify(
        `Event ${this.isEditMode ? 'updated' : 'created'} successfully`,
        'success'
      );
      
      this.eventSaved.emit(savedEvent);
      this.onClose();
    } catch (error: any) {
      const errorMessage = error?.message || error?.error?.message || 'An unexpected error occurred';
      this.notificationService.notify(
        `Failed to ${this.isEditMode ? 'update' : 'create'} event: ${errorMessage}`,
        'error'
      );
      this.validationErrors.set({ general: [errorMessage] });
    } finally {
      this.loading.set(false);
    }
  }

  private prepareFormData(): EventFormData {
    const formValue = this.eventForm.value;
    
    // Convert FormArrays to regular arrays
    const equipmentNeedsArray = this.equipmentNeeds.controls
      .map(control => control.value)
      .filter(value => value && typeof value === 'string' && value.trim() !== '');
    
    const specialRequirementsArray = this.specialRequirements.controls
      .map(control => control.value)
      .filter(value => value && typeof value === 'string' && value.trim() !== '');
    
    // Validate and convert dates
    if (!formValue.eventStartTime || !formValue.eventEndTime) {
      throw new Error('Event start time and end time are required');
    }

    const startDate = new Date(formValue.eventStartTime);
    const endDate = new Date(formValue.eventEndTime);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new Error('Invalid date format for event times');
    }

    if (endDate <= startDate) {
      throw new Error('End time must be after start time');
    }
    
    return {
      eventName: formValue.eventName?.trim() || '',
      eventLocation: {
        venueName: formValue.eventLocation?.venueName?.trim() || '',
        address: formValue.eventLocation?.address?.trim() || '',
        city: formValue.eventLocation?.city?.trim() || '',
        state: formValue.eventLocation?.state?.trim() || '',
        zipCode: formValue.eventLocation?.zipCode?.trim() || '',
        country: formValue.eventLocation?.country?.trim() || ''
      },
      eventStartTime: startDate.toISOString(),
      eventEndTime: endDate.toISOString(),
      eventDetails: {
        mealArrangements: formValue.eventDetails?.mealArrangements || {
          lunch: false,
          refreshments: true,
          dietaryRestrictions: [],
          specialDietaryNeeds: ''
        },
        agendaSchedule: formValue.eventDetails?.agendaSchedule || {
          timeSlots: []
        },
        equipmentNeeds: equipmentNeedsArray,
        specialRequirements: specialRequirementsArray,
        parkingInformation: formValue.eventDetails?.parkingInformation?.trim() || '',
        additionalNotes: formValue.eventDetails?.additionalNotes?.trim() || ''
      },
      conductorDetails: {
        primaryOrganizer: {
          name: formValue.conductorDetails?.primaryOrganizer?.name?.trim() || '',
          title: formValue.conductorDetails?.primaryOrganizer?.title?.trim() || '',
          email: formValue.conductorDetails?.primaryOrganizer?.email?.trim() || '',
          phone: formValue.conductorDetails?.primaryOrganizer?.phone?.trim() || '',
          department: formValue.conductorDetails?.primaryOrganizer?.department?.trim() || ''
        },
        backupCoordinator: {
          name: formValue.conductorDetails?.backupCoordinator?.name?.trim() || '',
          title: formValue.conductorDetails?.backupCoordinator?.title?.trim() || '',
          email: formValue.conductorDetails?.backupCoordinator?.email?.trim() || '',
          phone: formValue.conductorDetails?.backupCoordinator?.phone?.trim() || ''
        }
      },
      speakers: (formValue.speakers || []).filter((speaker: any) => speaker && speaker.name && speaker.name.trim() !== ''),
      capacity: {
        maximumAttendeeLimit: formValue.capacity?.maximumAttendeeLimit || 50
      },
      timeZone: formValue.timeZone || 'Asia/Calcutta'
    };
  }

  // Utility methods
  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();

      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      } else if (control instanceof FormArray) {
        control.controls.forEach(arrayControl => {
          if (arrayControl instanceof FormGroup) {
            this.markFormGroupTouched(arrayControl);
          }
        });
      }
    });
  }

  private scrollToFirstError(): void {
    setTimeout(() => {
      const firstErrorElement = document.querySelector('.form-control.ng-invalid') as HTMLElement;
      if (firstErrorElement) {
        firstErrorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        firstErrorElement.focus();
      }
    }, 100);
  }

  private formatDateTimeForInput(dateTimeString: string): string {
    return this.date_pipe.transform(new Date(dateTimeString), 'yyyy-MM-ddTHH:mm') || '';
  }

  onClose(): void {
    this.formClose.emit();
  }

  // Helper methods for template
  isFieldInvalid(fieldPath: string): boolean {
    const field = this.getField(fieldPath);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  getFieldError(fieldPath: string): string {
    const field = this.getField(fieldPath);
    if (!field || !field.errors) return '';

    if (field.errors['required']) return 'This field is required';
    if (field.errors['maxLength']) return `Maximum ${field.errors['maxLength'].requiredLength} characters allowed`;
    if (field.errors['minLength']) return `Minimum ${field.errors['minLength'].requiredLength} characters required`;
    if (field.errors['email']) return 'Please enter a valid email address';
    if (field.errors['min']) return `Minimum value is ${field.errors['min'].min}`;
    if (field.errors['max']) return `Maximum value is ${field.errors['max'].max}`;
    if (field.errors['futureDateRequired']) return 'Event must be scheduled for a future date';
    if (field.errors['invalidDate']) return 'Please enter a valid date';
    if (field.errors['endTimeInvalid']) return 'End time must be after start time';
    if (field.errors['capacityTooLow']) return `Capacity cannot be less than current registrations (${field.errors['capacityTooLow'].currentRegistrations})`;

    return 'Invalid input';
  }

  private getField(fieldPath: string): any {
    const fields = fieldPath.split('.');
    let field: any = this.eventForm;
    
    for (const fieldName of fields) {
      field = field.get(fieldName);
      if (!field) return null;
    }
    
    return field;
  }

  // Additional helper methods needed by the template
  getArrayItems(arrayPath: string): any[] {
    if (arrayPath === 'eventDetails.equipmentNeeds') {
      return this.equipmentNeeds.controls;
    }
    if (arrayPath === 'eventDetails.specialRequirements') {
      return this.specialRequirements.controls;
    }
    const control = this.eventForm.get(arrayPath);
    if (control instanceof FormArray) {
      return control.controls;
    }
    return control?.value || [];
  }

  getArrayControl(arrayPath: string, index: number): any {
    if (arrayPath === 'eventDetails.equipmentNeeds') {
      return this.equipmentNeeds.at(index);
    }
    if (arrayPath === 'eventDetails.specialRequirements') {
      return this.specialRequirements.at(index);
    }
    const control = this.eventForm.get(arrayPath);
    if (control instanceof FormArray) {
      return control.at(index);
    }
    return null;
  }
}