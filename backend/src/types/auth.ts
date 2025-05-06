import { User, UserRole } from '@prisma/client';
import { Request } from 'express';
import { JwtPayload } from 'jsonwebtoken';

export interface RegisterUserDto {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: UserRole;
  requiresTwoFactor?: boolean;
}

export interface LoginUserDto {
  email: string;
  password: string;
  twoFactorToken?: string;
}

// Define custom user type that extends JwtPayload
export interface CustomUser extends JwtPayload {
  id: string;
  role: UserRole;
  email: string;
  [key: string]: any;
}

// Extend Express Request type for authenticated routes
export interface AuthenticatedRequest extends Request {
  user: CustomUser;
  file?: Express.Multer.File;
}

export interface AuthResponse {
  user: User;
  token: string;
  requiresTwoFactor?: boolean;
}

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
} 