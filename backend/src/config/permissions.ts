import { UserRole } from '@prisma/client';

// Define all possible permissions in the system
export const Permissions = {
  // User management
  CREATE_USER: 'create:user',
  READ_USER: 'read:user',
  UPDATE_USER: 'update:user',
  DELETE_USER: 'delete:user',
  LIST_USERS: 'list:users',
  
  // Property management
  CREATE_PROPERTY: 'create:property',
  READ_PROPERTY: 'read:property',
  UPDATE_PROPERTY: 'update:property',
  DELETE_PROPERTY: 'delete:property',
  LIST_PROPERTIES: 'list:properties',
  
  // File management
  UPLOAD_FILE: 'upload:file',
  READ_FILE: 'read:file',
  DELETE_FILE: 'delete:file',
  SHARE_FILE: 'share:file',
  
  // Analytics
  VIEW_ANALYTICS: 'view:analytics',
  EXPORT_ANALYTICS: 'export:analytics',
  
  // Settings
  MANAGE_SETTINGS: 'manage:settings',
} as const;

// Define permission sets for each role
export const RolePermissions: Record<UserRole, string[]> = {
  ADMIN: Object.values(Permissions),
  AGENT: [
    Permissions.READ_USER,
    Permissions.CREATE_PROPERTY,
    Permissions.READ_PROPERTY,
    Permissions.UPDATE_PROPERTY,
    Permissions.LIST_PROPERTIES,
    Permissions.UPLOAD_FILE,
    Permissions.READ_FILE,
    Permissions.SHARE_FILE,
    Permissions.VIEW_ANALYTICS,
    Permissions.EXPORT_ANALYTICS,
  ],
  USER: [
    Permissions.READ_PROPERTY,
    Permissions.LIST_PROPERTIES,
    Permissions.READ_FILE,
  ],
};

// Helper function to check if a role has a specific permission
export function hasPermission(role: UserRole, permission: string): boolean {
  return RolePermissions[role].includes(permission);
}

// Helper function to check if a role has all specified permissions
export function hasAllPermissions(role: UserRole, permissions: string[]): boolean {
  return permissions.every(permission => hasPermission(role, permission));
}

// Helper function to check if a role has any of the specified permissions
export function hasAnyPermission(role: UserRole, permissions: string[]): boolean {
  return permissions.some(permission => hasPermission(role, permission));
} 