import { authenticator } from 'otplib';
import QRCode from 'qrcode';

const APP_NAME = 'Oculis';

export async function generateTwoFactorSecret(email: string): Promise<{ secret: string; qrCode: string }> {
  const secret = authenticator.generateSecret();
  const otpauth = authenticator.keyuri(email, APP_NAME, secret);
  const qrCode = await QRCode.toDataURL(otpauth);
  
  return { secret, qrCode };
}

export function verifyTOTP(token: string, secret: string): boolean {
  return authenticator.verify({ token, secret });
} 