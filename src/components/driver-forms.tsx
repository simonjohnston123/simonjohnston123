"use client";

import Link from "next/link";
import { useFormState } from "react-dom";
import { SubmitButton } from "@/components/submit-button";
import { signupDriverAction, loginDriverAction } from "@/app/deliveries/actions";

const INIT = { error: "" };

export function DriverSignupForm() {
  const [state, action] = useFormState(signupDriverAction, INIT);
  return (
    <form action={action} className="card space-y-4 p-6">
      <div>
        <label className="label" htmlFor="name">Full name</label>
        <input id="name" name="name" required className="input" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required className="input" />
        </div>
        <div>
          <label className="label" htmlFor="phone">Mobile</label>
          <input id="phone" name="phone" className="input" />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="vehicle">Vehicle (optional)</label>
        <input id="vehicle" name="vehicle" className="input" placeholder="e.g. Van, ute, car" />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input id="password" name="password" type="password" required className="input" placeholder="8+ characters" />
      </div>
      {state?.error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p> : null}
      <SubmitButton className="btn-primary w-full">Create driver account</SubmitButton>
      <p className="text-center text-sm text-slate-500">
        Already driving? <Link href="/deliveries/login" className="text-brand-600 hover:underline">Log in</Link>
      </p>
    </form>
  );
}

export function DriverLoginForm() {
  const [state, action] = useFormState(loginDriverAction, INIT);
  return (
    <form action={action} className="card space-y-4 p-6">
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required className="input" />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input id="password" name="password" type="password" required className="input" />
      </div>
      {state?.error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p> : null}
      <SubmitButton className="btn-primary w-full">Log in</SubmitButton>
      <p className="text-center text-sm text-slate-500">
        New driver? <Link href="/deliveries/signup" className="text-brand-600 hover:underline">Sign up</Link>
      </p>
    </form>
  );
}
