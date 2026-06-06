import nodemailer from 'nodemailer';
import { env, logger } from '../../config/index.js';

export class EmailService {
  private static transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465, // true for 465, false for other ports (like 587)
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });

  /**
   * Sends a password reset email containing the raw token link.
   * @param to - Recipient email address
   * @param rawToken - The unhashed recovery token
   */
  static async sendPasswordResetEmail(to: string, rawToken: string): Promise<void> {
    const resetUrl = `${env.CORS_ORIGIN}/reset-password?token=${rawToken}`;

    const mailOptions = {
      from: `"Binger Support" <${env.SMTP_USER}>`,
      to,
      subject: 'Recuperar contraseña - Binger',
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 32px; border: 1px solid #e5e7eb; border-radius: 12px; background-color: #ffffff;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h2 style="color: #4f46e5; margin: 0; font-size: 24px; font-weight: 700;">Restablecer Contraseña</h2>
            <p style="color: #6b7280; font-size: 14px; margin-top: 4px;">Binger — Social Series Tracking</p>
          </div>
          
          <p style="font-size: 16px; margin-bottom: 16px;">Hola,</p>
          <p style="font-size: 16px; margin-bottom: 24px;">Recibimos una solicitud para restablecer la contraseña de tu cuenta de Binger. Si fuiste tú, puedes hacerlo haciendo clic en el siguiente enlace:</p>
          
          <div style="text-align: center; margin-bottom: 28px;">
            <a href="${resetUrl}" style="background-color: #4f46e5; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.2);">Restablecer Contraseña</a>
          </div>
          
          <p style="font-size: 14px; color: #4b5563; margin-bottom: 8px;">Este enlace es de un único uso y <strong>expirará en 15 minutos</strong>.</p>
          <p style="font-size: 14px; color: #9ca3af; margin-bottom: 24px;">Si no solicitaste este cambio, puedes ignorar este correo de forma segura. Tu contraseña no cambiará hasta que accedas al enlace y completes el proceso.</p>
          
          <hr style="border: 0; border-top: 1px solid #f3f4f6; margin-bottom: 20px;" />
          
          <div style="text-align: center;">
            <p style="font-size: 12px; color: #9ca3af; margin: 0;">Este es un mensaje automático. Por favor, no respondas a este correo.</p>
            <p style="font-size: 12px; color: #9ca3af; margin: 4px 0 0 0;">&copy; ${new Date().getFullYear()} Binger. Todos los derechos reservados.</p>
          </div>
        </div>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      logger.info(`Password reset email successfully sent to: ${to}`);
    } catch (error) {
      logger.error({ err: error }, `Error sending password reset email to: ${to}`);
      throw error;
    }
  }
}
