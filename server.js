
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

app.use(express.static(path.join(__dirname, 'public')));

const gridSize = 10;
let grid = Array(gridSize * gridSize).fill(null);
let players = {};
let roundTimer = null;
let gameStarted = false;
let timer = 30;
 

io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  socket.on('register', ({ name, color }) => {
    players[socket.id] = { name, color, score: 0 };
    socket.emit('init', { grid, playerId: socket.id, players });
    if(gameStarted) socket.emit('queued', socket.id)
  });

  socket.on('round-start', () => {
    console.log("Let the games begin");
    gameStarted = true;
    grid = Array(gridSize * gridSize).fill(null);
    for (const id in players) {
      players[id].score = 0;
    }
    io.emit('new-round', { grid, players });

    const ticker = () => {
      if (timer > 0) {
        timer--;
        setTimeout(ticker, 1000); // Call tick again after 1 second
        io.emit('update-time',timer);
      } else {
        endRound();
        timer = 60;
      }
    };
    ticker();

    const endRound = () => {
      const sorted = Object.entries(players).sort((a, b) => b[1].score - a[1].score);
      const winner = sorted[0];
      if(winner){
        io.emit('round-over', { winnerId: winner[0], winnerName: winner[1].name, score: winner[1].score, scoreboard: sorted.map(([id, p]) => ({ name: p.name, score: p.score, color: p.color })) });
      }else{
        console.log("booooo")
      }
      //startRound();
      gameStarted = false;
    }
  });

  socket.on('queued', (player) => {
    console.log('Player wants to join:', player.name);
  });

  socket.on('claim-square', (index) => {
    const previousOwner = grid[index];
    if (previousOwner !== socket.id) {
      grid[index] = socket.id;
      if (previousOwner && players[previousOwner]) {
        players[previousOwner].score = Math.max(0, players[previousOwner].score - 1);
      }
      players[socket.id].score += 1;
      io.emit('update-grid', { index, playerId: socket.id, color: players[socket.id].color, name: players[socket.id].name });
    }
  });

  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    delete players[socket.id];
  });

});

server.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
