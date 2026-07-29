"use client";

import Link from "next/link";
import { useFormState } from "react-dom";
import { loginAction } from "../actions";

export default function LoginPage() {
  const [state, action] = useFormState(loginAction, { error: "" } as { error: string });
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-12">
      <div className="w-full rounded-2xl bg-white p-7 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Log in to Placid Connect</h1>
        <form action={action} className="mt-5 space-y-3">
          <div><label className="label">Email</label><input name="email" type="email" required className="input" placeholder="you@email.com" /></div>
          <div><label className="label">Password</label><input name="password" type="password" required className="input" /></div>
          {state?.error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p> : null}
          <button className="w-full rounded-lg bg-brand-gradient py-2.5 font-semibold text-white">Log in</button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-500">New here? <Link href="/connect/join" className="font-semibold text-brand-600">Join free</Link></p>
      </div>
    </div>
  );
}
