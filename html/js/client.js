


//  Copyright 2017 Kevin Herzig

//  This program is part of StoryVoter.

// StoryVoter is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.




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

function SendShowHide() {
    message.command = "SHOWHIDE";
    message.value = undefined;
    sendToServer()
}

function SendClearAll() {
    message.command = "CLEARALL";
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

    ws.onopen = function () {
        var serverDiv = $('#serverConnectionStatus');
        serverDiv.text('Server connection status: You are connected.');
        serverDiv.css('background-color', 'green');
        // Keep the TCP Socket connection alive
        setInterval(SendKeepAlive, 1000 * 60);

        // init the packet
        SendName('New Player');
    };

    ws.onmessage = function (event) {
        processServerMessage(JSON.parse(event.data));
    };

    ws.onerror = function (ev) {
        var serverDiv = $('#serverConnectionStatus');
        serverDiv.text('Server connection status: You were disconnected with an error.  Please refresh the page to reconnect.');
        serverDiv.css('background-color', 'darkRed');
    }

    ws.onclose = function () {
        var serverDiv = $('#serverConnectionStatus');
        serverDiv.text('Server connection status: You are disconnected.  Please refresh the page to reconnect.');
        serverDiv.css('background-color', 'darkRed');
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

}


function processServerMessage(message) {
    UpdateGame(message);
}

function UpdateGame(gameState) {
    var topic = gameState.topic;

    if (topic == undefined) {
        $('#txtTopic').text = '';
        $('#topic').innerText = "No Topic"
    }
    else {
        // avoid echo updates to the topic if we're typing
        if ((gameState.lastClientUpdate != clientId) || topic == "" || topic == undefined)
            $('#txtTopic').val(topic);

        $('#topic').text(topic);
    }
    var grid = $('#tableBody');

    grid.empty()

    var clientBlink = undefined;

    for (var client in gameState.clientStateArray) {

        // Server is telling us to blink this guy


        state = gameState.clientStateArray[client];

        if (state.blink == true)
            clientBlink = client;

        var clientGrid = '<tr id="' + client + '"><td>';

        if (state.name == undefined || state.name == "")
            clientGrid = clientGrid + "Anonymous"
        else
            clientGrid = clientGrid + state.name;

        clientGrid = clientGrid + '</td><td>';

        if (state.vote == undefined)
            clientGrid = clientGrid + "No Vote";
        else
            if (gameState.hidden)
                clientGrid = clientGrid + "Hidden"
            else
                clientGrid = clientGrid + state.vote;

        clientGrid = clientGrid + '</td></tr>';
        grid.append(clientGrid);
    }

    if (clientBlink != undefined) {
        //$('#' + clientBlink).fadeOut();
        //$('#' + clientBlink).fadeIn();
        $('#' + clientBlink).animate({ color: "red", backgroundColor: "#0000ff" }, 100);
        $('#' + clientBlink).animate({ color: "black", backgroundColor: "#eceeef" }, 100);
    }

}