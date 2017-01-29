
module.exports = {

    GetSession: () => {
        
        var session = {
            sessionId: -1,
            currentTopic: "Topic",
            nextClientId: 1,
        }
        return session;
    },



    GetMessage: () => {
        var message = {
            sessionId: -1,
            command: "NOCOMMAND",
            value: -1, 

        }
    }

}


