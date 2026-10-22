import { useState } from 'react';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || '';

export default function Lobby({ onJoin }) {
  const [userName, setUserName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [mode, setMode] = useState('choice'); // choice | join | create
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!userName.trim()) {
      setError('Please enter your name');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${SERVER_URL}/rooms/create`, { method: 'POST' });
      const data = await res.json();
      onJoin(data.roomCode, userName.trim());
    } catch {
      setError('Failed to create room. Is the server running?');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!userName.trim()) {
      setError('Please enter your name');
      return;
    }
    if (!roomCode.trim()) {
      setError('Please enter a room code');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${SERVER_URL}/rooms/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomCode: roomCode.trim() }),
      });
      const data = await res.json();
      // Even if room doesn't "exist" yet, joining will create it
      onJoin(data.roomCode, userName.trim());
    } catch {
      setError('Failed to check room. Is the server running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="lobby">
      <div className="lobby-card">
        <span className="emoji-icon">💬</span>
        <h1>Ephemeral Chat</h1>
        <p className="subtitle">
          Messages vanish after 5 minutes of inactivity.
          <br />
          No accounts. No history. Just conversation.
        </p>

        <div className="input-group">
          <input
            type="text"
            placeholder="Your display name"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            maxLength={24}
            onKeyDown={(e) => e.key === 'Enter' && mode === 'join' && handleJoin()}
          />
        </div>

        {mode === 'choice' && (
          <>
            <button className="btn btn-primary" onClick={() => setMode('create')} style={{ marginBottom: 12 }}>
              ✦ Create a Room
            </button>
            <button className="btn btn-secondary" onClick={() => setMode('join')}>
              → Join with Code
            </button>
          </>
        )}

        {mode === 'create' && (
          <>
            <button className="btn btn-primary" onClick={handleCreate} disabled={loading}>
              {loading ? 'Creating…' : '✦ Create Room'}
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => { setMode('choice'); setError(''); }}
              style={{ marginTop: 8 }}
            >
              ← Back
            </button>
          </>
        )}

        {mode === 'join' && (
          <>
            <div className="input-group">
              <input
                className="room-code-input"
                type="text"
                placeholder="ROOM CODE"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase().slice(0, 6))}
                maxLength={6}
                onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                autoFocus
              />
            </div>
            <button className="btn btn-primary" onClick={handleJoin} disabled={loading}>
              {loading ? 'Joining…' : '→ Join Room'}
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => { setMode('choice'); setError(''); }}
              style={{ marginTop: 8 }}
            >
              ← Back
            </button>
          </>
        )}

        {error && (
          <p style={{ color: 'var(--red)', marginTop: 12, fontSize: 13 }}>{error}</p>
        )}
      </div>
    </div>
  );
}
