# StoryVoter

An open source voting machine for Agile Teams.


## Introduction

I wrote StoryVoter to help teams run games of "planning poker" in a fast, efficient, and fun manner.  There are some great sites on the internet for this, but I thought it might be helpful to have an open source version with the soruce code available for those that may have limitations on connectivity such as teams with heavy offshore dependencies.

You can try this out at http://storyvoter.herzig.net

## Technology

StoryVoter uses a NodeJS server which serves up client pages that interact live with the server.  The glue back and forth is the excellent [SockJS] (https://github.com/sockjs) library which automaticall selects a lowest common denominator push or emulation pattern.  There is no long term persistence of session data beyond the client event log.


## Future Development

I'd like to continue developing StoryVoter into a suite of agile team tools.  I plan to tackle team retrospectives next.  I'd welcome contributions in the form of code.

## Installation

First you must have NodeJS and npm installed.  NodeJs can be downloaded [here](https://nodejs.org/en/download/).  I have built and tested this application using NodeJS version 6.9.5.  

	git clone https://github.com/kevinherzig/StoryVoter.git
	cd StoryVoter
	npm install
	
## Running

The syntax to run the server is 

	nodejs server.js [port]
	
If you wish to run the server on a privledged port (such as the default http port 80) you'll have to start it as root, or better yet give node permission to use the port.  There are a few approaches to running node on port 80, search the Google and decide for yourself what works best for you and your operating system.

  
## Session and Event Persistence

The server writes to two files.

| File           | Purpose                                                                         |
| -------------- | ------------------------------------------------------------------------------- |
| eventLog.json  | A log of all client messages                                                    |
| sessionId.json | The next session id so that session numbers are persisted during server recycle |

You can watch the client activity on your server by issuing the command

	tail -n 40 -f eventLog.json
