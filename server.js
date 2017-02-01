var staticserver = require('serve-static').Server;
var express = require('express');
var path = require('path');

var server = require('http').createServer();
var ws = require("ws");

const NodeCache = require("node-cache");

// 3 Hour expiration time
const sessionExpire = 3 * 60 * 60

const sessionCache = new NodeCache({ stdTTL: sessionExpire, checkperiod: 600 });
const clientCache = new NodeCache({ stdTTL: sessionExpire, checkperiod: 600 });

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

  // If session is not in cache or does not exist
  // then fetch/create it before returning the page

  var passedId = req.params.id;

  var session = sessionCache.get(passedId);

  // if we don't have a session in cache
  if (session == undefined) {
    // try go get it from Mongo
    var query = sessionCollection.find({ _id: passedId })

    query.toArray((err, docs) => {
      if (docs.length == 1) {

        // Mongo had it, so load it into cache
        sessionCache.set(passedId, docs[0]);
        session = docs[0];
      }
      else
      // Mongo didn't have it so it's a brand new session
      // create the new session and load it to Mongo and Cache
      {
        var newSession = new Object();
        session = newSession;
        newSession.sessionId = passedId;
        sessionCache.set(passedId, newSession);
        sessionCollection.insert({ "_id": passedId, "Session:": newSession });
      }

      // We were mucking around with Mongo and now we have a session
      // so send the response to the patiently waiting client
      res.sendFile('client.html', { root: '.' });
    });
  }

  // If we had to fetch the session info from Mongo then
  // don't return anything to the client.  The callback
  // from Mongo will send this page.
  if (session != undefined)
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

  if(s.clientSockets == undefined)
    s.clientSocketArray = new Object();

    if(s.state == undefined)
    s.clientStateArray = new Object();
  
  return s;
}



function ProcessClientMessage(m) {

  var o = JSON.parse(m);

  transactionCollection.insert(o);

  var clientId = o.clientId;
  var sessionId = o.sessionId;

  var thisSessionObject = GetSessionObject(sessionId);
  var thisClientsState = thisSessionObject.clientStateArray[clientId];
  if (thisClientsState == undefined) {
    thisClientsState = new Object();
    thisSessionObject.clientStateArray[clientId] = thisClientsState;
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

      break;

    case "NEWVOTE":
      break;

    case "SHOWALL":
      break;

    case "TOPIC":
      break;

    case "PING":
      break;



  }

}

