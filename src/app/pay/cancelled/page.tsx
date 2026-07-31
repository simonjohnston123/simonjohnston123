export const metadata = { title: "Payment cancelled" };

export default function PayCancelledPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-6 text-center">
      <div className="max-w-md">
        <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-slate-200 text-3xl">↩</div>
        <h1 className="text-2xl font-bold text-slate-900">Payment cancelled</h1>
        <p className="mt-2 text-slate-600">No payment was taken. You can close this page, or ask for a new link to try again.</p>
      </div>
    </main>
  );
}
