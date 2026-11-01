# TOMO — Real-Time Collaborative Workspace & Whiteboard Platform

<div align="center">

**Modern, privacy-first collaborative workspaces combining live Excalidraw whiteboards, real-time presentation broadcasting, ephemeral low-latency team chat, bilateral friend networks, and Dark / Light modes.**

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Excalidraw](https://img.shields.io/badge/Whiteboard-Excalidraw-6965DB?logo=excalidraw&logoColor=white)](https://excalidraw.com/)
[![Socket.IO](https://img.shields.io/badge/Real--Time-Socket.IO_v4-010101?logo=socket.io&logoColor=white)](https://socket.io/)
[![Prisma](https://img.shields.io/badge/ORM-Prisma-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

</div>

---

## 🚀 Key Highlights & Features

### 1. 🎨 Live Whiteboards (Excalidraw) & Zero Persistence
* **Independent Canvas**: Every registered user maintains their own high-performance digital whiteboard powered by **Excalidraw**.
* **Zero-Persistence Privacy**: Drawing strokes and canvases are kept strictly in **client browser memory** — never permanently saved to databases or disk, ensuring confidential diagrams and sprint sketches remain private.
* **Canvas Dark/Light Sync**: The Excalidraw canvas, tools, and background instantly synchronize theme palettes (`dark` vs `light`) on the fly.

### 2. 📡 Real-Time Presentation Broadcasting
* **One-Click Broadcast**: Any workspace member can click **"Start Presentation"** to stream their private whiteboard canvas live to all room participants.
* **Zero-Lag Read-Only Sync**: Viewers receive real-time multi-user stroke and element synchronization via WebSockets.
* **Single Presenter Governance**: Enforces single-active-presenter concurrency per workspace to eliminate broadcast collisions.

### 3. 💬 Ephemeral Team Discussions & 1-on-1 Direct Chat
* **In-Memory / Redis TTL**: Both workspace group chats and 1-on-1 direct messages are stored in **Redis with configurable TTL** (Time-To-Live). Chat logs naturally expire and are never permanently persisted in relational databases.
* **Typing Indicators & Delivery Receipts**: Real-time typing indicators and immediate socket delivery confirmations.

### 4. 🤝 Bilateral Teammate Network & Invitations
* **Consent-Based Friendship**: Users must send friend requests; mutual acceptance is required before direct messaging or friend badges are granted.
* **Workspace Invitations**: Owners and admins invite registered users; invitees can accept or decline before joining.
* **Real-Time Notification Bell**: Bouncing notification pill with instant counters for pending requests and workspace invites.
* **Multi-Tab Presence Engine**: Real-time online/offline presence tracking across multiple browser tabs and sessions.

### 5. 🏢 Workspace Lifecycle & Cascading Deletion
* **Role-Based Access**: Granular roles (`OWNER`, `ADMIN`, `MEMBER`).
* **Safe Workspace Deletion**: Workspace owners can permanently delete workspaces. Active presentations are cleared from Redis, ephemeral chat is wiped, and all active members in the room receive real-time socket events redirecting them safely to the Dashboard.

### 6. 🌓 Electric Tech Blue Theme & Minimalist UI
* **Electric Tech Blue Palette**: Modern, high-contrast, professional design inspired by modern developer tools.
* **Box-Free Floating Rail**: Minimalist floating left navigation rail with icons and micro-descriptions distributed across the viewport.
* **Comprehensive Dark Mode**: Full Tailwind dark mode across all pages, modals, chats, and whiteboard canvases.

---

## 🛠️ Technology Stack

| Layer | Technology | Details |
| :--- | :--- | :--- |
| **Frontend Framework** | React 19 (Vite) | Single Page Application with dynamic routing |
| **Styling & UI** | Tailwind CSS 3.4 | Custom Electric Tech Blue theme, Dark Mode (`class`) |
| **Whiteboard Engine** | `@excalidraw/excalidraw` | In-memory infinite vector canvas |
| **Icons** | Lucide React | Clean minimalist SVG icon set |
| **Networking** | Axios & Socket.IO Client | REST API calls & bidirectional WebSockets |
| **Backend Runtime** | Node.js (ES Modules) | Express.js REST application |
| **Real-Time Gateway**| Socket.IO v4 | Targeted user & group rooms, event dispatch |
| **Database & ORM** | Prisma ORM | SQLite for local dev / PostgreSQL for production |
| **Cache & Ephemeral**| Redis (`ioredis`) | High-performance fallback in-memory store included |
| **Auth & Security** | JWT & BcryptJS | Signed access tokens, secure password hashing |

---

## 📂 Project Architecture

```
real-time-projects/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma            # SQLite database schema (dev)
│   │   ├── schema.postgresql.prisma # PostgreSQL database schema (prod)
│   │   └── schema.sqlite.prisma     # SQLite reference
│   ├── scripts/
│   │   └── initDb.js                # Database initialization script
│   ├── src/
│   │   ├── config/                  # Environment and database configs
│   │   ├── middleware/              # JWT auth and error middlewares
│   │   ├── modules/                 # Modular domain services & controllers
│   │   │   ├── auth/                # Registration, login, token refresh
│   │   │   ├── friends/             # Friend requests & friendships
│   │   │   ├── groups/              # Workspaces & invitations
│   │   │   └── users/               # Directory search & profile
│   │   ├── realtime/                # Socket.IO gateway & event listeners
│   │   ├── storage/                 # Redis ephemeral chat & presentation store
│   │   ├── app.js                   # Express app setup
│   │   └── server.js                # HTTP & Socket.IO entrypoint
│   └── tests/                       # Automated integration & socket tests
│       ├── friend_and_workspace_requests.test.js
│       ├── two_way_chat.test.js
│       ├── friends.test.js
│       └── integration.test.js
├── frontend/
│   ├── src/
│   │   ├── components/              # Shared UI (Navbar, Modal, Indicators)
│   │   ├── context/                 # AuthContext, SocketContext, ThemeContext
│   │   ├── features/                # Domain features (Whiteboard, Chat, Friends)
│   │   ├── pages/                   # LoginPage, RegisterPage, DashboardPage, etc.
│   │   ├── services/                # Axios API instance
│   │   ├── App.jsx                  # Route definitions
│   │   └── main.jsx                 # React root mount
│   ├── tailwind.config.js           # Theme colors & dark mode configuration
│   └── vite.config.js               # Vite build config
├── docker-compose.yml               # Optional PostgreSQL & Redis container stack
├── .env.example                     # Environment template
└── README.md                        # Documentation
```

---

## ⚡ Quick Start & Installation

### Prerequisites
* **Node.js** (v18.x or higher)
* **npm** (v9.x or higher)
* *(Optional)* **Docker & Docker Compose** (if running Redis & PostgreSQL containers)

### 1. Clone the Repository
```bash
git clone https://github.com/<your-username>/tomo.git
cd tomo
```

### 2. Backend Setup
```bash
cd backend

# Copy environment configuration
cp ../.env.example .env

# Install dependencies
npm install

# Initialize database (Prisma migrations & client generation)
node scripts/initDb.js

# Start backend server
npm run dev
```
Backend runs by default at **`http://localhost:5000`**.

### 3. Frontend Setup
In a new terminal window:
```bash
cd frontend

# Install dependencies
npm install

# Start Vite development server
npm run dev
```
Frontend runs by default at **`http://localhost:5173`**.

---

## 🧪 Automated Test Suite

TOMO comes with automated end-to-end integration test suites:

```bash
# 1. Test Friend Requests, Workspace Invitations, and Workspace Deletion
node backend/tests/friend_and_workspace_requests.test.js

# 2. Test Real-Time 2-Way Friend Ephemeral Chat
node backend/tests/two_way_chat.test.js

# 3. Test Multi-User Real-Time Group & Whiteboard Presentation
node backend/tests/integration.test.js
```

---

## 📡 Socket.IO Real-Time Events Reference

| Event Name | Direction | Payload | Description |
| :--- | :--- | :--- | :--- |
| `friend:request_received` | Server &rarr; Client | `{ request }` | Incoming friend request notification |
| `friend:request_accepted` | Server &rarr; Client | `{ friend, request }` | Reciprocal friendship confirmed |
| `friend:request_rejected` | Server &rarr; Client | `{ requestId }` | Request declined |
| `workspace:invitation_received` | Server &rarr; Client | `{ invitation }` | Incoming workspace invite notification |
| `workspace:invitation_accepted` | Server &rarr; Client | `{ groupId, member }` | User joined workspace |
| `workspace:deleted` | Server &rarr; Client | `{ groupId }` | Broadcast to workspace room on owner deletion |
| `dm:send` | Client &rarr; Server | `{ receiverId, content }`| Send direct message |
| `dm:message` | Server &rarr; Client | `{ message }` | Receive direct message |
| `dm:typing` | Client &rarr; Server | `{ receiverId, isTyping }`| Typing status update |
| `chat:send` | Client &rarr; Server | `{ groupId, content }` | Send group discussion message |
| `chat:message` | Server &rarr; Client | `{ message }` | Receive group discussion message |
| `presentation:start` | Client &rarr; Server | `{ groupId }` | Initiate whiteboard broadcast |
| `presentation:started` | Server &rarr; Client | `{ presenterId }` | Notifies room of live presentation |
| `whiteboard:update` | Client &rarr; Server | `{ groupId, elements, appState }` | Broadcast canvas stroke changes |
| `whiteboard:updated` | Server &rarr; Client | `{ elements, appState }` | Sync canvas to viewers |
| `presentation:stop` | Client &rarr; Server | `{ groupId }` | Terminate active broadcast |
| `presence:user_online` | Server &rarr; Client | `{ userId }` | Broadcast user online status |
| `presence:user_offline` | Server &rarr; Client | `{ userId }` | Broadcast user offline status |

---

## 🌐 REST API Endpoints

### Authentication (`/api/auth`)
* `POST /api/auth/register` — Create account (`username`, `email`, `password`)
* `POST /api/auth/login` — Sign in and receive JWT token
* `POST /api/auth/refresh` — Refresh access token
* `POST /api/auth/logout` — Revoke session

### Friend Management (`/api/friends`)
* `GET /api/friends` — List confirmed friends with real-time online status
* `POST /api/friends/request` — Send friend request (`targetUserId`)
* `GET /api/friends/requests` — View pending incoming and outgoing requests
* `POST /api/friends/requests/:id/accept` — Accept incoming request
* `POST /api/friends/requests/:id/reject` — Decline incoming request
* `DELETE /api/friends/requests/:id` — Cancel outgoing request
* `DELETE /api/friends/:friendId` — Remove friend
* `GET /api/friends/:friendId/messages` — Fetch ephemeral direct chat history

### Workspaces (`/api/groups`)
* `GET /api/groups` — List user's workspaces
* `POST /api/groups` — Create new workspace (`name`, `description`)
* `GET /api/groups/:id` — Get workspace details, members, and online counts
* `DELETE /api/groups/:id` — Delete workspace (Owner only)
* `POST /api/groups/:id/invitations` — Send workspace invitation (`inviteeId`, `role`)
* `GET /api/groups/invitations/my` — List pending workspace invitations
* `POST /api/groups/invitations/:id/accept` — Accept workspace invitation
* `POST /api/groups/invitations/:id/reject` — Decline workspace invitation
* `DELETE /api/groups/:id/members/:userId` — Leave workspace or remove member
* `GET /api/groups/:id/messages` — Fetch ephemeral group chat history

### User Directory (`/api/users`)
* `GET /api/users/me` — Authenticated profile
* `GET /api/users?search=query` — Search registered users by username or email
* `GET /api/users/teammates` — List active workspace teammates

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

