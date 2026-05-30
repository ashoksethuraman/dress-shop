import * as logger from "firebase-functions/logger";
import nodemailer from "nodemailer";

export type OrderEmailEvent =
  | "payment_success"
  | "payment_failed"
  | "payment_cancelled";

interface OrderEmailItem {
  title?: string;
  qty?: number;
  unitPrice?: number;
  total?: number;
  size?: string | null;
  ageSize?: string | null;
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
  amount: number;
  paymentId?: string | null;
  paymentStatus?: string | null;
  orderStatus?: string | null;
  items?: OrderEmailItem[];
  billingAddress?: OrderEmailAddress;
  shippingAddress?: OrderEmailAddress;
}

const smtpHost = process.env.MAIL_SMTP_HOST ?? "";
const smtpPort = Number(process.env.MAIL_SMTP_PORT ?? "587");
const smtpSecure = (process.env.MAIL_SMTP_SECURE ?? "false") === "true";
const smtpUser = process.env.MAIL_SMTP_USER ?? "";
const smtpPass = process.env.MAIL_SMTP_PASS ?? "";
const mailFromEmail = process.env.MAIL_FROM_EMAIL ?? "";
const mailFromName = process.env.MAIL_FROM_NAME ?? "Halley Comet";
const appBaseUrl = "https://halleycomet.in/shipping";
const adminEmail = "halleycomet.business@gmail.com";

let cachedTransporter: nodemailer.Transporter | null = null;

// ----------------- Email Setup -----------------
function isMailConfigured() {
  return !!(smtpHost && smtpUser && smtpPass && mailFromEmail);
}

function getTransporter() {
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

// ----------------- Build Email -----------------
function eventMeta(event: OrderEmailEvent) {
  switch (event) {
  case "payment_success":
    return {
      subject: "Payment Successful",
      heading: "Thank you for your order",
      message: "Your payment was successful and your order is confirmed.",
    };
  case "payment_cancelled":
    return {
      subject: "Payment Cancelled",
      heading: "Payment was cancelled",
      message: "We received your order request but payment was cancelled.",
    };
  default:
    return {
      subject: "Payment Failed",
      heading: "Payment failed",
      message: "Your payment attempt failed.",
    };
  }
}

function addrHtml(addr?: OrderEmailAddress) {
  if (!addr) return "-";
  return [addr.name, addr.line1, addr.line2, `${addr.city}, ${addr.state} ${addr.pincode}`, addr.country, addr.phone && `Phone: ${addr.phone}`]
    .filter(Boolean)
    .map((v) => `${v}`.trim())
    .join("<br/>");
}

function itemsTable(items?: OrderEmailItem[]) {
  if (!items?.length) return "<p>No items found</p>";

  return `
    <table style="width:100%;border-collapse:collapse;margin-top:10px;">
      ${items
    .map(
      (i) => `
        <tr>
          <td style="padding:6px;border-bottom:1px solid #eee;">
            ${i.title}${i.size ? ` (Size: ${i.size})` : ""}${i.ageSize ? ` (Age: ${i.ageSize} years)` : ""}
          </td>
          <td style="padding:6px;text-align:center;border-bottom:1px solid #eee;">${i.qty}</td>
          <td style="padding:6px;text-align:right;border-bottom:1px solid #eee;">INR ${i.unitPrice?.toFixed(2)}</td>
          <td style="padding:6px;text-align:right;border-bottom:1px solid #eee;">INR ${(i.total ?? (i.qty ?? 0) * (i.unitPrice ?? 0)).toFixed(2)}</td>
        </tr>`
    )
    .join("")}
    </table>
  `;
}

function buildHtml(event: OrderEmailEvent, o: OrderEmailPayload) {
  const meta = eventMeta(event);

  return `
  <div style="font-family:Arial;color:#222;">
    <h2>${meta.heading}</h2>
    <p>${meta.message}</p>

    <div style="background:#f7f7f7;padding:10px;border-radius:8px;margin:15px 0;">
      <p><strong>Order ID:</strong> ${o.orderId}</p>
      <p><strong>Payment Status:</strong> ${o.paymentStatus}</p>
      <p><strong>Order Status:</strong> ${o.orderStatus}</p>
      <p><strong>Payment ID:</strong> ${o.paymentId}</p>
      <p><strong>Total Amount:</strong> INR ${o.totalAmount?.toFixed(2)}</p>
    </div>

    <h3>Order Items</h3>
    ${itemsTable(o.items)}

    <h3>Billing Address</h3>
    ${addrHtml(o.billingAddress)}

    <h3 style="margin-top:10px;">Shipping Address</h3>
    ${addrHtml(o.shippingAddress)}

    <p style="margin-top:20px;">
      <a href="${appBaseUrl}/shipping">Track your order</a>
    </p>
  </div>`;
}

// ----------------- SEND EMAIL -----------------
export async function sendOrderEmail(
  event: OrderEmailEvent,
  order: OrderEmailPayload
) {
  const transporter = getTransporter();
  if (!transporter) {
    logger.error("Email not configured");
    return;
  }

  const recipient =
    order.isGuest ? order.contactEmail || order.userEmail : order.userEmail || order.contactEmail;

  if (!recipient) {
    logger.error("No customer email available");
    return;
  }

  const html = buildHtml(event, order);
  const meta = eventMeta(event);

  await transporter.sendMail({
    from: `"${mailFromName}" <${mailFromEmail}>`,
    to: recipient,
    bcc: adminEmail,
    subject: `${meta.subject} – ${order.orderId}`,
    html,
  });

  logger.info("Email sent:", order.orderId);
}
