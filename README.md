# Rush Rivals v3 — Multiplayer Arcade

A beginner-friendly, real-time multiplayer arcade game: alternate **Gem Match** (match-3) and **Spark Dash** (three-lane runner) rounds to restore a shared city. No networking knowledge required.

## Features
- 1–4 players, room code and copyable HTTPS invitation URL
- Reconnect with per-player token stored in the browser
- Live Socket.IO leaderboard, shared city power, round timers and synchronized round changes
- Easy / Normal / Hard difficulty, alternating match-3 and runner mini-games
- Super Charge power-ups, combo points, rematches, winner screen
- Responsive UI, sound toggle, keyboard and touch runner controls
- Express static serving and `process.env.PORT` support for Render

## Run locally

Requires Node.js 18+.

```bash
npm install
npm start
```

Open http://localhost:3000 and join with a second browser window.

## Deploy to Render
1. Push **all files** to your GitHub repository, retaining `public/index.html`, `public/style.css`, and `public/app.js`.
2. Render → Web Service → connect repository → Node runtime.
3. Root Directory: blank if `package.json` is at repository root.
4. Build command: `npm install` (or `npm ci` if you upload the lockfile).
5. Start command: `npm start`.
6. Wait for Live and open the service's HTTPS URL.
7. Create a room, copy invite, and test on two devices.

## Notes
- Rooms and scores live in **server memory**. Render restarts or free-tier sleeping clear active rooms.
- Browser storage remembers player tokens for reconnecting within the same running room.
- Casual party-game architecture: client reports puzzle matches and collected runner items; this is not anti-cheat hardened for prize competitions.
- No copyrighted art or music is included; graphics are CSS, emoji, canvas and synthesized tones.
- When deploying over an older Rush Rivals version, existing v1/v2 room state and reconnect tokens are not compatible. Create a new room after upgrading.

## Rebranding / existing Render URL
The game is now branded **Rush Rivals** throughout the interface, server health endpoint, logs, and npm package name. You can keep the existing GitHub repository and Render service; the public URL can remain `https://packet-panic.onrender.com/` until you choose to rename the service. A Render service rename may change its public URL, so test invites again if you rename it.

## Deployment checklist
- Back up your currently working game before replacing it.
- Upload `server.js`, `package.json`, and the three files inside `public/` to the corresponding paths in your existing GitHub repository.
- Render build: `npm install`; start: `npm start`; root directory: repository root.
- Wait for the latest commit to deploy and test the game on two separate devices.
