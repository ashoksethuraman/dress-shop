import * as logger from "firebase-functions/logger";
import nodemailer from "nodemailer";

export type OrderEmailEvent = "payment_success" | "payment_failed" | "payment_cancelled";

interface OrderEmailItem {
  title?: string;
  qty?: number;
  unitPrice?: number;
  total?: number;
  size?: string | null;
}

interface OrderEmailAddress {
  name?: string;
  line1?: string;
  line2?: string | null;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
  phone?: string;
}

export interface OrderEmailPayload {
  orderId: string;
  isGuest?: boolean;
  contactEmail?: string | null;
  userEmail?: string | null;
  totalAmount?: number;
  paymentId?: string | null;
  paymentStatus?: string | null;
  orderStatus?: string | null;
  items?: OrderEmailItem[];
  billingAddress?: OrderEmailAddress;
  shippingAddress?: OrderEmailAddress;
  createdAt?: string | null;
}

const smtpHost = process.env.MAIL_SMTP_HOST ?? "";
const smtpPort = Number(process.env.MAIL_SMTP_PORT ?? "587");
const smtpSecure = (process.env.MAIL_SMTP_SECURE ?? "false").toLowerCase() === "true";
const smtpUser = process.env.MAIL_SMTP_USER ?? "";
const smtpPass = process.env.MAIL_SMTP_PASS ?? "";
const mailFromName = process.env.MAIL_FROM_NAME ?? "Halley Comet";
const mailFromEmail = process.env.MAIL_FROM_EMAIL ?? "";
const appBaseUrl = process.env.APP_BASE_URL ?? "";
const mailAdminEmails = process.env.MAIL_ADMIN_EMAILS ?? "";

let cachedTransporter: nodemailer.Transporter | null = null;

function isMailConfigured(): boolean {
  return !!(smtpHost && smtpPort && smtpUser && smtpPass && mailFromEmail);
}

function getTransporter(): nodemailer.Transporter | null {
  if (!isMailConfigured()) return null;
  if (cachedTransporter) return cachedTransporter;
  cachedTransporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });
  return cachedTransporter;
}

function pickRecipient(order: OrderEmailPayload): string | null {
  const email = order.isGuest
    ? (order.contactEmail ?? order.userEmail ?? null)
    : (order.userEmail ?? order.contactEmail ?? null);
  return typeof email === "string" && email.trim().length > 0 ? email.trim() : null;
}

function getAdminRecipients(): string[] {
  return mailAdminEmails
    .split(",")
    .map((e) => e.trim())
    .filter((e) => e.length > 0);
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatAddress(addr?: OrderEmailAddress): string {
  if (!addr) return "-";
  const lines = [
    addr.name,
    addr.line1,
    addr.line2 ?? undefined,
    [addr.city, addr.state, addr.pincode].filter(Boolean).join(", "),
    addr.country,
    addr.phone ? `Phone: ${addr.phone}` : undefined,
  ].filter((x): x is string => !!x && x.trim().length > 0);
  return lines.length > 0 ? lines.map((x) => escapeHtml(x)).join("<br/>") : "-";
}

function eventTitle(event: OrderEmailEvent): {subjectPrefix: string; heading: string; message: string} {
  if (event === "payment_success") {
    return {
      subjectPrefix: "Payment Successful",
      heading: "Thank you for your order",
      message: "Your payment was successful and your order is confirmed.",
    };
  }
  if (event === "payment_cancelled") {
    return {
      subjectPrefix: "Payment Cancelled",
      heading: "Payment was cancelled",
      message: "We received your order request but payment was cancelled before completion.",
    };
  }
  return {
    subjectPrefix: "Payment Failed",
    heading: "Payment failed",
    message: "We received your order request, but payment could not be completed.",
  };
}

function buildItemsTable(items: OrderEmailItem[] | undefined): string {
  if (!items || items.length === 0) return "<p>No line items found.</p>";
  const rows = items.map((item) => {
    const qty = Number(item.qty ?? 0);
    const unit = Number(item.unitPrice ?? 0);
    const total = Number(item.total ?? qty * unit);
    const size = item.size ? ` (${escapeHtml(item.size)})` : "";
    return `
      <tr>
        <td style=\"padding:8px;border-bottom:1px solid #eee;\">${escapeHtml(item.title ?? "Item")}${size}</td>
        <td style=\"padding:8px;border-bottom:1px solid #eee;text-align:center;\">${qty}</td>
        <td style=\"padding:8px;border-bottom:1px solid #eee;text-align:right;\">INR ${unit.toFixed(2)}</td>
        <td style=\"padding:8px;border-bottom:1px solid #eee;text-align:right;\">INR ${total.toFixed(2)}</td>
      </tr>
    `;
  }).join("");

  return `
    <table style=\"width:100%;border-collapse:collapse;margin-top:8px;\">
      <thead>
        <tr>
          <th style=\"text-align:left;padding:8px;border-bottom:2px solid #ddd;\">Item</th>
          <th style=\"text-align:center;padding:8px;border-bottom:2px solid #ddd;\">Qty</th>
          <th style=\"text-align:right;padding:8px;border-bottom:2px solid #ddd;\">Unit Price</th>
          <th style=\"text-align:right;padding:8px;border-bottom:2px solid #ddd;\">Total</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function buildHtml(event: OrderEmailEvent, order: OrderEmailPayload): string {
  const meta = eventTitle(event);
  const trackUrl = appBaseUrl ? `${appBaseUrl.replace(/\/$/, "")}/shipping` : "";
  const totalAmount = Number(order.totalAmount ?? 0);

  return `
    <div style=\"font-family:Arial,sans-serif;line-height:1.5;color:#1f2937;max-width:700px;margin:0 auto;\">
      <h2 style=\"margin-bottom:4px;\">${escapeHtml(meta.heading)}</h2>
      <p style=\"margin-top:0;color:#4b5563;\">${escapeHtml(meta.message)}</p>

      <div style=\"background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px;margin:14px 0;\">
        <p style=\"margin:4px 0;\"><strong>Order ID:</strong> ${escapeHtml(order.orderId)}</p>
        <p style=\"margin:4px 0;\"><strong>Payment Status:</strong> ${escapeHtml(order.paymentStatus ?? "PENDING")}</p>
        <p style=\"margin:4px 0;\"><strong>Order Status:</strong> ${escapeHtml(order.orderStatus ?? "PENDING")}</p>
        <p style=\"margin:4px 0;\"><strong>Payment ID:</strong> ${escapeHtml(order.paymentId ?? "-")}</p>
        <p style=\"margin:4px 0;\"><strong>Total Amount:</strong> INR ${totalAmount.toFixed(2)}</p>
      </div>

      <h3 style=\"margin-bottom:8px;\">Order Items</h3>
      ${buildItemsTable(order.items)}

      <div style=\"display:flex;gap:16px;flex-wrap:wrap;margin-top:16px;\">
        <div style=\"flex:1 1 300px;background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:10px;\">
          <p style=\"margin:0 0 6px 0;font-weight:bold;\">Billing Address</p>
          <p style=\"margin:0;color:#4b5563;\">${formatAddress(order.billingAddress)}</p>
        </div>
        <div style=\"flex:1 1 300px;background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:10px;\">
          <p style=\"margin:0 0 6px 0;font-weight:bold;\">Shipping Address</p>
          <p style=\"margin:0;color:#4b5563;\">${formatAddress(order.shippingAddress ?? order.billingAddress)}</p>
        </div>
      </div>

      ${trackUrl ? `<p style=\"margin-top:16px;\">Track your order: <a href=\"${escapeHtml(trackUrl)}\">${escapeHtml(trackUrl)}</a></p>` : ""}

      <p style=\"margin-top:16px;color:#4b5563;\">Thank you for shopping with Halley Comet.</p>
    </div>
  `;
}

export async function sendOrderEmail(event: OrderEmailEvent, order: OrderEmailPayload): Promise<void> {
  const recipient = pickRecipient(order);
  const adminRecipients = getAdminRecipients();

  const transporter = getTransporter();
  if (!transporter) {
    logger.warn("[mail] skipped: SMTP not configured", {orderId: order.orderId, event, recipient, adminRecipients});
    return;
  }

  const meta = eventTitle(event);
  const subject = `${meta.subjectPrefix} - Order ${order.orderId}`;
  const html = buildHtml(event, order);

  if (recipient) {
    await transporter.sendMail({
      from: `${mailFromName} <${mailFromEmail}>`,
      to: recipient,
      subject,
      html,
    });
    logger.info("[mail] sent", {orderId: order.orderId, event, recipient});
  } else {
    logger.warn("[mail] user mail skipped: no recipient email", {orderId: order.orderId, event});
  }

  const adminSubject = `[Admin Copy] ${subject}`;
  for (const adminEmail of adminRecipients) {
    if (recipient && adminEmail.toLowerCase() === recipient.toLowerCase()) continue;
    await transporter.sendMail({
      from: `${mailFromName} <${mailFromEmail}>`,
      to: adminEmail,
      subject: adminSubject,
      html,
    });
    logger.info("[mail] admin copy sent", {orderId: order.orderId, event, adminEmail});
  }
}
