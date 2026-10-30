import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendOrderConfirmationEmail(
  customerEmail: string,
  orderNumber: string,
): Promise<void> {
  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to: customerEmail,
    subject: `Order confirmation – ${orderNumber}`,
    html: `
      <h1>Thank you for your order!</h1>
      <p>Your order <strong>${orderNumber}</strong> has been confirmed.</p>
      <p>We'll keep you updated on its status.</p>
    `,
  });

  if (error) {
    throw new Error(
      `Failed to send order confirmation email: ${error.message}`,
    );
  }
}
