import { useState, useEffect, useRef, useCallback } from 'react';
import MessageBubble from './MessageBubble.jsx';
import CallOverlay from './CallOverlay.jsx';

export default function ChatRoom({ roomCode, userName, socket, webrtc }) {
  const { connected, emit, on, getSocketId } = socket;
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [inputText, setInputText] = useState('');
  const [typingUsers, setTypingUsers] = useState({});
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const [cleared, setCleared] = useState(false);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);
  const joinedRef = useRef(false);

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Join room on mount
  useEffect(() => {
    if (!connected || joinedRef.current) return;
    joinedRef.current = true;

    emit('room:join', { roomCode, userName }, (response) => {
      if (response?.success) {
        setMessages(response.messages || []);
        setUsers(response.users || []);
        setTimeout(scrollToBottom, 100);
      }
    });
  }, [connected, roomCode, userName, emit, scrollToBottom]);

  // Socket listeners
  useEffect(() => {
    const unsubs = [
      on('message:new', (msg) => {
        setMessages((prev) => [...prev, msg]);
        setCleared(false);
        setTimeout(scrollToBottom, 50);
      }),
      on('users:update', (userList) => {
        setUsers(userList);
      }),
      on('typing:update', ({ userId, userName: name, isTyping }) => {
        setTypingUsers((prev) => {
          const next = { ...prev };
          if (isTyping) next[userId] = name;
          else delete next[userId];
          return next;
        });
      }),
      on('messages:cleared', () => {
        setMessages([]);
        setCleared(true);
      }),
    ];

    return () => unsubs.forEach((u) => typeof u === 'function' && u());
  }, [on, scrollToBottom]);

  // Send message
  const sendMessage = () => {
    const text = inputText.trim();
    if (!text) return;
    emit('message:send', { content: text });
    setInputText('');
    emit('typing:stop');
  };

  // Handle typing
  const handleInputChange = (e) => {
    setInputText(e.target.value);
    emit('typing:start');
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => emit('typing:stop'), 2000);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Image upload
  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be under 5 MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      emit('message:image', { dataUrl: reader.result, fileName: file.name });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Typing text
  const typingNames = Object.values(typingUsers);
  let typingText = '';
  if (typingNames.length === 1) typingText = `${typingNames[0]} is typing…`;
  else if (typingNames.length === 2) typingText = `${typingNames.join(' and ')} are typing…`;
  else if (typingNames.length > 2) typingText = 'Several people are typing…';

  const myId = getSocketId();

  return (
    <div className="chat-container">
      {/* Sidebar backdrop (mobile) */}
      {sidebarOpen && (
        <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h2>Room</h2>
          <div className="room-code-display">{roomCode}</div>
        </div>

        <div className="sidebar-section" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <h3>Online — {users.length}</h3>
          <ul className="user-list">
            {users.map((u) => (
              <li key={u.id} className={`user-item ${u.id === myId ? 'is-me' : ''}`}>
                <span className="status-dot" />
                <span className="user-name">{u.name}</span>
                {u.id === myId ? (
                  <span className="you-badge">You</span>
                ) : (
                  <div className="call-buttons">
                    <button
                      className="call-btn"
                      title="Voice call"
                      onClick={() => webrtc.startCall(u.id, 'voice')}
                    >
                      📞
                    </button>
                    <button
                      className="call-btn"
                      title="Video call"
                      onClick={() => webrtc.startCall(u.id, 'video')}
                    >
                      📹
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className="sidebar-footer">
          <button
            className="btn btn-secondary"
            onClick={() => window.location.reload()}
            style={{ fontSize: 13 }}
          >
            Leave Room
          </button>
        </div>
      </aside>

      {/* Main chat */}
      <main className="chat-main">
        <div className="chat-header">
          <div className="chat-header-left">
            <button className="menu-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
              ☰
            </button>
            <div>
              <h2>Ephemeral Chat</h2>
              <span className="user-count">{users.length} online · {roomCode}</span>
            </div>
          </div>
        </div>

        <div className="messages-container">
          {cleared && (
            <div className="cleared-notice">
              <span>🗑️</span>
              Messages cleared after inactivity
            </div>
          )}

          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              isMine={msg.sender === myId}
              onImageClick={setLightboxSrc}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="typing-indicator">{typingText}</div>

        <div className="chat-input-area">
          <div className="chat-input-row">
            <label className="image-upload-label" title="Send image">
              📷
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                style={{ display: 'none' }}
              />
            </label>
            <textarea
              className="chat-input"
              placeholder="Type a message…"
              value={inputText}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              rows={1}
            />
            <button
              className="send-btn"
              onClick={sendMessage}
              disabled={!inputText.trim()}
              title="Send"
            >
              ➤
            </button>
          </div>
        </div>
      </main>

      {/* Lightbox */}
      {lightboxSrc && (
        <div className="lightbox" onClick={() => setLightboxSrc(null)}>
          <img src={lightboxSrc} alt="Full size" />
        </div>
      )}

      {/* Call overlay */}
      {webrtc.callState !== 'idle' && (
        <CallOverlay webrtc={webrtc} />
      )}
    </div>
  );
}
