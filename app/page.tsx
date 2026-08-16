"use client";

import { useEffect, useState } from "react";

export default function Home() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [username, setUsername] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) return;

    fetch("/api/me", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((response) => {
        if (!response.ok) {
          localStorage.removeItem("token");
          return null;
        }

        return response.json();
      })
      .then((data) => {
        if (data?.user) {
          setLoggedIn(true);
          setUsername(data.user.username);
        }
      })
      .catch(() => {});
  }, []);

  async function createRoom() {
    const token = localStorage.getItem("token");

    if (!token) {
      window.location.href = "/login";
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Could not create room");
        return;
      }

      window.location.href = `/room/${data.code}`;
    } finally {
      setLoading(false);
    }
  }

  function joinRoom() {
    const code = roomCode.trim().toUpperCase();

    if (!code) return;

    window.location.href = `/room/${code}`;
  }

  function logout() {
    localStorage.removeItem("token");
    window.location.reload();
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <nav className="border-b border-white/10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <a href="/" className="text-2xl font-bold">
            Watch<span className="text-purple-500">Together</span>
          </a>

          {loggedIn ? (
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-400">
                Hi,{" "}
                <span className="font-medium text-white">
                  {username}
                </span>
              </span>

              <button
                onClick={logout}
                className="rounded-lg px-4 py-2 text-sm text-gray-400 hover:bg-white/10 hover:text-white"
              >
                Log out
              </button>
            </div>
          ) : (
            <div className="flex gap-3">
              <a
                href="/login"
                className="rounded-lg px-4 py-2 text-sm hover:bg-white/10"
              >
                Log in
              </a>

              <a
                href="/register"
                className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-gray-200"
              >
                Sign up
              </a>
            </div>
          )}
        </div>
      </nav>

      <section className="flex min-h-[75vh] items-center justify-center px-6">
        <div className="max-w-4xl text-center">
          <div className="mb-6 inline-flex rounded-full border border-purple-500/20 bg-purple-500/10 px-4 py-2 text-sm text-purple-300">
            🎬 Watch together. From anywhere.
          </div>

          <h1 className="text-5xl font-bold leading-tight tracking-tight md:text-7xl">
            Your movie night,
            <br />
            <span className="text-purple-500">
              but together.
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-gray-400">
            Create a private room, invite your friends,
            and watch your own videos together with
            synchronized playback.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <button
              onClick={createRoom}
              disabled={loading}
              className="rounded-xl bg-purple-600 px-8 py-4 font-semibold transition hover:bg-purple-500 disabled:opacity-50"
            >
              {loading
                ? "Creating..."
                : "Create a Room"}
            </button>

            <div className="flex">
              <input
                value={roomCode}
                onChange={(e) =>
                  setRoomCode(e.target.value)
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    joinRoom();
                  }
                }}
                placeholder="ROOM CODE"
                maxLength={6}
                className="w-40 rounded-l-xl border border-white/10 bg-white/5 px-4 py-4 text-center text-sm uppercase outline-none focus:border-purple-500"
              />

              <button
                onClick={joinRoom}
                className="rounded-r-xl bg-white px-6 font-semibold text-black hover:bg-gray-200"
              >
                Join
              </button>
            </div>
          </div>

          {!loggedIn && (
            <p className="mt-6 text-sm text-gray-500">
              Create an account to start a room.
            </p>
          )}
        </div>
      </section>

      <section className="border-t border-white/10">
        <div className="mx-auto grid max-w-6xl gap-6 px-6 py-16 md:grid-cols-3">
          <Feature
            icon="🎥"
            title="High Quality"
            text="Watch your own video files without unnecessary compression."
          />

          <Feature
            icon="⚡"
            title="Synchronized"
            text="Play, pause and seek together in real time."
          />

          <Feature
            icon="💬"
            title="Chat"
            text="Talk with everyone while watching."
          />
        </div>
      </section>
    </main>
  );
}

function Feature({
  icon,
  title,
  text,
}: {
  icon: string;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      <div className="text-3xl">{icon}</div>

      <h2 className="mt-4 text-lg font-semibold">
        {title}
      </h2>

      <p className="mt-2 text-sm leading-6 text-gray-400">
        {text}
      </p>
    </div>
  );
}
