import { User, UserRole } from '@prisma/client';
import { Request } from 'express';
import { JwtPayload } from 'jsonwebtoken';
import 'express';

declare module 'express' {
  interface Request {
    user?: JwtPayload;
  }
}

export interface RegisterUserDto {
  email: string;
  password: string;
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
  [key: string]: unknown;
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

// If you need to extend Express.Request, use module augmentation in a separate file or here as needed 