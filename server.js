
var express = require('express');
var path = require('path');
var ws = require("ws");

const NodeCache = require("node-cache");

// 3 Hour expiration time
const sessionExpire = 3 * 60 * 60

const sessionCache = new NodeCache({useClones: false, stdTTL: 100, checkperiod: 120});

var cookieParser = require('cookie-parser');
const uuidV4 = require('uuid');


var nextSessionId = 1;


//////////////////////////////////////  EXPRESS SERVER STARTUP

var app = express();
app.use(cookieParser());
app.use(attach_votr_cookie);

app.listen(8000, function () {
  console.log('Express listening on http://localhost:8000');
});

//////////////////////////////////////  Process Routes

app.get('', (req, res) => {
  res.sendFile('index.html', { root: '.' });
});

// Client connected to a session, set a cooookie
app.get("/session/:id", (req, res) => {

      // We were mucking around with Mongo and now we have a session
      // so send the response to the patiently waiting client
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

app.use(express.static('html'))

//////////////////////////////////////  SOCKET SERVER STARTUP

const wss = new ws.Server({ perMessageDeflate: false, port: 8001 }, () => {
  console.log('Sockets server listening on port 8001');

  wss.on('connection', function connection(ws) {
    // store the connection

    ws.on('message', function incoming(data) {
      // Broadcast to everyone else.
      ProcessClientMessage(data, this);
    });
  });
});
//////////////////////////////////////  HANDLE AN INCOMING MESSAGE

function attach_votr_cookie(req, res, next) {
  if (req.cookies.votr_user == undefined)
    res.cookie("votr_user", uuidV4());
  next();
}

//////////////////////////////////////  BROADCAST CLIENT MESSAGE

function BroadcastMessage(m) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN)
      client.send(data);
  });
}
//////////////////////////////////////  CONNEC TO MONGO DB

// Retrieve
var MongoClient = require('mongodb').MongoClient;

var sessionCollection;
var transactionCollection;

// Connect to the db
MongoClient.connect("mongodb://192.168.1.214:27017/votr", function (err, db) {
  if (err) { return console.dir(err); }

  sessionCollection = db.collection('sessions');
  transactionCollection = db.collection('transactions');

  //// test

});


function GetSessionObject(SessionId) {
  var s = sessionCache.get(SessionId);

  if (s == undefined) {
    s = new Object();
  }

  if (s.clientSocketArray == undefined)
    s.clientSocketArray = new Object();

  if (s.gameState == undefined)
  {
    s.gameState = new Object();
    s.topic = "";
    s.notes = "";
    s.gameState.clientStateArray = new Object();
  }
  sessionCache.set(SessionId, s)

  return s;
}

function ProcessClientMessage(m, socket) {

  var o = JSON.parse(m);

  transactionCollection.insert(o);

  var clientId = o.clientId;
  var sessionId = o.sessionId;

  var thisSessionObject = GetSessionObject(sessionId);


  var thisClientsState = thisSessionObject.gameState.clientStateArray[clientId];
  if (thisClientsState == undefined) {
    thisClientsState = new Object();

    thisSessionObject.gameState.clientStateArray[clientId] = thisClientsState;
    thisSessionObject.clientSocketArray[clientId] = socket;
  }


  console.log(m);

  //////////////////////////////////////  PAGE MESSAGE GENERATORS
  //  Client message processor
  // Extract the client and session id's

  switch (o.command) {
    case "MYNAME":
      thisClientsState.clientName = o.value;
      break;

    case "VOTE":
      thisClientsState.vote = o.value;
      break;

    case "HIDEALL":
      thisSessionObject.gameState.clientStateArray.forEach((clientState) => { clientState.visible = false; });
      break;

    case "NEWVOTE":
      thisSessionObject.gameState.clientStates.forEach((clientState) => {
        clientState.visible = false;
        clientState.vote = undefined;
      });
      break;

    case "SHOWALL":
      break;

    case "TOPIC":
    thisSessionObject.gameState.Topic = o.value;
      break;

    case "PING":
      break;
  }

  sessionCache.set(sessionId, thisSessionObject);

  for (var aSocket in thisSessionObject.clientSocketArray) 
  {
    if (thisSessionObject.clientSocketArray[aSocket].readyState == 1)
      thisSessionObject.clientSocketArray[aSocket].send(JSON.stringify(thisSessionObject.gameState));
  }
}

