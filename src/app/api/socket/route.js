import { Server } from "socket.io";

const rooms = new Map();

export async function GET(request) {
  return new Response("Socket.IO server running", { status: 200 });
}

let io;

export function setupSocketServer(server) {
  if (!io) {
    io = new Server(server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
    });

    io.on("connection", (socket) => {
      console.log("User connected:", socket.id);

      socket.on("join-room", (roomId) => {
        socket.join(roomId);

        if (!rooms.has(roomId)) {
          rooms.set(roomId, {
            users: [],
            currentMedia: null,
            host: socket.id,
          });
        }

        const room = rooms.get(roomId);
        const user = {
          id: socket.id,
          isHost: room.host === socket.id,
        };

        room.users.push(user);

        socket.emit("room-joined", {
          users: room.users,
          isHost: user.isHost,
          currentMedia: room.currentMedia,
        });

        socket.to(roomId).emit("users-updated", room.users);
      });

      socket.on("share-media", (data) => {
        const { roomId, url, type } = data;
        const room = rooms.get(roomId);

        if (room) {
          room.currentMedia = { url, type, isPlaying: false, currentTime: 0 };
          io.to(roomId).emit("media-changed", { url, type });
        }
      });

      socket.on("play-pause", (data) => {
        const { roomId, isPlaying, currentTime } = data;
        const room = rooms.get(roomId);

        if (room && room.currentMedia) {
          room.currentMedia.isPlaying = isPlaying;
          room.currentMedia.currentTime = currentTime;
          socket.to(roomId).emit("play-pause", { isPlaying, currentTime });
        }
      });

      socket.on("seek", (data) => {
        const { roomId, currentTime } = data;
        const room = rooms.get(roomId);

        if (room && room.currentMedia) {
          room.currentMedia.currentTime = currentTime;
          socket.to(roomId).emit("seek", currentTime);
        }
      });

      socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);

        rooms.forEach((room, roomId) => {
          room.users = room.users.filter((user) => user.id !== socket.id);

          if (room.users.length === 0) {
            rooms.delete(roomId);
          } else {
            if (room.host === socket.id) {
              room.host = room.users[0].id;
              room.users[0].isHost = true;
            }
            io.to(roomId).emit("users-updated", room.users);
          }
        });
      });
    });
  }
  return io;
}
