import { Event, EventStatus, EventAuditTrail } from '../models/event';

export class EventBusinessLogic {
  
  /**
   * Calculate event status based on current time and event timing
   * Includes error handling for invalid date strings
   */
  static calculateEventStatus(eventStartTime: string, eventEndTime: string): EventStatus {
    try {
      const now = new Date();
      const startTime = new Date(eventStartTime);
      const endTime = new Date(eventEndTime);

      // Validate parsed dates
      if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
        console.error('Invalid date format for event times:', { eventStartTime, eventEndTime });
        return EventStatus.UPCOMING; // Default to upcoming for invalid dates
      }

      if (now < startTime) {
        return EventStatus.UPCOMING;
      } else if (now >= startTime && now <= endTime) {
        return EventStatus.IN_PROGRESS;
      } else {
        return EventStatus.COMPLETED;
      }
    } catch (error) {
      console.error('Error calculating event status:', error);
      return EventStatus.UPCOMING; // Default to upcoming on error
    }
  }

  /**
   * Determine if event is editable based on its status
   */
  static isEventEditable(event: Event): boolean {
    return event.status !== EventStatus.COMPLETED;
  }

  /**
   * Determine if event capacity can be modified
   */
  static isCapacityModifiable(event: Event): boolean {
    if (event.status === EventStatus.COMPLETED) {
      return false;
    }
    
    // Can reduce capacity only if new limit >= current registrations
    return true;
  }

  /**
   * Validate capacity modification
   */
  static validateCapacityModification(newLimit: number, currentRegistrations: number): {
    isValid: boolean;
    reason?: string;
  } {
    if (newLimit < currentRegistrations) {
      return {
        isValid: false,
        reason: `Cannot reduce capacity below current registrations (${currentRegistrations})`
      };
    }
    
    if (newLimit <= 0) {
      return {
        isValid: false,
        reason: 'Capacity must be greater than 0'
      };
    }
    
    return { isValid: true };
  }

  /**
   * Check for time conflicts with existing events at the same location
   * Includes error handling for invalid date strings
   */
  static checkTimeConflicts(
    newEvent: { 
      eventStartTime: string; 
      eventEndTime: string; 
      eventLocation: { venueName: string; address: string }; 
      id?: string; 
    },
    existingEvents: Event[]
  ): { hasConflict: boolean; conflicts: Event[] } {
    try {
      const newStart = new Date(newEvent.eventStartTime);
      const newEnd = new Date(newEvent.eventEndTime);
      
      // Validate parsed dates
      if (isNaN(newStart.getTime()) || isNaN(newEnd.getTime())) {
        console.error('Invalid date format for new event times:', { 
          eventStartTime: newEvent.eventStartTime, 
          eventEndTime: newEvent.eventEndTime 
        });
        return { hasConflict: false, conflicts: [] };
      }
      
      const newLocation = newEvent.eventLocation.venueName.toLowerCase();

      const conflicts = existingEvents.filter(event => {
        // Skip same event if updating
        if (newEvent.id && event.id === newEvent.id) {
          return false;
        }

        // Check if same venue
        const eventVenue = event.eventLocation.venueName.toLowerCase();
        if (eventVenue !== newLocation) {
          return false;
        }

        try {
          const existingStart = new Date(event.eventStartTime);
          const existingEnd = new Date(event.eventEndTime);
          
          // Validate existing event dates
          if (isNaN(existingStart.getTime()) || isNaN(existingEnd.getTime())) {
            return false;
          }

          // Check for time overlap
          return (newStart < existingEnd && newEnd > existingStart);
        } catch {
          return false;
        }
      });

      return {
        hasConflict: conflicts.length > 0,
        conflicts
      };
    } catch (error) {
      console.error('Error checking time conflicts:', error);
      return { hasConflict: false, conflicts: [] };
    }
  }

  /**
   * Validate event data for form submission
   */
  static validateEventData(eventData: Partial<Event>): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Required field validations
    if (!eventData.eventName?.trim()) {
      errors.push('Event name is required');
    } else if (eventData.eventName.length > 100) {
      errors.push('Event name must be 100 characters or less');
    }

    if (!eventData.eventLocation?.venueName?.trim()) {
      errors.push('Event venue name is required');
    }

    if (!eventData.eventStartTime) {
      errors.push('Event start time is required');
    } else {
      const startTime = new Date(eventData.eventStartTime);
      const now = new Date();
      if (startTime <= now) {
        errors.push('Event start time must be in the future');
      }
    }

    if (!eventData.eventEndTime) {
      errors.push('Event end time is required');
    } else if (eventData.eventStartTime) {
      const startTime = new Date(eventData.eventStartTime);
      const endTime = new Date(eventData.eventEndTime);
      if (endTime <= startTime) {
        errors.push('Event end time must be after start time');
      }
    }

    if (!eventData.capacity?.maximumAttendeeLimit || eventData.capacity.maximumAttendeeLimit <= 0) {
      errors.push('Event capacity must be greater than 0');
    }

    // Conductor details validation
    if (!eventData.conductorDetails?.primaryOrganizer.name?.trim()) {
      errors.push('Primary organizer name is required');
    }

    if (!eventData.conductorDetails?.primaryOrganizer.email?.trim()) {
      errors.push('Primary organizer email is required');
    }

    // Speaker details validation
    if (eventData.speakers && eventData.speakers.length > 0) {
      eventData.speakers.forEach((speaker, index) => {
        if (!speaker.name?.trim()) {
          errors.push(`Speaker ${index + 1} name is required`);
        }
        if (!speaker.sessionTopic?.trim()) {
          errors.push(`Speaker ${index + 1} session topic is required`);
        }
        if (speaker.sessionDuration <= 0) {
          errors.push(`Speaker ${index + 1} session duration must be greater than 0`);
        }
      });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Generate audit trail entry for event changes
   */
  static generateAuditTrail(
    eventId: string,
    action: EventAuditTrail['action'],
    performedBy: string,
    changes?: EventAuditTrail['changes'],
    notes?: string
  ): EventAuditTrail {
    return {
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      eventId,
      action,
      performedBy,
      timestamp: new Date().toISOString(),
      changes,
      notes
    };
  }

  /**
   * Calculate event duration in hours
   */
  static calculateEventDuration(startTime: string, endTime: string): number {
    const start = new Date(startTime);
    const end = new Date(endTime);
    return (end.getTime() - start.getTime()) / (1000 * 60 * 60);
  }

  /**
   * Get remaining capacity
   */
  static getRemainingCapacity(event: Event): number {
    return Math.max(0, event.capacity.maximumAttendeeLimit - event.capacity.currentRegistrationCount);
  }

  /**
   * Check if event has waitlist
   */
  static hasWaitlist(event: Event): boolean {
    return event.capacity.currentRegistrationCount >= event.capacity.maximumAttendeeLimit;
  }

  /**
   * Format event time display with error handling
   */
  static formatEventTime(dateTimeString: string, timeZone: string = 'IST'): string {
    try {
      const date = new Date(dateTimeString);
      
      // Validate parsed date
      if (isNaN(date.getTime())) {
        console.error('Invalid date format:', dateTimeString);
        return 'Invalid Date';
      }
      
      return date.toLocaleString('en-US', { 
        timeZone,
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      console.error('Error formatting event time:', error);
      return 'Invalid Date';
    }
  }

  /**
   * Get event status display info
   */
  static getEventStatusInfo(status: EventStatus): { 
    display: string; 
    color: string; 
    icon: string; 
  } {
    switch (status) {
      case EventStatus.UPCOMING:
        return { display: 'Upcoming', color: '#007bff', icon: 'calendar-plus' };
      case EventStatus.IN_PROGRESS:
        return { display: 'In Progress', color: '#28a745', icon: 'play-circle' };
      case EventStatus.COMPLETED:
        return { display: 'Completed', color: '#6c757d', icon: 'check-circle' };
      case EventStatus.CANCELLED:
        return { display: 'Cancelled', color: '#dc3545', icon: 'x-circle' };
      default:
        return { display: 'Unknown', color: '#6c757d', icon: 'question-circle' };
    }
  }
}