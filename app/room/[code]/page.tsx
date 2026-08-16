"use client";

import {
  ChangeEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import { io, Socket } from "socket.io-client";

type Video = {
  filename: string;
  originalName: string;
  url: string;
};

type RoomState = {
  code: string;
  hostId: string;
  video: Video | null;
  isPlaying: boolean;
  currentTime: number;
  participantCount: number;
};

export default function RoomPage() {
  const [roomCode, setRoomCode] = useState("");
  const [video, setVideo] = useState<Video | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

const [chatMessage, setChatMessage] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const socketRef = useRef<Socket | null>(null);

  // Prevent remote events from being sent back to server
  const remoteAction = useRef(false);

  // Get room code
  useEffect(() => {
    const code = window.location.pathname.split("/").pop();

    if (code) {
      setRoomCode(code.toUpperCase());
    }
  }, []);

  // Load existing room state
  useEffect(() => {
    if (!roomCode) return;

    async function loadRoom() {
      const token = localStorage.getItem("token");

      if (!token) {
        setError("You must be logged in.");
        return;
      }

      try {
        const response = await fetch(
          `/api/rooms/${roomCode}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data: RoomState =
          await response.json();

        if (!response.ok) {
          setError(
            (data as any).error ||
              "Could not load room."
          );
          return;
        }

        console.log("Room state:", data);

        if (data.video) {
          setVideo(data.video);
        }
      } catch (error) {
        console.error(error);
        setError(
          "Could not connect to the server."
        );
      }
    }

    loadRoom();
  }, [roomCode]);

  // Connect Socket.IO
  useEffect(() => {
    if (!roomCode) return;

    const token = localStorage.getItem("token");

    if (!token) return;

  const socket = io({
  auth: {
    token,
  },
});

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log(
        "Socket connected:",
        socket.id
      );

      socket.emit("join-room", roomCode);

    // Someone else pressed PLAY
    socket.on(
      "play",
      ({ currentTime }) => {
        const player = videoRef.current;

        if (!player) return;

        console.log(
          "Remote PLAY:",
          currentTime
        );

        remoteAction.current = true;

        player.currentTime = currentTime;

        player
          .play()
          .catch((error) => {
            console.error(
              "Remote play failed:",
              error
            );
          });
      }
    );

    // Someone else pressed PAUSE
    socket.on(
      "pause",
      ({ currentTime }) => {
        const player = videoRef.current;

        if (!player) return;

        console.log(
          "Remote PAUSE:",
          currentTime
        );

        remoteAction.current = true;

        player.currentTime = currentTime;

        player.pause();

        remoteAction.current = false;
      }
    );

    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [roomCode]);

  // Upload video
  async function handleUpload(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) return;

    const token = localStorage.getItem("token");

    if (!token) {
      setError("You must be logged in.");
      return;
    }

    setError("");
    setUploading(true);

    try {
      const formData = new FormData();

      formData.append("video", file);

      const response = await fetch(
        `/api/rooms/${roomCode}/video`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(
          data.error || "Upload failed."
        );
        return;
      }

      setVideo(data.video);
    } catch (error) {
      console.error(error);

      setError(
        "Could not connect to the server."
      );
    } finally {
      setUploading(false);
    }
  }

  // HOST: Play
  function handlePlay() {
    if (remoteAction.current) {
      remoteAction.current = false;
      return;
    }

    const player = videoRef.current;
    const socket = socketRef.current;

    if (!player || !socket) return;

    console.log(
      "Sending PLAY:",
      player.currentTime
    );

    socket.emit("play", {
      currentTime: player.currentTime,
    });
  }

  // HOST: Pause
  function handlePause() {
    if (remoteAction.current) {
      remoteAction.current = false;
      return;
    }

    const player = videoRef.current;
    const socket = socketRef.current;

    if (!player || !socket) return;

    console.log(
      "Sending PAUSE:",
      player.currentTime
    );

    socket.emit("pause", {
      currentTime: player.currentTime,
    });
  }

  return (
    <main className="min-h-screen bg-black p-10 text-white">
      <h1 className="text-4xl font-bold">
        Watch
        <span className="text-purple-500">
          Together
        </span>
      </h1>

      <div className="mt-10 rounded-xl border border-white/10 p-8">
        <h2 className="text-2xl font-bold">
          Room: {roomCode}
        </h2>

        {error && (
          <div className="mt-5 rounded-lg bg-red-500/10 p-4 text-red-400">
            {error}
          </div>
        )}

        {video ? (
          <div className="mt-6">
            <video
              ref={videoRef}
              src={video.url}
              controls
              onPlay={handlePlay}
              onPause={handlePause}
              className="w-full max-w-4xl rounded-xl"
            />

            <p className="mt-3 text-sm text-gray-400">
              {video.originalName}
            </p>
          </div>
        ) : (
          <div className="mt-6">
            <p className="text-gray-400">
              No video uploaded yet.
            </p>

            <label className="mt-5 inline-block cursor-pointer rounded-lg bg-purple-600 px-5 py-3 font-semibold hover:bg-purple-500">
              {uploading
                ? "Uploading..."
                : "📁 Upload Video"}

              <input
                type="file"
                accept="video/*"
                onChange={handleUpload}
                disabled={uploading}
                className="hidden"
              />
            </label>
          </div>
        )}
      </div>
    </main>
  );
}