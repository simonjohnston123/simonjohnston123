import Link from "next/link";

export const metadata = { title: "Data Deletion" };

export default function DataDeletionPage({ searchParams }: { searchParams: { code?: string } }) {
  const code = searchParams.code;

  return (
    <main className="mx-auto max-w-2xl px-6 py-14 text-slate-800">
      <Link href="/" className="text-sm font-medium text-brand-600 hover:underline">← PlacidCRM</Link>
      <h1 className="mt-4 text-3xl font-bold text-slate-900">Data Deletion</h1>

      {code ? (
        <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-5">
          <p className="font-medium text-green-800">Your data deletion request has been received.</p>
          <p className="mt-1 text-sm text-green-700">
            Reference code: <code className="font-mono">{code}</code>. Any data associated with your connected account has
            been removed from PlacidCRM.
          </p>
        </div>
      ) : null}

      <div className="mt-8 space-y-4 text-sm leading-relaxed">
        <p>You can delete the data PlacidCRM holds about you in any of these ways:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Disconnect an integration</strong> — in your PlacidCRM dashboard, open{" "}
            <span className="font-medium">Integrations</span> and click <span className="font-medium">Disconnect</span> on
            the channel. This removes the stored credentials/tokens immediately.
          </li>
          <li>
            <strong>Remove the app from Facebook/Instagram</strong> — in your Meta account settings, remove the PlacidCRM
            app. Meta notifies us and we delete the associated data automatically.
          </li>
          <li>
            <strong>Email us</strong> — send a request to{" "}
            <a href="mailto:privacy@placid.group" className="text-brand-600 hover:underline">privacy@placid.group</a> and
            we&rsquo;ll action it.
          </li>
        </ul>
        <p className="text-slate-500">
          See our <Link href="/privacy" className="text-brand-600 hover:underline">Privacy Policy</Link> for full details.
        </p>
      </div>
    </main>
  );
}
