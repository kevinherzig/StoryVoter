
//////////////////////////////////////  MESSAGE STRUCTURE
var message = {
    sessionId: -1,
    clientId: -1,
    command: "NOCOMMAND",
    value: -1,
    timestamp: Date.now()
}
//////////////////////////////////////  PAGE INIT HANDLER

var clientId = "0";
function InitDocument() {

    // Extract the client id assigned by the server
    clientId = Cookies.get('votr_user');
    SetSessionId();
    SetupSockets();
}

//////////////////////////////////////  PAGE MESSAGE GENERATORS

function SendName(myName) {
    message.command = "NAME";
    message.value = myName;
    sendToServer();
}

function SendVote(voteValue) {
    message.command = "VOTE";
    message.value = voteValue;
    sendToServer();
}

function SendHideAll() {
    message.command = "HIDEALL";
    message.value = undefined;
    sendToServer()
}

function SendClearAll() {
    message.command = "CLEARALL";
    message.value = undefined;
    sendToServer();
}

function SendShowAllVotes() {
    message.command = "SHOWALL";
    message.value = undefined;
    sendToServer();
}

function SendTopic(topic) {
    message.command = 'TOPIC';
    message.value = topic;
    sendToServer();
}

function SendKeepAlive() {
    message.command = "PING";
    message.value = undefined;
    sendToServer();
}

//////////////////////////////////////  SERVER MESSAGE EXCHANGE

function sendToServer() {
    message.clientId = clientId;
    message.sessionId = sessionId;
    message.timestamp = Date.now();
    ws.send(JSON.stringify(message));
}



//////////////////////////////////////  SOCKET SERVER CODE
////////////////  Connect to socket
var ws;
function SetupSockets() {
    var host = window.document.location.host.replace(/:.*/, '');
    ws = new WebSocket('ws://' + host + ':8001');

    ws.onopen = () => {
        document.getElementById('serverConnectionStatus').textContent = "Connected."
        // Keep the TCP Socket connection alive
        setInterval(SendKeepAlive, 1000 * 60);
    };

    ws.onmessage = function (event) {
        processServerMessage(JSON.parse(event.data));
    };

    ws.onerror = (ev) => {
        document.getElementById('serverConnectionStatus').textContent = "Error."
    }

    ws.onclose = function () {
        uiSetServerStatus("Connection Error.  Could not reconnect.  Try refreshing the page.");
    };
}

//////////////////////////////////////  SESSION ID EXTRACT
var sessionId = -1;

function SetSessionId() {

    sessionId = document.URL.slice(document.URL.lastIndexOf('/') + 1);
}

//////////////////////////////////////  UI UPDATE FUNCTIONS

function uiSetServerStatus(status) {
    $('#serverConnectionStatus').text = status;
}


function processServerMessage(message) {
    $('#txtDebug').text = "Debug: " + JSON.stringify(message);
    UpdateGame(message);
}

function UpdateGame(gameState) {
var topic = gameState.topic;

if(topic == undefined)
{
    $('#txtTopic').text = '';
    $('#topic').innerText = "No Topic"
}
else
    {
        // avoid echo updates to the topic if we're typing
    if(gameState.lastClientUpdate != clientId)
        $('#txtTopic').val(topic);

    $('#topic').text(topic);
    }
var grid = $('#tableBody');

grid.empty()
    for (var client in gameState.clientStateArray) {
        state = gameState.clientStateArray[client];
        var client = '<tr><td>';

        if (state.name == undefined || state.name == "")
            client = client + "Anonymous"
        else
            client = client + state.name;

        client = client + '</td><td>';

        if (state.vote == undefined)
            client = client + "None";
        else
            client = client + state.vote;

        client = client + '</td></tr>';
        grid.append(client);
    }

}