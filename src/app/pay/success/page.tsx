export const metadata = { title: "Payment received" };

export default function PaySuccessPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-6 text-center">
      <div className="max-w-md">
        <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-green-100 text-3xl">✓</div>
        <h1 className="text-2xl font-bold text-slate-900">Payment received</h1>
        <p className="mt-2 text-slate-600">
          Thank you — your payment was successful. You can close this page. A receipt has been emailed to you by Stripe.
        </p>
      </div>
    </main>
  );
}
