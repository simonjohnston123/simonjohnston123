import { DriverLoginForm } from "@/components/driver-forms";

export const metadata = { title: "Driver log in" };

export default function DriverLoginPage() {
  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-1 text-2xl font-bold text-slate-900">Driver log in</h1>
      <p className="mb-5 text-sm text-slate-500">Welcome back — log in to see available jobs.</p>
      <DriverLoginForm />
    </div>
  );
}
