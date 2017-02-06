
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
    var socketHost = "http://" + window.document.location.host + "/sockets"
    ws = new SockJS(socketHost);

    ws.onopen = function()  {
        uiSetServerStatus('Connected.')
        // Keep the TCP Socket connection alive
        setInterval(SendKeepAlive, 1000 * 60);

        // init the packet
        SendName('New Player');
    };

    ws.onmessage = function (event) {
        processServerMessage(JSON.parse(event.data));
    };

    ws.onerror = function(ev) {
        uiSetServerStatus('An error occurred.  Please refresh the page.')
    }

    ws.onclose = function () {
        uiSetServerStatus("You were disconnected.  Refresh the page to reconnect.");
    };
}

//////////////////////////////////////  SESSION ID EXTRACT
var sessionId = -1;

function SetSessionId() {

    sessionId = document.URL.slice(document.URL.lastIndexOf('/') + 1);
    $('#sessionId').text('Your current session ID is ' + sessionId)
}

//////////////////////////////////////  UI UPDATE FUNCTIONS

function uiSetServerStatus(status) {
    $('#serverConnectionStatus').text('Server connection status: ' + status);
}


function processServerMessage(message) {
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
    if((gameState.lastClientUpdate != clientId) || topic == "" || topic == undefined)
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