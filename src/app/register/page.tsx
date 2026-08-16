"use client";

import { FormEvent, useState } from "react";

export default function RegisterPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function register(e: FormEvent) {
    e.preventDefault();

    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Registration failed");
        return;
      }

      localStorage.setItem("token", data.token);

      window.location.href = "/";
    } catch {
      setError("Could not connect to the server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-6 text-white">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <a href="/" className="text-2xl font-bold">
            Watch<span className="text-purple-500">Together</span>
          </a>
        </div>

        <form
          onSubmit={register}
          className="rounded-2xl border border-white/10 bg-white/[0.03] p-8"
        >
          <h1 className="text-3xl font-bold">
            Create account
          </h1>

          <p className="mt-2 text-gray-400">
            Create your WatchTogether account.
          </p>

          {error && (
            <div className="mt-6 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <label className="mt-6 block text-sm font-medium">
            Username
          </label>

          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter username"
            minLength={3}
            required
            className="mt-2 w-full rounded-lg border border-white/10 bg-black px-4 py-3 outline-none transition focus:border-purple-500"
          />

          <label className="mt-5 block text-sm font-medium">
            Password
          </label>

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
            minLength={6}
            required
            className="mt-2 w-full rounded-lg border border-white/10 bg-black px-4 py-3 outline-none transition focus:border-purple-500"
          />

          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full rounded-lg bg-purple-600 py-3 font-semibold transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create Account"}
          </button>

          <p className="mt-6 text-center text-sm text-gray-400">
            Already have an account?{" "}
            <a
              href="/login"
              className="text-purple-400 hover:text-purple-300"
            >
              Log in
            </a>
          </p>
        </form>
      </div>
    </main>
  );
}