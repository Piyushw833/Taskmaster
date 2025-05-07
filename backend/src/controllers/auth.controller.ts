import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { RegisterUserDto, LoginUserDto } from '../types/auth';
import { UserRole } from '@prisma/client';

export class AuthController {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  async register(req: Request, res: Response): Promise<Response | void> {
    try {
      const userData: RegisterUserDto = req.body;
      const result = await this.authService.register(userData);
      return res.status(201).json(result);
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      } else {
        return res.status(500).json({ message: 'Internal server error' });
      }
    }
  }

  async login(req: Request, res: Response): Promise<Response | void> {
    try {
      const loginData: LoginUserDto = req.body;
      const result = await this.authService.login(loginData);
      return res.status(200).json(result);
    } catch (error) {
      if (error instanceof Error) {
        return res.status(401).json({ message: error.message });
      } else {
        return res.status(500).json({ message: 'Internal server error' });
      }
    }
  }

  async setup2FA(req: Request, res: Response): Promise<Response | void> {
    try {
      const { userId } = req.user!;
      const result = await this.authService.setup2FA(userId);
      return res.status(200).json(result);
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      } else {
        return res.status(500).json({ message: 'Internal server error' });
      }
    }
  }

  async verify2FA(req: Request, res: Response): Promise<Response | void> {
    try {
      const { userId, token } = req.body;
      if (!userId || !token) {
        return res.status(400).json({ message: 'User ID and token are required' });
      }

      const result = await this.authService.verify2FA(userId, token);
      return res.status(200).json(result);
    } catch (error) {
      if (error instanceof Error) {
        return res.status(401).json({ message: error.message });
      } else {
        return res.status(500).json({ message: 'Internal server error' });
      }
    }
  }

  async disable2FA(req: Request, res: Response): Promise<Response | void> {
    try {
      const { userId } = req.user!;
      await this.authService.disable2FA(userId);
      return res.status(200).json({ message: '2FA disabled successfully' });
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      } else {
        return res.status(500).json({ message: 'Internal server error' });
      }
    }
  }

  async listUsers(_req: Request, res: Response): Promise<Response | void> {
    try {
      const users = await this.authService.listUsers();
      return res.status(200).json(users);
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      } else {
        return res.status(500).json({ message: 'Internal server error' });
      }
    }
  }

  async updateUserRole(_req: Request, res: Response): Promise<Response | void> {
    try {
      const { id } = _req.params;
      const { role } = _req.body;
      
      if (!Object.values(UserRole).includes(role)) {
        return res.status(400).json({ message: 'Invalid role' });
      }

      await this.authService.updateUserRole(id, role);
      return res.status(200).json({ message: 'User role updated successfully' });
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      } else {
        return res.status(500).json({ message: 'Internal server error' });
      }
    }
  }
} 