import { PrismaClient, UserRole, User } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { RegisterUserDto, LoginUserDto, AuthResponse } from '../types/auth';
import { generateTwoFactorSecret, verifyTOTP } from '../utils/twoFactor';

export class AuthService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async register(userData: RegisterUserDto): Promise<AuthResponse> {
    // Validate password policy
    this.validatePassword(userData.password);
    
    // Check if user exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: userData.email }
    });

    if (existingUser) {
      throw new Error('Email already registered');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(userData.password, 12);
    
    // Create user
    const user = await this.prisma.user.create({
      data: {
        email: userData.email,
        password: hashedPassword,
        name: userData.firstName ? userData.firstName : userData.email, // fallback to email if no name
        role: userData.role || UserRole.USER
      }
    });

    // Generate JWT
    const token = this.generateToken(user);
    
    return {
      user,
      token
    };
  }

  async login(loginData: LoginUserDto): Promise<AuthResponse> {
    // Find user
    const user = await this.prisma.user.findUnique({
      where: { email: loginData.email }
    });

    if (!user || !user.isActive) {
      throw new Error('Invalid credentials');
    }

    // Verify password
    const isValid = await bcrypt.compare(loginData.password, user.password);
    if (!isValid) {
      throw new Error('Invalid credentials');
    }

    // Check if 2FA is enabled
    if (user.isTwoFactorEnabled) {
      return {
        user,
        token: '',
        requiresTwoFactor: true
      };
    }

    // Generate JWT
    const token = this.generateToken(user);

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });

    return {
      user,
      token
    };
  }

  async setup2FA(userId: string): Promise<{ secret: string; qrCode: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new Error('User not found');
    }

    if (user.isTwoFactorEnabled) {
      throw new Error('2FA is already enabled');
    }

    const { secret, qrCode } = await generateTwoFactorSecret(user.email);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorSecret: secret,
        isTwoFactorEnabled: false // Will be enabled after verification
      }
    });

    return { secret, qrCode };
  }

  async verify2FA(userId: string, token: string): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user?.twoFactorSecret) {
      throw new Error('2FA not set up for this user');
    }

    const isValid = verifyTOTP(token, user.twoFactorSecret);
    if (!isValid) {
      throw new Error('Invalid 2FA token');
    }

    // If this is the first verification, enable 2FA
    if (!user.isTwoFactorEnabled) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { isTwoFactorEnabled: true }
      });
    }

    // Generate JWT after successful 2FA
    const jwtToken = this.generateToken(user);

    // Update last login
    await this.prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() }
    });

    return {
      user,
      token: jwtToken
    };
  }

  async disable2FA(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new Error('User not found');
    }

    if (!user.isTwoFactorEnabled) {
      throw new Error('2FA is not enabled');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        isTwoFactorEnabled: false,
        twoFactorSecret: null
      }
    });
  }

  async listUsers(): Promise<Partial<User>[]> {
    const users = await this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        isTwoFactorEnabled: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true
      }
    });

    return users;
  }

  async updateUserRole(userId: string, role: UserRole): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new Error('User not found');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { role }
    });
  }

  private generateToken(user: { id: string; email: string; role: UserRole }) {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET not configured');
    }

    return jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role
      },
      secret,
      { expiresIn: '1d' }
    );
  }

  private validatePassword(password: string) {
    if (password.length < 10) {
      throw new Error('Password must be at least 10 characters long');
    }
    if (!/[A-Z]/.test(password)) {
      throw new Error('Password must contain at least one uppercase letter');
    }
    if (!/[0-9]/.test(password)) {
      throw new Error('Password must contain at least one number');
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      throw new Error('Password must contain at least one special character');
    }
  }
} 