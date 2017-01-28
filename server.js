var WebSocketServer = require('serve-static').Server;
var express = require('express');
var path = require('path');
var app = express();
var server = require('http').createServer();

app.use(express.static(path.join(__dirname, '/public')));



server.on('request', app);

server.listen(8080, function () {
  console.log('Listening on http://localhost:8080');
});
var session = {
  sessionId: -1,
  currentTopic: "Topic"
}



wss.on('connection', function connection(ws) {
  wss.on('message', function incoming(data) {
    // Broadcast to everyone else.
    wss.clients.forEach(function each(client) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  });
});