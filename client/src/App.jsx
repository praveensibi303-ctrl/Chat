import { useState } from 'react';
import Lobby from './components/Lobby.jsx';
import ChatRoom from './components/ChatRoom.jsx';
import useSocket from './hooks/useSocket.js';
import useWebRTC from './hooks/useWebRTC.js';

export default function App() {
  const [roomCode, setRoomCode] = useState(null);
  const [userName, setUserName] = useState('');
  const socket = useSocket();
  const webrtc = useWebRTC(socket);

  const handleJoin = (code, name) => {
    setRoomCode(code);
    setUserName(name);
  };

  if (!roomCode) {
    return <Lobby onJoin={handleJoin} />;
  }

  return (
    <ChatRoom
      roomCode={roomCode}
      userName={userName}
      socket={socket}
      webrtc={webrtc}
    />
  );
}
