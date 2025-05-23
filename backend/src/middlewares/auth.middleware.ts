import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole } from '@prisma/client';
import { hasPermission, hasAllPermissions, hasAnyPermission } from '../config/permissions';
import rateLimit from 'express-rate-limit';
import { CustomUser } from '../types/auth';

// Rate limiting middleware
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      throw new Error('Authentication required');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as CustomUser;
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Authentication failed' });
  }
}

export function authorize(roles: UserRole[]): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const userRole = req.user.role as UserRole;
    if (!roles.includes(userRole)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    return next();
  };
}

// New middleware for permission-based access control
export function requirePermission(permission: string): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const userRole = req.user.role as UserRole;
    if (!hasPermission(userRole, permission)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    return next();
  };
}

export function requireAllPermissions(permissions: string[]): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const userRole = req.user.role as UserRole;
    if (!hasAllPermissions(userRole, permissions)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    return next();
  };
}

export function requireAnyPermission(permissions: string[]): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const userRole = req.user.role as UserRole;
    if (!hasAnyPermission(userRole, permissions)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    return next();
  };
} 