// Public admin login form. Exempted from the middleware auth check.
//
// On submit the server action validates the key and sets the `showside_admin`
// cookie (same cookie the middleware reads). On success we redirect to ?next=
// if it's a safe `/admin/*` path, otherwise to /admin.

import { loginAdmin } from './actions';

export default function AdminLoginPage({
  searchParams,
}: {
  searchParams: { error?: string; next?: string };
}) {
  const hasError = searchParams.error === '1';

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink p-4">
      <form
        action={loginAdmin}
        className="w-full max-w-sm space-y-4 rounded-lg border border-ash bg-smoke p-6"
      >
        <div>
          <h1 className="text-xl font-semibold">Showside admin</h1>
          <p className="mt-1 text-sm text-gray-400">Enter the admin key to continue.</p>
        </div>

        {hasError && (
          <p className="rounded bg-red-900/40 px-3 py-2 text-sm text-red-300">
            Invalid key. Try again.
          </p>
        )}

        <label className="block space-y-1">
          <span className="text-sm text-gray-400">Admin key</span>
          <input
            type="password"
            name="key"
            required
            autoFocus
            autoComplete="current-password"
            className="w-full rounded border border-ash bg-ink px-3 py-2 text-white focus:border-gray-500 focus:outline-none"
          />
        </label>

        {searchParams.next ? (
          <input type="hidden" name="next" value={searchParams.next} />
        ) : null}

        <button
          type="submit"
          className="w-full rounded bg-white px-3 py-2 font-medium text-ink hover:bg-gray-200"
        >
          Sign in
        </button>
      </form>
    </div>
  );
}
