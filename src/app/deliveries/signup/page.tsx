import { DriverSignupForm } from "@/components/driver-forms";

export const metadata = { title: "Sign up to drive" };

export default function DriverSignupPage() {
  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-1 text-2xl font-bold text-slate-900">Sign up to drive</h1>
      <p className="mb-5 text-sm text-slate-500">Create your Placid Deliveries driver account.</p>
      <DriverSignupForm />
    </div>
  );
}
