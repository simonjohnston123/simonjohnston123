import Link from "next/link";

export const metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-14 text-slate-800">
      <Link href="/" className="text-sm font-medium text-brand-600 hover:underline">← Placid Connect</Link>
      <h1 className="mt-4 text-3xl font-bold text-slate-900">Privacy Policy</h1>
      <p className="mt-2 text-sm text-slate-500">Last updated: 29 July 2026</p>

      <div className="prose mt-8 space-y-5 text-sm leading-relaxed">
        <p>
          Placid Connect is operated by <strong>Placid Group Australia Pty Ltd</strong> (ABN 22 695 488 674) (&ldquo;Placid&rdquo;,
          &ldquo;we&rdquo;, &ldquo;us&rdquo;). This policy explains what we collect, how we use it, and your rights. It
          applies to placidcrm.com and the Placid Connect platform.
        </p>

        <h2 className="text-lg font-semibold text-slate-900">Information we collect</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>Account data</strong> — your name, email, password (hashed) and business details.</li>
          <li><strong>Business/CRM data you enter</strong> — contacts, conversations, pipelines, tasks, calendar events and notes for your business.</li>
          <li><strong>Connected-account data</strong> — when you connect a channel (e.g. Facebook, Instagram, Gmail, Twilio), we store the access tokens or credentials needed to operate that connection. These are <strong>encrypted at rest</strong> and used only to provide the features you enabled.</li>
          <li><strong>Usage &amp; device data</strong> — basic logs needed to run and secure the service.</li>
        </ul>

        <h2 className="text-lg font-semibold text-slate-900">How we use it</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>To provide the CRM, inbox, automations and integrations you use.</li>
          <li>To send messages (email/SMS/social) on your instruction, through the providers you connect.</li>
          <li>To secure, support and improve the service.</li>
        </ul>
        <p>We do <strong>not</strong> sell your personal information.</p>

        <h2 className="text-lg font-semibold text-slate-900">Third-party services</h2>
        <p>
          We use trusted processors to deliver features, including Resend (email), Twilio (SMS), Meta (Facebook/Instagram),
          Google, Stripe (payments), and cloud hosting. When you connect one of these, its use is also governed by that
          provider&rsquo;s terms. We only access what a connection needs to function.
        </p>

        <h2 className="text-lg font-semibold text-slate-900">Data retention &amp; security</h2>
        <p>
          We keep your data while your account is active and as required by law. Secrets and access tokens are encrypted
          (AES-256-GCM). Access is restricted and transmitted over HTTPS.
        </p>

        <h2 className="text-lg font-semibold text-slate-900">Your rights &amp; data deletion</h2>
        <p>
          You can access, correct or delete your data. To request deletion, disconnect the relevant integration in your
          dashboard, or visit our <Link href="/data-deletion" className="text-brand-600 hover:underline">Data Deletion</Link>{" "}
          page, or email us. If you connected via Facebook/Instagram, you can also remove the app from your Meta account and
          our deauthorize and data-deletion callbacks will remove the associated data.
        </p>

        <h2 className="text-lg font-semibold text-slate-900">Contact</h2>
        <p>
          Placid Group Australia Pty Ltd — <a href="mailto:privacy@placid.group" className="text-brand-600 hover:underline">privacy@placid.group</a>. Queensland, Australia.
        </p>
      </div>
    </main>
  );
}
