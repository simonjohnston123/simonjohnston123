// Client-safe catalogue of connectable integrations. No secrets here — just how
// each provider is presented and connected in the Integrations tab.

export type ProviderKey =
  | "GMAIL"
  | "OUTLOOK"
  | "SMTP"
  | "FACEBOOK"
  | "INSTAGRAM"
  | "GOOGLE_BUSINESS"
  | "WHATSAPP"
  | "TWILIO"
  | "STRIPE"
  | "GOOGLE_CALENDAR";

// "oauth"  → click-to-connect via the provider (needs a Placid dev app + approval)
// "apikey" → the client pastes their own credentials (works today, no approval)
export type ConnectType = "oauth" | "apikey";

export type ApiKeyField = { key: string; label: string; placeholder?: string; secret?: boolean };

export type ProviderDef = {
  key: ProviderKey;
  name: string;
  icon: string;
  category: "Email" | "Messaging" | "Social" | "Payments" | "Calendar";
  blurb: string;
  connectType: ConnectType;
  // For apikey providers: the fields the client fills in.
  fields?: ApiKeyField[];
  // OAuth providers are only live once Placid's app for them is configured.
  ready: boolean;
};

export const PROVIDERS: ProviderDef[] = [
  {
    key: "TWILIO",
    name: "Twilio SMS",
    icon: "💬",
    category: "Messaging",
    blurb: "Send & receive SMS with your own Twilio number.",
    connectType: "apikey",
    ready: true,
    fields: [
      { key: "accountSid", label: "Account SID", placeholder: "AC…" },
      { key: "authToken", label: "Auth Token", placeholder: "••••••••", secret: true },
      { key: "fromNumber", label: "From (number or sender ID)", placeholder: "+61… or PLACID" },
    ],
  },
  {
    key: "SMTP",
    name: "Email (SMTP)",
    icon: "✉️",
    category: "Email",
    blurb: "Send email through your own mailbox/SMTP server.",
    connectType: "apikey",
    ready: true,
    fields: [
      { key: "host", label: "SMTP host", placeholder: "smtp.yourhost.com" },
      { key: "port", label: "Port", placeholder: "587" },
      { key: "username", label: "Username", placeholder: "you@business.com" },
      { key: "password", label: "Password", placeholder: "••••••••", secret: true },
      { key: "fromEmail", label: "From address", placeholder: "you@business.com" },
    ],
  },
  {
    key: "GMAIL",
    name: "Gmail",
    icon: "📧",
    category: "Email",
    blurb: "Two-way sync with your Google Workspace / Gmail inbox.",
    connectType: "oauth",
    ready: false,
  },
  {
    key: "OUTLOOK",
    name: "Outlook",
    icon: "📨",
    category: "Email",
    blurb: "Two-way sync with your Microsoft 365 / Outlook inbox.",
    connectType: "oauth",
    ready: false,
  },
  {
    key: "FACEBOOK",
    name: "Facebook Messenger",
    icon: "📘",
    category: "Social",
    blurb: "Reply to your Facebook Page messages from the inbox.",
    connectType: "oauth",
    ready: false,
  },
  {
    key: "INSTAGRAM",
    name: "Instagram DMs",
    icon: "📷",
    category: "Social",
    blurb: "Manage Instagram direct messages in one place.",
    connectType: "oauth",
    ready: false,
  },
  {
    key: "WHATSAPP",
    name: "WhatsApp",
    icon: "🟢",
    category: "Messaging",
    blurb: "Two-way WhatsApp Business messaging.",
    connectType: "oauth",
    ready: false,
  },
  {
    key: "GOOGLE_BUSINESS",
    name: "Google Business",
    icon: "🔎",
    category: "Social",
    blurb: "Reviews & posts for your Google Business Profile.",
    connectType: "oauth",
    ready: false,
  },
  {
    key: "GOOGLE_CALENDAR",
    name: "Google Calendar",
    icon: "📅",
    category: "Calendar",
    blurb: "Sync bookings with your Google Calendar.",
    connectType: "oauth",
    ready: false,
  },
  {
    key: "STRIPE",
    name: "Stripe",
    icon: "💳",
    category: "Payments",
    blurb: "Connect your own Stripe account to take card payments, subscriptions and invoices.",
    connectType: "apikey",
    ready: true,
    fields: [
      { key: "secretKey", label: "Secret key", placeholder: "sk_live_… or rk_live_…", secret: true },
      { key: "publishableKey", label: "Publishable key", placeholder: "pk_live_…" },
    ],
  },
];

export function providerDef(key: string): ProviderDef | undefined {
  return PROVIDERS.find((p) => p.key === key);
}
