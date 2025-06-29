"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  const [roomId, setRoomId] = useState("");
  const router = useRouter();

  const createRoom = () => {
    const newRoomId = uuidv4();
    router.push(`/room/${newRoomId}`);
  };

  const joinRoom = () => {
    if (roomId.trim()) {
      router.push(`/room/${roomId}`);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">Watch Party</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={createRoom} className="w-full">
            Create New Room
          </Button>
          <div className="flex space-x-2">
            <Input
              placeholder="Enter Room ID"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
            />
            <Button onClick={joinRoom}>Join</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
