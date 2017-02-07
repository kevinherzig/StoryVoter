
var express = require('express');
var path = require('path');
var ws = require("sockjs");
var jsonfile = require('jsonfile');
const NodeCache = require("node-cache");
var http = require('http');

// 3 Hour expiration time
const sessionExpire = 3 * 60 * 60

const sessionCache = new NodeCache({ useClones: false, stdTTL: 100, checkperiod: 120 });

var cookieParser = require('cookie-parser');
const uuidV4 = require('uuid');


var nextSessionId = 100;
var sessionFile = './sessionId.json';
try {
  var nextSessionId = jsonfile.readFileSync(sessionFile);
}
catch (err) {
  console.log('Could not read session file, defaulting')
}


//////////////////////////////////////  EXPRESS SERVER STARTUP

var app = express();
app.use(cookieParser());
app.use(attach_votr_cookie);

var port = process.argv[2];
if (port == undefined)
  port = 8000;

if (isNaN(port))
  port = 8000;

app.set('port', port);

var server = http.createServer(app).listen(app.get('port'), function () {
  console.log('Express server listening on port ' + app.get('port'));
});

//////////////////////////////////////  Process Routes

app.get('', (req, res) => {
  res.sendFile('index.html', { root: '.' });
});

// Client connected to a session, set a cooookie
app.get("/session/:id", (req, res) => {
  res.sendFile('client.html', { root: '.' });
});

app.get('/session', (req, res) => {
  res.redirect('/session/' + nextSessionId++);
});

// Client connected to /session manually, redirct them to a new session id
app.get("/session", (req, res) => {
  const newSession = nextSessionId++;
  res.redirect('/session/' + newSession);
});



app.use(express.static('html'));


//////////////////////////////////////  SOCKET SERVER STARTUP

const wss = new ws.createServer({ sockjs_url: 'http://cdn.jsdelivr.net/sockjs/1.0.1/sockjs.min.js' }, () => {
  console.log('Sockets server listening on port 8001');
});
wss.on('connection', function connection(conn) {
  console.log('connection' + ws);
  conn.on('data', function incoming(data) {
    // Broadcast to everyone else.
    ProcessClientMessage(data, this);
  });
});

wss.installHandlers(server, { prefix: '/sockets' });
//////////////////////////////////////  HANDLE AN INCOMING MESSAGE

function attach_votr_cookie(req, res, next) {
  if (req.cookies.votr_user == undefined)
    res.cookie("votr_user", uuidV4());
  next();
}


function GetSessionObject(SessionId) {
  var s = sessionCache.get(SessionId);

  if (s == undefined) {
    s = new Object();
  }

  if (s.clientSocketArray == undefined)
    s.clientSocketArray = new Object();

  if (s.gameState == undefined) {
    s.gameState = new Object();
    s.topic = "";
    s.notes = "";
    s.hidden = true;
    s.gameState.clientStateArray = new Object();
  }
  sessionCache.set(SessionId, s)

  return s;
}



function ProcessClientMessage(m, socket) {

  var o = JSON.parse(m);

  var clientId = o.clientId;
  var sessionId = o.sessionId;

  var thisSessionObject = GetSessionObject(sessionId);


  var thisClientsState = thisSessionObject.gameState.clientStateArray[clientId];
  if (thisClientsState == undefined) {
    thisClientsState = new Object();

    thisSessionObject.gameState.clientStateArray[clientId] = thisClientsState;

  }

  thisSessionObject.clientSocketArray[clientId] = socket;

  console.log(m);

  //////////////////////////////////////  PAGE MESSAGE GENERATORS
  //  Client message processor
  // Extract the client and session id's

  switch (o.command) {
    case "NAME":
      thisClientsState.name = o.value;
      break;

    case "VOTE":
      thisClientsState.vote = o.value;
      break;

    case "SHOWHIDE":
      if (thisSessionObject.gameState.hidden)
        thisSessionObject.gameState.hidden = false
      else
        thisSessionObject.gameState.hidden = true;
      break;

    case "CLEARALL":

      for (var clientId in thisSessionObject.gameState.clientStateArray) {
        thisSessionObject.gameState.clientStateArray[clientId].vote = undefined;
        thisSessionObject.gameState.topic = "";
      }
      thisSessionObject.gameState.hidden = true;
      break;

    case "SHOWALL":

      break;

    case "TOPIC":
      thisSessionObject.gameState.topic = o.value;
      break;

    case "PING":
      break;
  }
  thisSessionObject.gameState.lastClientUpdate = clientId;

  sessionCache.set(sessionId, thisSessionObject);

  for (var aSocket in thisSessionObject.clientSocketArray) {
    if (thisSessionObject.clientSocketArray[aSocket].readyState == 1)
      thisSessionObject.clientSocketArray[aSocket].write(JSON.stringify(thisSessionObject.gameState));
  }
}


// this function is called when you want the server to die gracefully
// i.e. wait for existing connections
function gracefulShutdown() {
  console.log("Received kill signal, shutting down gracefully.");
  try {
    jsonfile.writeFileSync(sessionFile, nextSessionId);
  }
  catch (err) {
    console.log('Could not write session file' + err);
  }
  process.exit()

}

// listen for TERM signal .e.g. kill 
process.on('SIGTERM', gracefulShutdown);

// listen for INT signal e.g. Ctrl-C
process.on('SIGINT', gracefulShutdown);

