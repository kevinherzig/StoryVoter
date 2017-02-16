
//  Copyright 2017 Kevin Herzig

//      This program is free software: you can redistribute it and/or modify
//    it under the terms of the GNU General Public License as published by
//    the Free Software Foundation, either version 3 of the License, or
//   (at your option) any later version.

//    This program is distributed in the hope that it will be useful,
//    but WITHOUT ANY WARRANTY; without even the implied warranty of
//    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
//    GNU General Public License for more details.

//    You should have received a copy of the GNU General Public License
//    along with this program.  If not, see <http://www.gnu.org/licenses/>.

var express = require('express');
var path = require('path');
var ws = require("sockjs");
var jsonfile = require('jsonfile');
const NodeCache = require("node-cache");
var http = require('http');
var fs = require('fs');
var cookieParser = require('cookie-parser');
const uuidV4 = require('uuid');

// 3 Hour expiration time
const sessionExpire = 3 * 60 * 60
const sessionCache = new NodeCache({ useClones: false, stdTTL: 100, checkperiod: 120 });


var sessionFileName = './sessionId.json';
var eventLogName = './eventLog.json';
var eventFileStream = fs.createWriteStream(eventLogName);

//  Read the session id that's persisted if any or use the default of 100
var nextSessionId = 100;
try {
  var nextSessionId = jsonfile.readFileSync(sessionFileName);
  console.log('Read session id ' + nextSessionId + ' from sessionId.json');
}
catch (err) {
  console.log('Could not read session file, defaulting to 100')
}

//////////////////////////////////////  EXPRESS SERVER STARTUP

var expressApp = express();
expressApp.use(cookieParser());
expressApp.use(attach_votr_cookie);

var port = process.argv[2];
if (port == undefined)
  port = 8000;

if (isNaN(port))
  port = 8000;

expressApp.set('port', port);

var server = http.createServer(expressApp).listen(expressApp.get('port'), function () {
  console.log('Express server listening on port ' + expressApp.get('port'));
});

//////////////////////////////////////  Process Routes

expressApp.get('', (req, res) => {
  res.sendFile('index.html', { root: '.' });
});

// Client connected to a session, set a cooookie
expressApp.get("/session/:id", (req, res) => {
  res.sendFile('client.html', { root: '.' });
});

expressApp.get('/session', (req, res) => {
  res.redirect('/session/' + nextSessionId++);
});

// Client connected to /session manually, redirct them to a new session id
expressApp.get("/session", (req, res) => {
  const newSession = nextSessionId++;
  res.redirect('/session/' + newSession);
});

expressApp.use(express.static('html'));

//////////////////////////////////////  SOCKET SERVER STARTUP

const webSocketServer = new ws.createServer({ sockjs_url: 'http://cdn.jsdelivr.net/sockjs/1.0.1/sockjs.min.js' }, () => {
  console.log('Sockets server listening on port 8001');
});
webSocketServer.on('connection', function connection(conn) {
  console.log('connection' + ws);
  conn.on('data', function incoming(data) {
    // Broadcast to everyone else.
    ProcessClientMessage(data, this);
  });

  conn.on('close', function () {
    console.log('disconnect');
  });
});

//////////////////////////////////////  CONNECT THE SOCKETS SERVER
webSocketServer.installHandlers(server, { prefix: '/sockets' });
//////////////////////////////////////  HANDLE AN INCOMING MESSAGE


//////////////////////////////////////  PUSH A NEW COOKIE WITH CLIENT ID 
function attach_votr_cookie(req, res, next) {
  if (req.cookies.votr_user == undefined)
    res.cookie("votr_user", uuidV4());
  next();
}

//////////////////////////////////////  GET / CREATE SESSION OBJECT
function GetSession(SessionId) {
  var currentSession = sessionCache.get(SessionId);

  // If the session is not in the cache, create it
  if (currentSession == undefined) {
    currentSession = new Object();

    // Place the object into the cache
    sessionCache.set(SessionId, currentSession)
  }

  // Create the client socket array if necessary
  if (currentSession.clientSockets == undefined)
    currentSession.clientSockets = new Object();

  // If the session is new create and initialize the game state
  if (currentSession.gameState == undefined) {
    currentSession.gameState = new Object();
    currentSession.topic = "New Topic";
    currentSession.gameState.hidden = true;
    currentSession.gameState.clientStateArray = new Object();
  }

  return currentSession;
}

//////////////////////////////////////  Message Processing Loop
function ProcessClientMessage(m, socket) {

  // Convert the JSON message to an object
  var message = JSON.parse(m);

  // Write the object to a log
  eventFileStream.write(m + '\n');

  // Extract the client and session id's
  var clientId = message.clientId;
  var sessionId = message.sessionId;

  var thisSession = GetSession(sessionId);

  var gameState = thisSession.gameState;
  var sessionSockets = thisSession.clientSockets;

  // If this is the first message from this client, add the client to the game
  var thisClientsState = gameState.clientStateArray[clientId];
  if (thisClientsState == undefined) {
    thisClientsState = new Object();
    gameState.clientStateArray[clientId] = thisClientsState;
  }

  // Add the client socket to the state object too
  sessionSockets[clientId] = socket;

  console.log(m);

  // Clear all of the client blink states so we don't blink 'em twice

  for (var clientId in gameState.clientStateArray) {
    gameState.clientStateArray[clientId].blink = false;
  }

  //////////////////////////////////////  PAGE MESSAGE GENERATORS
  //  Client message processor
  // Process the message and update the game state accordingly

  switch (message.command) {

    // Client is changing their name
    case "NAME":
      thisClientsState.name = message.value;
      break;

    // Client is sending a vote
    case "VOTE":
      thisClientsState.vote = message.value;
      thisClientsState.blink = true;
      break;

    // Client requesting to show or hide all votes
    case "SHOWHIDE":
      if (gameState.hidden)
        gameState.hidden = false
      else
        gameState.hidden = true;

      thisClientsState.blink = true;
      break;


    // New vote
    case "CLEARALL":

      for (var clientId in gameState.clientStateArray) {
        gameState.clientStateArray[clientId].vote = undefined;
        gameState.topic = "";
      }
      gameState.hidden = true;

      thisClientsState.blink = true;
      break;

    // Client is changing the topic
    case "TOPIC":
      gameState.topic = message.value;
      break;

    // Client is pinging the server to keep socket connection alive
    case "PING":
      break;
  }

  // Let's see if we have consensus, and if we do, set a flag
  var currentVote = gameState.clientStateArray[0];
  var clientCount = 0;
  var consensus = -1;

  for (var clientId in gameState.clientStateArray) {
    
    clientCount++;

    if (consensus == -1) {
      currentVote = gameState.clientStateArray[clientId].vote;
      consensus = 1;
    }
    var vote = gameState.clientStateArray[clientId].vote;
    if (vote == undefined || vote != currentVote || vote == '?')
      consensus = 0;
  }

  gameState.consensus = ((consensus == 1) && (clientCount > 1));

  // This tells the clients who sent the update
  gameState.lastClientUpdate = clientId;

  // Update the cache - not sure if this is needed
  sessionCache.set(sessionId, thisSession);

  // Broadcast the game state to all listening clients
  for (var aSocket in sessionSockets) {
    if (sessionSockets[aSocket].readyState == 1)
      sessionSockets[aSocket].write(JSON.stringify(gameState));
    else {
      // if socket is closed, remove them from the state.
      delete gameState.clientStateArray[aSocket];
      delete sessionSockets[aSocket];
    }
  }
}

//////////////////////////////////////////////////////////////////  SERVER SHUTDOWN
// When the server is shutting down, write the current session id to
// a file.  This let's us keep a counter as to how many sessions we've
// done.
function ServerShutdown() {
  console.log("Received kill signal, shutting down gracefully.");
  console.log('Saving sessionId.json');
  try {
    jsonfile.writeFileSync(sessionFileName, nextSessionId);
    console.log('Successfully wrote session file');

    eventFileStream.end();
  }
  catch (err) {
    console.log('Could not write session file' + err);
  }
  process.exit()

}

// listen for TERM signal .e.g. kill 
process.on('SIGTERM', ServerShutdown);

// listen for INT signal e.g. Ctrl-C
process.on('SIGINT', ServerShutdown);
