import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-4 text-center">
      <div className="text-5xl font-bold text-slate-300">404</div>
      <p className="text-slate-600">This page could not be found.</p>
      <Link href="/" className="btn-primary">Back to home</Link>
    </div>
  );
}
