const express = require("express");
const http = require("http");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");
const next = require("next");

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = process.env.PORT || 3000;

const nextApp = next({ dev, hostname, port });
const handle = nextApp.getRequestHandler();

const app = express();
const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: "*",
  },
});

const JWT_SECRET =
  process.env.JWT_SECRET || "watch-together-dev-secret";

const uploadsDirectory = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadsDirectory)) {
  fs.mkdirSync(uploadsDirectory, { recursive: true });
}

app.use(express.json());

app.use(
  "/uploads",
  express.static(uploadsDirectory)
);

// ======================================================
// TEMPORARY DATABASE
// ======================================================

const users = new Map();
const rooms = new Map();

// ======================================================
// AUTH
// ======================================================

function createToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
    },
    JWT_SECRET,
    {
      expiresIn: "7d",
    }
  );
}

function authenticate(req, res, nextMiddleware) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "Authentication required",
    });
  }

  const token = header.split(" ")[1];

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    nextMiddleware();
  } catch {
    return res.status(401).json({
      error: "Invalid or expired token",
    });
  }
}

// ======================================================
// REGISTER
// ======================================================

app.post("/api/register", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        error: "Username and password are required",
      });
    }

    if (username.length < 3) {
      return res.status(400).json({
        error: "Username must be at least 3 characters",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: "Password must be at least 6 characters",
      });
    }

    const normalizedUsername =
      username.trim().toLowerCase();

    if (users.has(normalizedUsername)) {
      return res.status(409).json({
        error: "Username already exists",
      });
    }

    const passwordHash =
      await bcrypt.hash(password, 10);

    const user = {
      id: crypto.randomUUID(),
      username: normalizedUsername,
      passwordHash,
    };

    users.set(normalizedUsername, user);

    const token = createToken(user);

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
      },
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Registration failed",
    });
  }
});

// ======================================================
// LOGIN
// ======================================================

app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const normalizedUsername =
      username?.trim().toLowerCase();

    const user = users.get(normalizedUsername);

    if (!user) {
      return res.status(401).json({
        error: "Invalid username or password",
      });
    }

    const valid =
      await bcrypt.compare(
        password,
        user.passwordHash
      );

    if (!valid) {
      return res.status(401).json({
        error: "Invalid username or password",
      });
    }

    const token = createToken(user);

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
      },
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Login failed",
    });
  }
});

// ======================================================
// CURRENT USER
// ======================================================

app.get(
  "/api/me",
  authenticate,
  (req, res) => {
    res.json({
      user: req.user,
    });
  }
);

// ======================================================
// ROOM HELPERS
// ======================================================

function generateRoomCode() {
  const characters =
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  let code;

  do {
    code = "";

    for (let i = 0; i < 6; i++) {
      code +=
        characters[
          Math.floor(
            Math.random() * characters.length
          )
        ];
    }
  } while (rooms.has(code));

  return code;
}

function getRoom(code) {
  return rooms.get(
    String(code).toUpperCase()
  );
}

// ======================================================
// CREATE ROOM
// ======================================================

app.post(
  "/api/rooms",
  authenticate,
  (req, res) => {
    const code = generateRoomCode();

    const room = {
      code,

      hostId: req.user.id,

      video: null,

      isPlaying: false,

      currentTime: 0,

      lastUpdate: Date.now(),

      participants: new Set(),
    };

    rooms.set(code, room);

    res.json({
      code,
    });
  }
);

// ======================================================
// GET ROOM
// ======================================================

app.get(
  "/api/rooms/:code",
  authenticate,
  (req, res) => {
    const room =
      getRoom(req.params.code);

    if (!room) {
      return res.status(404).json({
        error: "Room not found",
      });
    }

    res.json({
      code: room.code,

      hostId: room.hostId,

      video: room.video,

      isPlaying: room.isPlaying,

      currentTime: room.currentTime,

      participantCount:
        room.participants.size,
    });
  }
);

// ======================================================
// VIDEO UPLOAD
// ======================================================

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDirectory);
  },

  filename: (req, file, cb) => {
    const extension =
      path.extname(file.originalname);

    cb(
      null,
      crypto.randomUUID() + extension
    );
  },
});

const upload = multer({
  storage,

  limits: {
    fileSize:
      10 * 1024 * 1024 * 1024,
  },

  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "video/mp4",
      "video/webm",
      "video/ogg",
      "video/x-matroska",
    ];

    const valid =
      allowedTypes.includes(file.mimetype) ||
      /\.(mp4|webm|ogg|mkv)$/i.test(
        file.originalname
      );

    if (!valid) {
      return cb(
        new Error("Unsupported video format")
      );
    }

    cb(null, true);
  },
});

app.post(
  "/api/rooms/:code/video",
  authenticate,
  upload.single("video"),
  (req, res) => {
    try {
      const room =
        getRoom(req.params.code);

      if (!room) {
        return res.status(404).json({
          error: "Room not found",
        });
      }

      if (room.hostId !== req.user.id) {
        return res.status(403).json({
          error:
            "Only the host can upload videos",
        });
      }

      if (!req.file) {
        return res.status(400).json({
          error: "No video uploaded",
        });
      }

      room.video = {
        filename: req.file.filename,

        originalName:
          req.file.originalname,

        url:
          `/uploads/${req.file.filename}`,
      };

      room.isPlaying = false;

      room.currentTime = 0;

      room.lastUpdate = Date.now();

      io.to(room.code).emit(
        "video-loaded",
        {
          video: room.video,
        }
      );

      res.json({
        video: room.video,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error: "Video upload failed",
      });
    }
  }
);

// ======================================================
// SOCKET.IO AUTH
// ======================================================

io.use((socket, next) => {
  try {
    const token =
      socket.handshake.auth?.token;

    if (!token) {
      return next(
        new Error("Authentication required")
      );
    }

    socket.user =
      jwt.verify(token, JWT_SECRET);

    next();
  } catch {
    next(
      new Error("Invalid authentication token")
    );
  }
});

// ======================================================
// SOCKET.IO
// ======================================================

io.on("connection", (socket) => {
  console.log(
    `Connected: ${socket.user.username}`
  );

  // ----------------------------------------------------
  // JOIN ROOM
  // ----------------------------------------------------

  socket.on("join-room", (code) => {
    const room = getRoom(code);

    if (!room) {
      socket.emit(
        "room-error",
        "Room not found"
      );

      return;
    }

    socket.join(room.code);

    room.participants.add(
      socket.id
    );

    socket.roomCode = room.code;

    let currentTime =
      room.currentTime;

    if (room.isPlaying) {
      currentTime +=
        (Date.now() -
          room.lastUpdate) /
        1000;
    }

    socket.emit(
      "room-state",
      {
        video: room.video,

        isPlaying:
          room.isPlaying,

        currentTime,
      }
    );

    io.to(room.code).emit(
      "participants",
      {
        count:
          room.participants.size,
      }
    );
  });

  // ----------------------------------------------------
  // PLAY
  // ----------------------------------------------------

  socket.on(
    "play",
    ({ currentTime }) => {
      const room =
        getRoom(socket.roomCode);

      if (!room) return;

      if (
        room.hostId !==
        socket.user.id
      ) {
        return;
      }

      room.isPlaying = true;

      room.currentTime =
        currentTime;

      room.lastUpdate =
        Date.now();

      socket.to(room.code).emit(
        "play",
        {
          currentTime,

          serverTime:
            Date.now(),
        }
      );
    }
  );

  // ----------------------------------------------------
  // PAUSE
  // ----------------------------------------------------

  socket.on(
    "pause",
    ({ currentTime }) => {
      const room =
        getRoom(socket.roomCode);

      if (!room) return;

      if (
        room.hostId !==
        socket.user.id
      ) {
        return;
      }

      room.isPlaying = false;

      room.currentTime =
        currentTime;

      room.lastUpdate =
        Date.now();

      socket.to(room.code).emit(
        "pause",
        {
          currentTime,
        }
      );
    }
  );

  // ----------------------------------------------------
  // SEEK
  // ----------------------------------------------------

  socket.on(
    "seek",
    ({ currentTime }) => {
      const room =
        getRoom(socket.roomCode);

      if (!room) return;

      if (
        room.hostId !==
        socket.user.id
      ) {
        return;
      }

      room.currentTime =
        currentTime;

      room.lastUpdate =
        Date.now();

      io.to(room.code).emit(
        "seek",
        {
          currentTime,
        }
      );
    }
  );

  // ----------------------------------------------------
  // SYNC
  // ----------------------------------------------------

  socket.on(
    "sync",
    ({ currentTime }) => {
      const room =
        getRoom(socket.roomCode);

      if (!room) return;

      if (
        room.hostId !==
        socket.user.id
      ) {
        return;
      }

      room.currentTime =
        currentTime;

      room.lastUpdate =
        Date.now();

      socket.to(room.code).emit(
        "sync",
        {
          currentTime,

          isPlaying:
            room.isPlaying,
        }
      );
    }
  );

  // ----------------------------------------------------
  // CHAT
  // ----------------------------------------------------

  socket.on(
    "chat-message",
    (message) => {
      const room =
        getRoom(socket.roomCode);

      if (!room) return;

      const cleanMessage =
        String(message)
          .trim()
          .slice(0, 500);

      if (!cleanMessage) return;

      io.to(room.code).emit(
        "chat-message",
        {
          username:
            socket.user.username,

          message:
            cleanMessage,

          timestamp:
            Date.now(),
        }
      );
    }
  );

  // ----------------------------------------------------
  // DISCONNECT
  // ----------------------------------------------------

  socket.on(
    "disconnect",
    () => {
      const room =
        getRoom(socket.roomCode);

      if (!room) return;

      room.participants.delete(
        socket.id
      );

      io.to(room.code).emit(
        "participants",
        {
          count:
            room.participants.size,
        }
      );

      console.log(
        `Disconnected: ${socket.user.username}`
      );
    }
  );
});

// ======================================================
// NEXT.JS + EXPRESS SERVER
// ======================================================

nextApp.prepare().then(() => {
  app.use((req, res) => {
    return handle(req, res);
  });

  httpServer.listen(port, () => {
    console.log("");
    console.log("=================================");
    console.log("🎬 WatchTogether is running!");
    console.log(`🌐 http://localhost:${port}`);
    console.log("=================================");
    console.log("");
  });
});