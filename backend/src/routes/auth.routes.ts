import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authenticate, requirePermission, authRateLimiter } from '../middlewares/auth.middleware';
import { Permissions } from '../config/permissions';

const router = Router();
const authController = new AuthController();

// Apply rate limiting to all auth routes
router.use(authRateLimiter);

// Public routes
router.post('/register', (req, res) => authController.register(req, res));
router.post('/login', (req, res) => authController.login(req, res));
router.post('/verify-2fa', (req, res) => authController.verify2FA(req, res));

// Protected routes
router.post('/setup-2fa', authenticate, (req, res) => authController.setup2FA(req, res));
router.post('/disable-2fa', authenticate, (req, res) => authController.disable2FA(req, res));

// Admin-only routes
router.get('/users', 
  authenticate, 
  requirePermission(Permissions.LIST_USERS),
  (req, res) => authController.listUsers(req, res)
);

router.post('/users/:id/role', 
  authenticate,
  requirePermission(Permissions.UPDATE_USER),
  (req, res) => authController.updateUserRole(req, res)
);

export default router; 