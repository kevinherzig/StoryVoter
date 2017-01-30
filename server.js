var staticserver = require('serve-static').Server;
var express = require('express');
var path = require('path');

var server = require('http').createServer();
var ws = require("ws");

const NodeCache = require( "node-cache" );
const myCache = new NodeCache({ stdTTL: sessionExpire });

var cookieParser = require('cookie-parser')
\const uuidV4 = require('uuid');

// 3 Hour expiration time
const sessionExpire = 3 * 60 * 60
var nextSessionId = 1;
//var model = require('model.js');

//////////////////////////////////////  EXPRESS SERVER STARTUP

var app = express();
app.use(cookieParser())
app.use(attach_votr_cookie);

app.listen(8000, function () {
  console.log('Express listening on http://localhost:8000');
});

//////////////////////////////////////  Process Routes

app.get('', (req, res) => {
  res.sendFile('index.html', { root: '.' });
})

// Client connected to a session, set a cooookie
app.get("/session/:id", (req, res) => {
  // If session is not in cache or does not exist
  // then fetch/create it before returning the page
  res.sendFile('client.html', { root: '.' });
});

app.get('/session', (req, res) => {
  res.redirect('/session/' + nextSessionId++);
});

app.get('/:file', (req, res) => {
  res.sendFile(req.params.file, { root: '.' });
});

// Client request for a new session id
app.get("/session/new", (req, res) => {
  res.write(JSON.stringify(nextSessionId++));
});





// Client connected to /session manually, redirct them to a new session id
app.get("/session", (req, res) => {
  const newSession = nextSessionId++;
  res.redirect('/session/' + newSession);
});



//////////////////////////////////////  SOCKET SERVER STARTUP

const wss = new ws.Server({ perMessageDeflate: false, port: 8001 }, () => {
  console.log('Sockets server listening on port 8001');

  wss.on('connection', function connection(ws) {
    ws.on('message', function incoming(data) {
      // Broadcast to everyone else.
      ProcessClientMessage(data);
    });
  });
});
//////////////////////////////////////  HANDLE AN INCOMING MESSAGE

function attach_votr_cookie(req, res, next) {
  if (req.cookies.votr_user == undefined)
    res.cookie("votr_user", uuidV4());
  next();
}

//////////////////////////////////////  GET OR CREATE A SESSION
function GetSession(sessionId) {
  if (sessionId = -1)
    sessionId = nextSessionId++;

  var session = myCache.get(sessionId)

  if (session == undefined) {
    session = model.GetNewSession();
    session.sessionId = sessionId;
    myCache.set(sessionid, session);
  }
  return session;
}

//////////////////////////////////////  BROADCAST CLIENT MESSAGE

function BroadcastMessage(m) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN)
      client.send(data);
  });
}
//////////////////////////////////////  PROCESS A CLIENT MESSAGE

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


  // Get the next session id
  var x = sessionCollection.find().sort({ _id: -1 }).limit(1);
  x.on("readable", (p) => {
    var q = x.read();
    if (q == null) {
      sessionCollection.insert({ _id: 1 });
    }
  }

  )
  x.forEach((doc) => {
    s = doc._id
  })

});

function ProcessClientMessage(m) {

  var o = JSON.parse(m);

  transactionCollection.insert(o);

  var clientId = o.clientId;
  var sessionId = o.sessionId;

  console.log(m);

  //////////////////////////////////////  PAGE MESSAGE GENERATORS

  //  Client message processor

  // Extract the client and session id's

  switch (o.command) {
    case "VOTE":
      break;

    case "HIDEALL":
      break;

    case "CLEARALL":
      break;

    case "SHOWALL":
      break;

    case "TOPIC":
      break;

    case "PING":
      break;



  }

}

