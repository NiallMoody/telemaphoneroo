const path = require("path");
const port = 10000;

//------------------------------------------------------------------------------
//------------------------------------------------------------------------------
//Require the fastify framework and instantiate it.
const fastify = require("fastify")({
  //Set this to true for detailed logging:
  logger: false
});

//Setup our static files.
fastify.register(require("@fastify/static"), {
  root: path.join(__dirname, "public"),
  prefix: "/" //Optional: default '/'
});

//fastify-formbody lets us parse incoming forms.
fastify.register(require("@fastify/formbody"));

//fastify-view is a templating manager for fastify.
fastify.register(require("@fastify/view"), {
  engine: {
    handlebars: require("handlebars")
  }
});

//------------------------------------------------------------------------------
//------------------------------------------------------------------------------
//Initialise socket.io.
const http = require('http');
const server = http.createServer();
const io = require("socket.io")(fastify.server);

//All the currently-active rooms.
var rooms = new Map();

//------------------------------------------------------------------------------
//------------------------------------------------------------------------------
//Function to create a new room and add it to the `rooms` Map.
function createRoom(roomName,
                    numTimes,
                    firstPrompt,
                    nextPrompts,
                    hidePrevious,
                    maxTimeout) {
  rooms.set(roomName,
            {
    players: new Map(),
    finalSentences: [],
    playing: false,
    turnsRemaining: 0,
    finalSentenceIndex: 0,
    numPlayersFinishedSpeaking: 0,
    numConnectedPlayers: 0,
    timeoutId: null,
    previousSentences: new Map(),//Used to track the sentences last sent to all the players, in case someone disconnects.
    numTimes: numTimes,
    firstPrompt: firstPrompt,
    nextPrompts: nextPrompts,
    hidePrevious: hidePrevious,
    maxTimeout: (maxTimeout > 0) ? maxTimeout : 1
  });

  console.log('Created room: <' + roomName + '>');
}

//------------------------------------------------------------------------------
//------------------------------------------------------------------------------
//Handle users connecting to our server.
io.on('connection', (socket) => {
  let roomName = socket.handshake.query.room;
  
  //Make sure we don't allow anyone to connect to a non-existent room.
  if(!rooms.has(roomName)) {
    console.log('Player trying to connect to non-existent room: ' + roomName);
    
    socket.emit('errorMessage',
                'Error: No active room with the name ' + roomName);
    
    socket.disconnect(true);
    
    return;
  }
  let room = rooms.get(roomName);
  
  //Don't allow players to connect to games that are already in progress.
  if(room.playing) {
    console.log('Player trying to join game that is already in progress: ' + roomName);
    
    socket.emit('errorMessage',
                'Sorry, this game is already in progress and cannot be joined.');
    
    socket.disconnect(true);
    
    return;
  }
  
  console.log('Someone connected to room: <' + roomName + '>');
  
  socket.join(roomName);
  
  room.players.set(socket.id, {name: '',
                               sentences: [],
                               disconnected: false,
                               admin: false,
                               sentSentence: false});
  ++room.numConnectedPlayers;
  console.log('<' + roomName + '>: ++room.numConnectedPlayers:' + room.numConnectedPlayers);
  
  //----------------------------------------------------------------------------
  //Gets called whenever a player disconnects.
  socket.on('disconnect', () => {
    console.log('<' + roomName + '>: Received a disconnect message from socket ' + socket.id);
    
    //This function also gets called when we disconnect all players once the
    //game is over, so this if statement prevents us trying to run code for a
    //non-existent room.
    if(rooms.has(roomName)) {
      //If someone has tried to join with the same name as someone already in
      //the game, they won't have been added to any rooms, but they'll still
      //fire off a disconnect message to the server, so we need to handle that.
      if(!room.players.has(socket.id)) {
        return;
      }
      
      //If we're not playing yet and it's the host that's disconnected, kick
      //everyone back to the main page.
      if(!room.playing) {
        if(room.players.has(socket.id)) {
          if(room.players.get(socket.id).admin) {
            //This forces the clients to reload the main page.
            io.in(roomName).emit('loadMainPage');
            
            console.log('<' + roomName + '>: Host disconnected before game start. Disconnecting all clients from room.');
            rooms.delete(roomName);
            
            return;
          }
        }
      }
    
      console.log('<' + roomName + '>: ' + room.players.get(socket.id).name, ' disconnected');

      room.players.get(socket.id).disconnected = true;
      --room.numConnectedPlayers;
      console.log('<' + roomName + '>: --room.numConnectedPlayers:' + room.numConnectedPlayers);

      //Has everyone disconnected?
      if(room.numConnectedPlayers < 1) {
        console.log('<' + roomName + '>: All players disconnected. Closing room.');

        room.playing = false;

        io.in(roomName).disconnectSockets();

        rooms.delete(roomName);
      }
      else {
        //If the game's not over and the disconnected player hasn't yet sent
        //their current sentence, update the server as though they sent their
        //previous sentence.
        if(!room.players.get(socket.id).sentSentence) {
          let lastSentence = '';

          if(room.previousSentences.has(socket.id)) {
            lastSentence = room.previousSentences.get(socket.id);
          }
          console.log('<' + roomName + '>: Sending previousSentence for disconnected player: ' + lastSentence);

          receivedSentence(roomName, socket.id, lastSentence);
        }

        //Check if the disconnected player was the admin.
        if(room.players.get(socket.id).admin) {
          //If they were, we'll need to make someone else the admin.
          for(let player of room.players) {
            if(!player[1].disconnected) {
              player[1].admin = true;
              io.to(player[0]).emit('adminUpdated');

              console.log('<' + roomName + '>: Previous admin disconnected. Setting ' + player[1].name + ' to be admin.');

              break;
            }
          }

          //Ensure the disconnected player is no longer the admin.
          room.players.get(socket.id).admin = false;
        }
        
        //Update everyone's player list to indicate the disconnected players.
        let tempPlayerList = [];
        
        for(let player of room.players) {
          let tempName = player[1].name;
          
          if(player[1].disconnected) {
            tempName += '🔌';
          }
          tempPlayerList.push(tempName);
        }
        
        console.log('Updating player list:');
        console.log(tempPlayerList);
        io.in(roomName).emit('updatePlayerList', tempPlayerList);
      }
    }
  });
  
  //----------------------------------------------------------------------------
  //Gets called when a player sets their name. This is basically the point where
  //they join the game.
  socket.on('setName', (name) => {
    if(name.length < 1) {
      console.log('<' + roomName + '>: Received a 0-length name from ' + socket.id);
      return;
    }
    
    //First check that this name does not already exist in the passed-in room.
    for(let playerName of room.players) {
      if(playerName[1].name == name) {
        socket.emit('errorMessage', 'There is already a player with the name ' +
                                    name +
                                    ' in this room. Please try another.');
      
        socket.emit('reloadPage');
        room.players.delete(socket.id);
        
        return;
      }
    }
    
    room.players.get(socket.id).name = name;
    
    let playerNames = [];
    room.players.forEach((value) => { 
      if((value.name != "") && (value.disconnected == false)) {
        playerNames.push(value.name);
      }
    });

    //Send the player list to the newly-connected player.
    socket.emit('updatePlayerList', playerNames);

    //Update any already-connected players.
    socket.to(roomName).emit('playerSetName', name);
    
    if(name == roomName) {
      console.log('<' + roomName + '>: Room host has joined. Admin is: ' + name);
      room.players.get(socket.id).admin = true;
      
      //Send the activateGameStart event to the newly-connected player (who is
      //host).
      socket.emit('activateGameStart');
    }
  });
  
  //----------------------------------------------------------------------------
  //Called when the admin for the game starts the game.
  socket.on('startGame', () => {
    //Only allow the game admin to actually start the game.
    if(room.players.get(socket.id).admin) {
      room.numConnectedPlayers = 0;
      
      //First create each player's list of other players (we'll step
      //through these to pass on each player's message to the next).
      room.players.forEach((value, key) => {
        //Delete any players who disconnected previously.
        if(value.disconnected)
          room.players.delete(key);
        else {
          value.others = [];

          room.players.forEach((value2, key2) => {
            if(key2 != key) {
              value.others.push(value2.name);
            }
          });
          
          ++room.numConnectedPlayers;
        }
      });
      
      room.turnsRemaining = room.players.size * room.numTimes;
      console.log('<' + roomName + '>: room.players.size: ' + room.players.size);
      console.log('<' + roomName + '>: numTimes: ' + room.numTimes);
      console.log('<' + roomName + '>: firstPrompt: ' + room.firstPrompt);
      console.log('<' + roomName + '>: nextPrompts: ' + room.nextPrompts);
      console.log('<' + roomName + '>: Setting turnsRemaining to: ' + room.turnsRemaining);
      console.log('<' + roomName + '>: Setting hidePrevious to: ' + room.hidePrevious);
      console.log('<' + roomName + '>: Setting maxTime to: ' + room.maxTimeout/(1000 * 60) + ' minutes');
      
      //Now start the game for everyone.
      io.in(roomName).emit('firstSentence', room.firstPrompt, room.players.size * room.numTimes);
      
      //Set the turn timer going.
      room.timeoutId = setTimeout(() => {
        turnTimeoutWarning(roomName);
      },
      room.maxTimeout);
      
      room.playing = true;
      
      console.log('<' + roomName + '>: Room host has started the game.');
    }
  });
  
  //----------------------------------------------------------------------------
  //Called when a player sends a sentence to the server.
  socket.on('sendSentence', (sentence) => {
    receivedSentence(roomName, socket.id, sentence);
  });
  
  //----------------------------------------------------------------------------
  //This event gets sent by the game admin to play the next final sentence.
  socket.on('nextSentence', () => {
    //Only makes sense to trigger this event if a game is active.
    if(room.playing) {
      //Only the game admin is allowed to trigger the next sentence.
      if(room.players.get(socket.id).admin) {

        io.in(roomName).emit('finalSentence', room.finalSentences[room.finalSentenceIndex]);
        console.log('<' + roomName + '>: Sending final sentence to players:');
        console.log(room.finalSentences[room.finalSentenceIndex]);
        ++room.finalSentenceIndex;

        room.numPlayersFinishedSpeaking = 0;

        //If we've sent all of the final sentences, then the game is finished;
        //disconnect all clients to prevent weird issues.
        if(room.finalSentenceIndex >= room.finalSentences.length) {
          room.playing = false;

          console.log('<' + roomName + '>: Game finished. Disconnecting all clients from room.');
          rooms.delete(roomName);
          io.in(roomName).disconnectSockets();
        }
      }
    }
  });
});

//------------------------------------------------------------------------------
//Called whenever we receive a sentence from a player.
function receivedSentence(roomName, socketId, sentence) {
  //Make sure roomName refers to an existing room.
  if(!rooms.has(roomName)) {
    return;
  }
  let room = rooms.get(roomName);
  
  //Make sure we've been sent a valid socketId.
  if(!room.players.has(socketId)) {
    return;
  }
  
  room.players.get(socketId).sentences.push(sentence);
  console.log('<' + roomName + '>: ' + room.players.get(socketId).name + ' sent the sentence: ' + sentence);
  
  room.previousSentences.set(socketId, sentence);

  //Update our player so we can track the number of sentences that have been
  //sent so far for this turn.
  room.players.get(socketId).sentSentence = true;
  
  //If all the sentences for this turn have been sent...
  let numSentencesSent = getNumSentencesSent(roomName);
  
  if(numSentencesSent == room.players.size) {
    //Kill any timeouts.
    if(room.timeoutId != null) {
      clearTimeout(room.timeoutId);
      room.timeoutId = null;
    }
    
    //Track the number of turns remaining before the end of the game.
    --room.turnsRemaining;

    //If there are no turns remaining we've reached the end of the game.
    if(room.turnsRemaining < 1) {
      //Game end.
      console.log('<' + roomName + '>: All sentences received, sending first final sentence...');

      //First, stick all the sentences into an array, so we can iterate
      //through them easily.
      let sentenceArray = [];
      room.players.forEach((value) => {
        sentenceArray.push({name: value.name, sentences: value.sentences});
      });

      //Now collate the full sequence of related sentences.
      for(let i=0;i<sentenceArray.length;++i) { //For each player...
        let temp = {name: sentenceArray[i].name, sentences: []};

        let index = i;
        for(let j=0;j<sentenceArray[i].sentences.length;++j) { //For each sentence...
          temp.sentences.push({name: sentenceArray[index].name,
                               sentence: sentenceArray[index].sentences[j]});

          --index;
          if(index < 0)
            index = sentenceArray.length - 1;
        }

        room.finalSentences.push(temp);
      }

      //Send the finalSentence event, with the first of the final sentences to
      //be played back by all the clients.
      io.in(roomName).emit('finalSentence', room.finalSentences[room.finalSentenceIndex]);
      console.log('<' + roomName + '>: Sending final sentence to players:');
      console.log(room.finalSentences[room.finalSentenceIndex]);
      ++room.finalSentenceIndex;
    }
    //If there are still more turns to go...
    else {
      for(let player of room.players) {
        player[1].sentSentence = false;
      }

      //Get each player's next prompt, and send it to them.
      console.log('<' + roomName + '>: Getting next sentence...');

      //First, stick all the sentences into an array, so we can iterate
      //through them easily.
      let sentenceArray = [];
      room.players.forEach((value, key) => {
        sentenceArray.push({id: key, sentences: value.sentences});
      });

      //Now go through each player and figure out whose sentence you're going
      //to send them.
      for(let i=0;i<sentenceArray.length;++i) {
        let playerIndex = (i + 1) % sentenceArray.length;

        //Send playerIndex's most recent sentence.
        io.to(sentenceArray[i].id).emit('newPrompt',
                                        sentenceArray[playerIndex].sentences[sentenceArray[playerIndex].sentences.length - 1],
                                        room.nextPrompts,
                                        room.hidePrevious);

        room.previousSentences.set(sentenceArray[i].id,
                                   sentenceArray[playerIndex].sentences[sentenceArray[playerIndex].sentences.length - 1]);
      }
      
      //Set the turn timer going.
      room.timeoutId = setTimeout(() => {
        turnTimeoutWarning(roomName);
      },
      room.maxTimeout);
      
      //If any players have disconnected, send the sentence they received last
      //straight away so we still act as though they did send something.
      for(let i=0;i<sentenceArray.length;++i) {
        let playerIndex = (i + 1) % sentenceArray.length;
        
        if(room.players.get(sentenceArray[i].id).disconnected) {
          receivedSentence(roomName,
                           sentenceArray[i].id,
                           sentenceArray[playerIndex].sentences[sentenceArray[playerIndex].sentences.length - 1]);
        }
      }
    }
  }
  //If we're still waiting on sentences from some of the other players...
  else {
    io.in(roomName).emit('waiting', room.players.size - numSentencesSent);
  }
}

//------------------------------------------------------------------------------
//Returns the number of players who have sent a sentence for this turn.
function getNumSentencesSent(roomName) {
  let retval = 0;
  
  if(rooms.has(roomName)) {
    let room = rooms.get(roomName);
    
    for(let player of room.players) {
      
      if(player[1].sentSentence) {
        ++retval;
      }
    }
  }
  
  return retval;
}

//------------------------------------------------------------------------------
//Used to warn players their time is almost up.
function turnTimeoutWarning(roomName) {
  if(rooms.has(roomName)) {
    let room = rooms.get(roomName);
    
    console.log('<' + roomName + '>: Coming up to turn timeout. Warning pending players...');
    console.log('room.timeoutId = ' + room.timeoutId);
    
    if(room.timeoutId == null) {
      return;
    }
    
    //Find any players who haven't submitted their text for this turn.
    for(let player of room.players) {
      if(!player[1].sentSentence) {
        io.to(player[0]).emit('timeoutWarning');
      }
    }
    
    room.timeoutId = setTimeout(() => {
      turnTimeoutEnd(roomName)
    },
    1000 * 11); //We give players 10s to get their text submitted (+1s wiggle
                //room)
  }
}

//------------------------------------------------------------------------------
//Used to move the game on if players are taking too long to enter their text.
function turnTimeoutEnd(roomName) {
  if(rooms.has(roomName)) {
    let room = rooms.get(roomName);
    
    console.log('<' + roomName + '>: Hit turn timeout. Automatically advancing to next turn.');
    
    if(room.timeoutId == null) {
      return;
    }
    
    //Find any players who haven't submitted their text for this turn.
    for(let player of room.players) {
      if(!player[1].sentSentence) {
        let sentence = room.previousSentences.get(player[0]);
        
        if(sentence == null) {
          sentence = '';
        }
        
        receivedSentence(roomName, player[0], sentence);
      }
    }
    
    room.timeoutId = null;
  }
}

//------------------------------------------------------------------------------
//------------------------------------------------------------------------------
//Our home page route, this pulls from src/pages/index.hbs.
fastify.get('/', (request, reply) => {
  reply.view('/src/pages/index.hbs', {});
});

//------------------------------------------------------------------------------
//Our actual game page, this pulls from src/pages/game.hbs.
fastify.get('/game', (request, reply) => {
  //Check that we've been given a room name.
  if('room' in request.query) {
    let params = {
      room: request.query.room,
      playerName: ""
    };

    reply.view('/src/pages/game.hbs', params);
  }
  else {
    console.log('Got a request for the /game page with no room name.');
    
    reply.view('/src/pages/index.hbs', {});
  }
});

//------------------------------------------------------------------------------
//Displays the about page.
fastify.get('/about', (request, reply) => {
  reply.view('src/pages/about.hbs', {});
});

//------------------------------------------------------------------------------
//We use POST to allow people to host a game.
fastify.post('/', (request, reply) => {
  //Make sure we've been sent the parameters we need to host a game.
  if(('hostName' in request.body) &&
     ('numTimes' in request.body) &&
     ('firstPrompt' in request.body) &&
     ('nextPrompts' in request.body) &&
     ('maxTime' in request.body)) {
    let params = { room: request.body.hostName,
                   playerName: request.body.hostName };

    console.log('Received a POST request to host a game, with the name: <' +
                request.body.hostName + '>');

    //Only allow players to start a game if they've entered some kind of name.
    if(request.body.hostName.length > 0) {
      //Don't allow players to host a game if there's already a game with that
      //name in progress.
      if(!rooms.has(request.body.hostName)) {
        //Create the room.
        createRoom(request.body.hostName,
                   request.body.numTimes,
                   request.body.firstPrompt,
                   request.body.nextPrompts,
                   ('hidePrevious' in request.body), //hidePrevious will only appear if the player clicked it.
                   request.body.maxTime * 1000 * 60);

        //And send the host to the game page.
        reply.view('/src/pages/game.hbs', params);
      }
      else {
        reply.view('/src/pages/index.hbs',
                   { errorMessage:'There is already a game in progress with the name ' +
                     request.body.hostName + '. Please try another name.'});
      }
    }
    else {
      reply.view('/src/pages/index.hbs',
                 { errorMessage:'Sorry, you need to enter a name in order to host a game.'});
    }
  }
  else {
    console.log('Received a POST request, but with missing parameters. hostName: ' +
                ('hostName' in request.body) + ' numTimes: ' +
                ('numTimes' in request.body) + ' firstPrompt: ' +
                ('firstPrompt' in request.body) + ' nextPrompts: ' +
                ('nextPrompts' in request.body) + ' maxTime: ' +
                ('maxTime' in request.body));
  }
});

//------------------------------------------------------------------------------
// Run the server and report out to the logs
console.log(`port = ${port}`);
fastify.listen(port, (err, address) => {

  if(err) {
    fastify.log.error(err);
    process.exit(1);
  }
  console.log(`Server running on ${address}`);
  fastify.log.info(`Server running on ${address}`);
});
