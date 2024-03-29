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

////////////////// imports
// require('debug-trace')({
//  always: true,
// });

const winston = require('winston');
var express = require('express');
var path = require('path');
var ws = require("sockjs");
var jsonfile = require('jsonfile');
const NodeCache = require("node-cache");
var http = require('http');
var fs = require('fs');
var cookieParser = require('cookie-parser');
const uuidV4 = require('uuid');

///////////////////// logging setup

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'user-service' },
  transports: [
    //
    // - Write all logs with importance level of `error` or less to `error.log`
    // - Write all logs with importance level of `info` or less to `combined.log`
    //
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console(),
  ],
});

// 3 Hour expiration time
const sessionExpire = 3 * 60 * 60;
const sessionCache = new NodeCache({ useClones: false, stdTTL: sessionExpire, checkperiod: 120 });


///////////////////////////////////// set up session ID counter

var sessionFileName = './sessionId.json';

//  Read the session id that's persisted if any or use the default of 100
var nextSessionId = 100;
try {
  nextSessionId = jsonfile.readFileSync(sessionFileName);
  logger.info('Read session id ' + nextSessionId + ' from sessionId.json');
}
catch (err) {
  logger.info('Could not read session file, defaulting to 100');
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


var server = http.createServer(expressApp).listen(port, function () {
  logger.info('Express server listening on port ' + port);
});

//////////////////////////////////////  Process Routes

expressApp.get('', (req, res) => {
  res.sendFile('index.html', { root: '.' });
});

// Client connected to a session, set a cookie
expressApp.get("/session/:id", (req, res) => {
  res.sendFile('client.html', { root: '.' });
});

// Client connected to /session manually, redirct them to a new session id
expressApp.get('/session', (req, res) => {
  res.redirect('/session/' + nextSessionId++);
});

expressApp.use(express.static('html'));

expressApp.use(function (err, req, res, next) {
  logger.error("Error: " + err.message);
  logger.error("Stack: " + err.stack);
  next(err);
});

//////////////////////////////////////  SOCKET SERVER STARTUP

const webSocketServer = new ws.createServer({ sockjs_url: 'https://cdn.jsdelivr.net/npm/sockjs-client@1/dist/sockjs.min.js' });
webSocketServer.on('connection', function connection(conn) {
  logger.info('connection' + ws);
  conn.on('data', function incoming(data) {
    // Broadcast to everyone else.
    ProcessClientMessage(data, this);
  });

  conn.on('close', function () {
    logger.info('disconnect');
  });
});

//////////////////////////////////////  CONNECT THE SOCKETS SERVER
webSocketServer.installHandlers(server, { prefix: '/sockets' });
//////////////////////////////////////  HANDLE AN INCOMING MESSAGE


//////////////////////////////////////  PUSH A NEW COOKIE WITH CLIENT ID 
function attach_votr_cookie(req, res, next) {
  if (req.cookies.votr_user == undefined)
    res.cookie("votr_user", uuidV4.v4());
  next();
}

//////////////////////////////////////  GET / CREATE SESSION OBJECT
function GetSession(SessionId) {
  var currentSession = sessionCache.get(SessionId);

  // If the session is not in the cache, create it
  if (currentSession == undefined) {
    currentSession = {};

    // Place the object into the cache
    sessionCache.set(SessionId, currentSession);
  }

  // Create the client socket array if necessary
  if (currentSession.clientSockets == undefined)
    currentSession.clientSockets = {};

  // If the session is new create and initialize the game state
  if (currentSession.gameState == undefined) {
    currentSession.gameState = {};
    currentSession.topic = "New Topic";
    currentSession.gameState.hidden = true;
    currentSession.gameState.clientStates = {};
  }

  return currentSession;
}

//////////////////////////////////////  Message Processing Loop
function ProcessClientMessage(m, socket) {

  // Convert the JSON message to an object
  var message = JSON.parse(m);

  // Write the object to a log
  logger.info(m);

  // Extract the client and session id's
  var clientId = message.clientId;
  var sessionId = message.sessionId;

  var thisSession = GetSession(sessionId);

  var gameState = thisSession.gameState;
  var clientSockets = thisSession.clientSockets;

  // If this is the first message from this client, add the client to the game
  var thisClientsState = gameState.clientStates[clientId];
  if (thisClientsState == undefined) {
    thisClientsState = {};
    gameState.clientStates[clientId] = thisClientsState;
  }

  // Add the client socket to the state object too
  clientSockets[clientId] = socket;


  // Clear all of the client blink states so we don't blink 'em twice

  for (var thisClientId in gameState.clientStates) {
    gameState.clientStates[thisClientId].blink = false;
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
      gameState.hidden = !gameState.hidden;
      thisClientsState.blink = true;
      break;


    // New vote
    case "CLEARALL":

      for (var thisClientId2 in gameState.clientStates) {
        gameState.clientStates[thisClientId2].vote = undefined;
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
  var currentVote = gameState.clientStates[0];
  var clientCount = 0;
  var consensus = -1;

  for (var thisClientId3 in gameState.clientStates) {

    clientCount++;

    if (consensus == -1) {
      currentVote = gameState.clientStates[thisClientId3].vote;
      consensus = 1;
    }
    var vote = gameState.clientStates[thisClientId3].vote;
    if (vote == undefined || vote != currentVote || vote == '?')
      consensus = 0;
  }

  gameState.consensus = ((consensus == 1) && (clientCount > 1));

  // This tells the clients who sent the update
  gameState.lastClientUpdate = clientId;

  // Update the cache - not sure if this is needed
  sessionCache.set(sessionId, thisSession);

  // Broadcast the game state to all listening clients
  for (var aSocket in clientSockets) {
    if (clientSockets[aSocket].readyState == 1)
      clientSockets[aSocket].write(JSON.stringify(gameState));
    else {
      // if socket is closed, remove them from the state.
      delete gameState.clientStates[aSocket];
      delete clientSockets[aSocket];
    }
  }
}

//////////////////////////////////////////////////////////////////  SERVER SHUTDOWN
// When the server is shutting down, write the current session id to
// a file.  This let's us keep a counter as to how many sessions we've
// done.
function ServerShutdown() {
  logger.info("Received kill signal, shutting down gracefully.");
  logger.info('Saving sessionId.json');
  try {
    jsonfile.writeFileSync(sessionFileName, nextSessionId);
    logger.info('Successfully wrote session file');

  }
  catch (err) {
    logger.info('Could not write session file' + err);
  }
  process.exit();

}

// listen for TERM signal .e.g. kill 
process.on('SIGTERM', ServerShutdown);

// listen for INT signal e.g. Ctrl-C
process.on('SIGINT', ServerShutdown);
