export enum EventStatus {
  UPCOMING = 'upcoming',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

export interface SpeakerDetails {
  id: string;
  name: string;
  bio: string;
  credentials: string;
  sessionTopic: string;
  sessionDuration: number; // in minutes
  email: string;
  phone: string;
  specialRequirements?: string[];
  avRequirements?: string;
  seatingRequirements?: string;
}

export interface EventConductorDetails {
  primaryOrganizer: {
    name: string;
    title: string;
    email: string;
    phone: string;
    department: string;
  };
  backupCoordinator: {
    name: string;
    title: string;
    email: string;
    phone: string;
  };
}

export interface EventCapacity {
  maximumAttendeeLimit: number;
  currentRegistrationCount: number;
  waitlistCount: number;
  modificationPermissions: {
    canReduceCapacity: boolean;
    reason?: string;
  };
}

export interface EventDetails {
  mealArrangements: {
    lunch: boolean;
    refreshments: boolean;
    dietaryRestrictions: string[];
    specialDietaryNeeds: string;
  };
  agendaSchedule: {
    timeSlots: Array<{
      startTime: string;
      endTime: string;
      activity: string;
      presenter?: string;
    }>;
  };
  specialRequirements: string[];
  equipmentNeeds: string[];
  parkingInformation: string;
  additionalNotes?: string;
}

export interface EventAuditTrail {
  id: string;
  eventId: string;
  action: 'created' | 'updated' | 'deleted' | 'status_changed' | 'capacity_updated';
  performedBy: string;
  timestamp: string;
  changes?: {
    field: string;
    oldValue: any;
    newValue: any;
  }[];
  notes?: string;
}

export interface Event {
  id: string;
  eventName: string;
  eventLocation: {
    venueName: string;
    address: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
  };
  eventStartTime: string; // ISO 8601 with timezone
  eventEndTime: string; // ISO 8601 with timezone
  eventDetails: EventDetails;
  conductorDetails: EventConductorDetails;
  speakers: SpeakerDetails[];
  capacity: EventCapacity;
  status: EventStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  auditTrail: EventAuditTrail[];
  
  // Additional computed fields
  isEditable: boolean;
  isCapacityModifiable: boolean;
  timeZone: string;
}

export interface EventFilters {
  status?: EventStatus[];
  dateRange?: {
    start: string;
    end: string;
  };
  location?: string;
  organizer?: string;
  searchTerm?: string;
  capacityRange?: {
    min: number;
    max: number;
  };
}

export interface EventFormData {
  eventName: string;
  eventLocation: {
    venueName: string;
    address: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  eventStartTime: string;
  eventEndTime: string;
  eventDetails: EventDetails;
  conductorDetails: EventConductorDetails;
  speakers: Omit<SpeakerDetails, 'id'>[];
  capacity: {
    maximumAttendeeLimit: number;
  };
  timeZone: string;
}

export interface EventValidationErrors {
  eventName?: string;
  eventLocation?: string;
  eventStartTime?: string;
  eventEndTime?: string;
  eventDetails?: string;
  conductorDetails?: string;
  speakers?: string;
  capacity?: string;
  general?: string[];
}

// Permission-based event access control
export enum EventPermission {
  VIEW = 'view',
  CREATE = 'create',
  EDIT = 'edit',
  DELETE = 'delete',
  MANAGE_CAPACITY = 'manage_capacity',
  VIEW_ATTENDEES = 'view_attendees',
  EXPORT_DATA = 'export_data',
  MANAGE_STATUS = 'manage_status'
}

export interface EventAccessControl {
  userId: string;
  permissions: EventPermission[];
  grantedBy: string;
  grantedAt: string;
  expiresAt?: string;
}

export interface EventRolePermissions {
  role: 'admin' | 'user' | 'organizer' | 'attendee';
  permissions: EventPermission[];
}

// Define default permissions for different roles
export const EVENT_ROLE_PERMISSIONS: Record<string, EventRolePermissions[]> = {
  admin: [
    {
      role: 'admin',
      permissions: [
        EventPermission.VIEW,
        EventPermission.CREATE,
        EventPermission.EDIT,
        EventPermission.DELETE,
        EventPermission.MANAGE_CAPACITY,
        EventPermission.VIEW_ATTENDEES,
        EventPermission.EXPORT_DATA,
        EventPermission.MANAGE_STATUS
      ]
    }
  ],
  user: [
    {
      role: 'user',
      permissions: [
        EventPermission.VIEW,
        EventPermission.CREATE,
        EventPermission.EDIT,
        EventPermission.MANAGE_CAPACITY,
        EventPermission.VIEW_ATTENDEES,
        EventPermission.EXPORT_DATA,
        EventPermission.MANAGE_STATUS
      ]
    }
  ],
  organizer: [
    {
      role: 'organizer',
      permissions: [
        EventPermission.VIEW,
        EventPermission.EDIT,
        EventPermission.VIEW_ATTENDEES
      ]
    }
  ],
  attendee: [
    {
      role: 'attendee',
      permissions: [
        EventPermission.VIEW
      ]
    }
  ]
};

// Helper function to check if user has specific permission
export function hasEventPermission(
  userRole: string, 
  permission: EventPermission,
  rolePermissions: Record<string, EventRolePermissions[]> = EVENT_ROLE_PERMISSIONS
): boolean {
  const roleConfig = rolePermissions[userRole];
  if (!roleConfig) return false;
  
  return roleConfig.some(config => config.permissions.includes(permission));
}

// Helper function to get all permissions for a role
export function getEventPermissionsForRole(
  userRole: string,
  rolePermissions: Record<string, EventRolePermissions[]> = EVENT_ROLE_PERMISSIONS
): EventPermission[] {
  const roleConfig = rolePermissions[userRole];
  if (!roleConfig) return [];
  
  return roleConfig.flatMap(config => config.permissions);
}