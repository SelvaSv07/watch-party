"use client";
import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import io from "socket.io-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// Replace this with your Socket.IO server URL
const SOCKET_SERVER_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL ||
  "https://your-socketio-server.onrender.com";

export default function Room() {
  const { roomId } = useParams();
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [users, setUsers] = useState([]);
  const [mediaUrl, setMediaUrl] = useState("");
  const [currentMedia, setCurrentMedia] = useState("");
  const [mediaType, setMediaType] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isHost, setIsHost] = useState(false);
  const [screenStream, setScreenStream] = useState(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [connectionError, setConnectionError] = useState(false);

  const videoRef = useRef(null);
  const screenVideoRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    // Connect to external Socket.IO server
    const socketInstance = io(SOCKET_SERVER_URL, {
      transports: ["websocket", "polling"],
      timeout: 20000,
    });

    setSocket(socketInstance);

    socketInstance.on("connect", () => {
      setIsConnected(true);
      setConnectionError(false);
      socketInstance.emit("join-room", roomId);
    });

    socketInstance.on("connect_error", (error) => {
      console.error("Socket connection error:", error);
      setConnectionError(true);
      setIsConnected(false);
    });

    socketInstance.on("disconnect", () => {
      setIsConnected(false);
    });

    socketInstance.on("room-joined", (data) => {
      setUsers(data.users);
      setIsHost(data.isHost);
      if (data.currentMedia) {
        setCurrentMedia(data.currentMedia.url);
        setMediaType(data.currentMedia.type);
        setIsPlaying(data.currentMedia.isPlaying);
        setCurrentTime(data.currentMedia.currentTime);
      }
    });

    socketInstance.on("users-updated", (users) => {
      setUsers(users);
    });

    socketInstance.on("media-changed", (media) => {
      setCurrentMedia(media.url);
      setMediaType(media.type);
      setIsPlaying(false);
      setCurrentTime(0);
    });

    socketInstance.on("play-pause", (data) => {
      setIsPlaying(data.isPlaying);
      setCurrentTime(data.currentTime);
      if (videoRef.current) {
        videoRef.current.currentTime = data.currentTime;
        if (data.isPlaying) {
          videoRef.current.play();
        } else {
          videoRef.current.pause();
        }
      }
    });

    socketInstance.on("seek", (time) => {
      setCurrentTime(time);
      if (videoRef.current) {
        videoRef.current.currentTime = time;
      }
    });

    return () => socketInstance.close();
  }, [roomId]);

  const shareMedia = () => {
    if (mediaUrl.trim() && socket) {
      const type = getMediaType(mediaUrl);
      socket.emit("share-media", { roomId, url: mediaUrl, type });
      setMediaUrl("");
    }
  };

  const uploadFile = (event) => {
    const file = event.target.files[0];
    if (file && socket) {
      const url = URL.createObjectURL(file);
      const type = file.type.startsWith("video/") ? "video" : "image";
      socket.emit("share-media", { roomId, url, type });
    }
  };

  const togglePlayPause = () => {
    if (socket && videoRef.current) {
      const newIsPlaying = !isPlaying;
      const time = videoRef.current.currentTime;
      socket.emit("play-pause", {
        roomId,
        isPlaying: newIsPlaying,
        currentTime: time,
      });
    }
  };

  const handleSeek = (event) => {
    if (socket && isHost) {
      const time = parseFloat(event.target.value);
      socket.emit("seek", { roomId, currentTime: time });
    }
  };

  const startScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });
      setScreenStream(stream);
      setIsScreenSharing(true);

      if (screenVideoRef.current) {
        screenVideoRef.current.srcObject = stream;
      }

      stream.getVideoTracks()[0].onended = () => {
        stopScreenShare();
      };
    } catch (error) {
      console.error("Error starting screen share:", error);
    }
  };

  const stopScreenShare = () => {
    if (screenStream) {
      screenStream.getTracks().forEach((track) => track.stop());
      setScreenStream(null);
      setIsScreenSharing(false);
      if (screenVideoRef.current) {
        screenVideoRef.current.srcObject = null;
      }
    }
  };

  const getMediaType = (url) => {
    if (url.match(/\.(mp4|webm|ogg)$/i)) return "video";
    if (url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) return "image";
    if (url.includes("youtube.com") || url.includes("youtu.be"))
      return "youtube";
    return "video";
  };

  const getYouTubeEmbedUrl = (url) => {
    const videoId = url.match(
      /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/
    );
    return videoId ? `https://www.youtube.com/embed/${videoId[1]}` : url;
  };

  if (connectionError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <h2 className="text-xl font-semibold text-red-600 mb-2">
              Connection Error
            </h2>
            <p className="text-gray-600 mb-4">
              Unable to connect to the watch party server. Please check your
              internet connection and try again.
            </p>
            <p className="text-sm text-gray-500">
              Server URL: {SOCKET_SERVER_URL}
            </p>
            <Button onClick={() => window.location.reload()} className="mt-4">
              Retry Connection
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto">
        <Card className="mb-4">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Room: {roomId}</CardTitle>
              <div className="flex space-x-2">
                <Badge variant={isConnected ? "default" : "destructive"}>
                  {isConnected ? "Connected" : "Disconnected"}
                </Badge>
                {connectionError && (
                  <Badge variant="destructive">Server Error</Badge>
                )}
              </div>
            </div>
            <div className="flex space-x-2">
              {users.map((user, index) => (
                <Badge key={index} variant="outline">
                  User {index + 1} {user.isHost && "(Host)"}
                </Badge>
              ))}
            </div>
          </CardHeader>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <Card>
              <CardContent className="p-4">
                {isScreenSharing && (
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold mb-2">Screen Share</h3>
                    <video
                      ref={screenVideoRef}
                      className="w-full h-64 bg-black rounded"
                      autoPlay
                      muted
                    />
                    <Button onClick={stopScreenShare} className="mt-2">
                      Stop Screen Share
                    </Button>
                  </div>
                )}

                {currentMedia && (
                  <div className="media-container">
                    {mediaType === "video" && (
                      <div>
                        <video
                          ref={videoRef}
                          src={currentMedia}
                          className="w-full h-64 bg-black rounded"
                          controls={isHost}
                          onPlay={() =>
                            socket?.emit("play-pause", {
                              roomId,
                              isPlaying: true,
                              currentTime: videoRef.current?.currentTime || 0,
                            })
                          }
                          onPause={() =>
                            socket?.emit("play-pause", {
                              roomId,
                              isPlaying: false,
                              currentTime: videoRef.current?.currentTime || 0,
                            })
                          }
                          onSeeked={() =>
                            socket?.emit("seek", {
                              roomId,
                              currentTime: videoRef.current?.currentTime || 0,
                            })
                          }
                        />
                        {!isHost && (
                          <div className="flex items-center space-x-2 mt-2">
                            <Button onClick={togglePlayPause}>
                              {isPlaying ? "Pause" : "Play"}
                            </Button>
                          </div>
                        )}
                      </div>
                    )}

                    {mediaType === "image" && (
                      <img
                        src={currentMedia}
                        alt="Shared content"
                        className="w-full h-64 object-contain bg-black rounded"
                      />
                    )}

                    {mediaType === "youtube" && (
                      <iframe
                        src={getYouTubeEmbedUrl(currentMedia)}
                        className="w-full h-64 rounded"
                        allowFullScreen
                      />
                    )}
                  </div>
                )}

                {!currentMedia && !isScreenSharing && (
                  <div className="h-64 bg-gray-200 rounded flex items-center justify-center">
                    <p className="text-gray-500">No media shared yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Share Media</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex space-x-2">
                  <Input
                    placeholder="Paste video/image URL"
                    value={mediaUrl}
                    onChange={(e) => setMediaUrl(e.target.value)}
                  />
                  <Button onClick={shareMedia} disabled={!isConnected}>
                    Share
                  </Button>
                </div>

                <div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={uploadFile}
                    accept="video/*,image/*"
                    className="hidden"
                  />
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full"
                    disabled={!isConnected}
                  >
                    Upload File
                  </Button>
                </div>

                <Button
                  onClick={isScreenSharing ? stopScreenShare : startScreenShare}
                  className="w-full"
                  variant={isScreenSharing ? "destructive" : "default"}
                  disabled={!isConnected}
                >
                  {isScreenSharing ? "Stop Screen Share" : "Share Screen"}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Room Info</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">
                  Share this room ID with friends: <strong>{roomId}</strong>
                </p>
                <p className="text-sm text-gray-600 mt-2">
                  {users.length} user{users.length !== 1 ? "s" : ""} connected
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Server: {isConnected ? "Online" : "Offline"}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
