import Link from "next/link";

export const metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-14 text-slate-800">
      <Link href="/" className="text-sm font-medium text-brand-600 hover:underline">← PlacidCRM</Link>
      <h1 className="mt-4 text-3xl font-bold text-slate-900">Terms of Service</h1>
      <p className="mt-2 text-sm text-slate-500">Last updated: 29 July 2026</p>

      <div className="mt-8 space-y-5 text-sm leading-relaxed">
        <p>
          These terms govern your use of PlacidCRM, operated by <strong>Placid Group Australia Pty Ltd</strong>
          (ABN 22 695 488 674). By creating an account or using the service, you agree to them.
        </p>

        <h2 className="text-lg font-semibold text-slate-900">The service</h2>
        <p>PlacidCRM is an all-in-one CRM platform (contacts, inbox, automations, calendars, websites and integrations) provided on a subscription basis.</p>

        <h2 className="text-lg font-semibold text-slate-900">Your account</h2>
        <p>You&rsquo;re responsible for your account, your users, and the data you put into the platform, and for keeping your credentials secure.</p>

        <h2 className="text-lg font-semibold text-slate-900">Acceptable use</h2>
        <p>
          You agree not to use PlacidCRM to send spam or unlawful content, to breach any third-party platform&rsquo;s rules
          (including Meta, Google, Twilio and email anti-spam laws), or to infringe others&rsquo; rights. You must have the
          necessary consent to message the contacts you import.
        </p>

        <h2 className="text-lg font-semibold text-slate-900">Third-party integrations</h2>
        <p>
          When you connect an external account (e.g. Facebook, Instagram, Gmail, Twilio, Stripe), your use of that channel is
          also subject to the provider&rsquo;s terms. You authorise us to access it only as needed to provide the features you
          enable, and you can disconnect at any time.
        </p>

        <h2 className="text-lg font-semibold text-slate-900">Fees</h2>
        <p>Paid plans are billed as described at sign-up. Some connected services (e.g. SMS, email volume) may incur provider costs that are your responsibility where you bring your own account.</p>

        <h2 className="text-lg font-semibold text-slate-900">Disclaimers &amp; liability</h2>
        <p>
          The service is provided &ldquo;as is&rdquo;. To the extent permitted by law, Placid excludes implied warranties and
          limits its liability. Nothing in these terms excludes rights you have under the Australian Consumer Law.
        </p>

        <h2 className="text-lg font-semibold text-slate-900">Termination</h2>
        <p>You may cancel any time. We may suspend or terminate accounts that breach these terms.</p>

        <h2 className="text-lg font-semibold text-slate-900">Governing law</h2>
        <p>These terms are governed by the laws of Queensland, Australia.</p>

        <h2 className="text-lg font-semibold text-slate-900">Contact</h2>
        <p><a href="mailto:hello@placid.group" className="text-brand-600 hover:underline">hello@placid.group</a></p>
      </div>
    </main>
  );
}
