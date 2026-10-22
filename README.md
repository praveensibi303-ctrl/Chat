# Ephemeral Chat

A real-time chat application where messages vanish after 5 minutes of inactivity. No database, no accounts, no history — just conversation.

## Features

- **Room-based chat** — Create a room and share the 6-character code to invite others
- **Text messaging** — Real-time messages via Socket.IO
- **Image sharing** — Send images up to 5 MB (base64 over WebSocket)
- **Online/offline status** — Live user list with green status dots
- **Typing indicators** — See who's typing in real time
- **Voice & video calling** — Peer-to-peer via WebRTC (STUN-based, works on same network / public IPs)
- **Auto-delete** — All messages are wiped after 5 minutes of inactivity; empty rooms are destroyed
- **Mobile-friendly** — Responsive layout with slide-out sidebar

## Tech Stack

| Layer     | Technology                     |
|-----------|--------------------------------|
| Frontend  | React 18, Vite 5               |
| Backend   | Node.js, Express, Socket.IO 4  |
| Calling   | WebRTC with Google STUN        |
| Storage   | In-memory (Map)                |

## Project Structure

```
ephemeral-chat/
├── server/
│   ├── index.js          # Express + Socket.IO server
│   └── package.json
├── client/
│   ├── index.html
│   ├── vite.config.js
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx
│   │   ├── index.css
│   │   ├── hooks/
│   │   │   ├── useSocket.js
│   │   │   └── useWebRTC.js
│   │   └── components/
│   │       ├── Lobby.jsx
│   │       ├── ChatRoom.jsx
│   │       ├── MessageBubble.jsx
│   │       └── CallOverlay.jsx
│   └── package.json
├── package.json          # Root scripts
└── README.md
```

## Quick Start (Local Development)

### Prerequisites

- Node.js 18+ and npm

### 1. Install dependencies

```bash
cd ephemeral-chat
npm run install:all
```

### 2. Start the development servers

In one terminal — **server** (port 3001):
```bash
cd server
npm run dev
```

In another terminal — **client** (port 5173):
```bash
cd client
npm run dev
```

Open http://localhost:5173 in your browser.

## Production Deployment

### Option A: Single Server (Recommended for simplicity)

Build the client and serve it from the Express server.

**1. Build the client:**
```bash
cd client
npm run build
```

**2. Add static file serving to the server** — add these lines in `server/index.js` before `server.listen(...)`:

```js
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.join(__dirname, '../client/dist')));
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});
```

**3. Start the server:**
```bash
cd server
PORT=8080 npm start
```

Your app is now served at http://localhost:8080.

### Option B: Deploy to a Cloud Platform

#### Railway / Render / Fly.io

1. Use Option A's setup (static serving from Express)
2. Set the root directory to `server/`
3. Build command: `cd ../client && npm install && npm run build`
4. Start command: `node index.js`
5. Set `PORT` environment variable (provided automatically by most platforms)

#### Docker

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Install server deps
COPY server/package*.json ./server/
RUN cd server && npm ci --production

# Install client deps and build
COPY client/package*.json ./client/
RUN cd client && npm ci
COPY client/ ./client/
RUN cd client && npm run build

# Copy server source
COPY server/ ./server/

EXPOSE 3001
CMD ["node", "server/index.js"]
```

> Remember to add the static serving snippet from Option A to `server/index.js`.

### Option C: Separate Frontend / Backend

If deploying the client to Vercel, Netlify, etc.:

1. Set the environment variable `VITE_SERVER_URL` to your backend URL during build:
   ```bash
   VITE_SERVER_URL=https://your-server.example.com npm run build
   ```
2. Deploy `client/dist/` to your static host
3. Deploy `server/` to your backend host
4. Ensure CORS is configured correctly (it accepts `*` by default)

## Environment Variables

| Variable          | Default         | Description                     |
|-------------------|-----------------|---------------------------------|
| `PORT`            | `3001`          | Server port                     |
| `VITE_SERVER_URL` | `""` (proxy)    | Backend URL for production      |

## How It Works

1. **Rooms** — Each room is identified by a 6-character alphanumeric code. Creating a room generates a code; joining sends you to that room's Socket.IO namespace.

2. **Messages** — Stored in a JavaScript `Map` in server memory. Every message (text, image, or system event) resets the room's inactivity timer.

3. **Inactivity cleanup** — When no messages are sent for 5 minutes, the server clears all messages and notifies connected clients. If the room is also empty of users, it's destroyed entirely.

4. **Calling** — WebRTC peer connections are established through the server's signaling relay (Socket.IO). ICE candidates are exchanged through the same channel. Audio/video streams are peer-to-peer once connected.

## Limitations

- **No persistence** — Server restart loses all data (by design)
- **Image size** — Limited to 5 MB per image (base64 encoding increases payload ~33%)
- **WebRTC NAT traversal** — Uses only Google's public STUN servers. For reliable calling across restrictive networks, add a TURN server (e.g., Twilio or coturn)
- **Single-server** — Not horizontally scalable without adding a Socket.IO adapter (e.g., Redis adapter)

## License

MIT
