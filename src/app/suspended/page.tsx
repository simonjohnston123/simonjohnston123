export const metadata = { title: "Account suspended" };

export default function SuspendedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="text-4xl">⏸️</div>
        <h1 className="mt-3 text-xl font-bold text-slate-900">Your account is on hold</h1>
        <p className="mt-2 text-sm text-slate-600">
          Access to PlacidCRM for your business is currently paused. If you think this is a mistake or you&rsquo;d like to
          reactivate, please get in touch with us.
        </p>
        <a href="mailto:hello@placid.group" className="mt-5 inline-block rounded-lg bg-brand-gradient px-5 py-2.5 text-sm font-semibold text-white">
          Contact support
        </a>
      </div>
    </main>
  );
}
