"use client";

import Link from "next/link";
import { useFormState } from "react-dom";
import { registerAction } from "../actions";
import { SubmitButton } from "@/components/submit-button";

export default function RegisterPage() {
  const [state, formAction] = useFormState(registerAction, { error: "" } as { error: string });

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">Set up Placid Connect</h1>
      <p className="mt-1 text-sm text-slate-500">Create the owner account for your platform.</p>

      <form action={formAction} className="mt-6 space-y-4">
        <div>
          <label className="label" htmlFor="agencyName">Company / agency name</label>
          <input id="agencyName" name="agencyName" required className="input" placeholder="Placid Group" defaultValue="Placid Group" />
        </div>
        <div>
          <label className="label" htmlFor="name">Your name</label>
          <input id="name" name="name" required className="input" placeholder="Simon Johnston" />
        </div>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" required className="input" placeholder="you@placid.com" />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} className="input" placeholder="At least 8 characters" />
        </div>
        {state?.error ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
        ) : null}
        <SubmitButton>Create account</SubmitButton>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        Already set up?{" "}
        <Link href="/login" className="font-medium text-brand-600 hover:underline">Sign in</Link>
      </p>
    </div>
  );
}
