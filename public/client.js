import { EmojiButton } from 'https://cdn.jsdelivr.net/npm/@joeattardi/emoji-button@latest/dist/index.min.js';
import { mute } from './settings-buttons.js';

var socket;
var admin = false;
var turn = 1;
var numTurns = 0;
var lastPrompt = '';
var hidePreviousGlobal = false;
var previous = '';
var emojiPicker = new EmojiButton({style: 'twemoji'});

var timeoutCountdownId = 0;
var timeoutCount = 0;

//------------------------------------------------------------------------------
//Hook up our button and text box event listeners.
window.addEventListener('load', (event) => {
  let nameButton = document.getElementById('nameButton');
  let nameTextBox = document.getElementById('nameTextBox');
  let nameDiv = document.getElementById('nameDiv');
  
  //If the page is a little slow in loading, the hosting player might see the
  //'Enter your name:' prompt even though they've already set their name.
  //To get around this we hide nameDiv by default, and only show it once the
  //page has loaded.
  nameDiv.style.display = 'block';
  
  twemoji.parse(document.body);
  
  //If this is the room host's client, set their name automatically.
  if(playerName == room) {
    setName(playerName);
    
    let roomURLDiv = document.getElementById('roomURLDiv');
    let urlTextBox = document.getElementById('urlTextBox');
    let urlCopyButton = document.getElementById('urlCopyButton');
    
    //Display the url copy widgets.
    roomURLDiv.style.display = 'block';
    
    //Hook up the url copy event.
    urlCopyButton.addEventListener('click', (event) => {
      navigator.clipboard.writeText(urlTextBox.value);
    });
  }
  
  nameButton.addEventListener('click', (event) => {
    setName(nameTextBox.value);
  });
  nameTextBox.addEventListener('keyup', (event) => {
    if(event.key == 'Enter') {
      setName(nameTextBox.value);
    }
  });
});

//------------------------------------------------------------------------------
//When we've set our name, connect to the server so the game can start.
function setName(newName) {
  if(newName.length > 0) {
    let nameDiv = document.getElementById('nameDiv');
    let playerListDiv = document.getElementById('playerListDiv');
    
    twemoji.parse(document.body);

    //Connect to the server when we set our name.
    socket = io({ query: {room: room} });
    setupSocket();

    socket.emit('setName', newName);
    nameDiv.style.display = 'none';
    playerListDiv.style.display = 'block';
  }
  else {
    alert('Please enter a name in order to join the game.');
  }
}

//------------------------------------------------------------------------------
//Hook up all our response functions to events sent from the server.
function setupSocket() {

  //----------------------------------------------------------------------------
  //Called from the server after a new player has connected, to give them the
  //current list of players.
  socket.on('updatePlayerList', (players) => {
    let playerList = document.getElementById('playerList');
    
    console.log('updatePlayerList:');
    console.log(players);

    playerList.innerHTML = '';

    for(let i=0;i<players.length;++i) {
      let li = document.createElement('li');

      li.appendChild(document.createTextNode(players[i]));
      playerList.appendChild(li);
    }
    
    twemoji.parse(document.body);
  });

  //----------------------------------------------------------------------------
  //Called from the server if we are already connected and a new player has
  //joined.
  socket.on('playerSetName', (name) => {
    let playerList = document.getElementById('playerList');
    let li = document.createElement('li');

    li.appendChild(document.createTextNode(name));
    playerList.appendChild(li);
    
    twemoji.parse(document.body);
  });

  //----------------------------------------------------------------------------
  //This event gets called for the game's admin player, allowing them to start
  //the game with the start game button.
  socket.on('activateGameStart', () => {
    let gameStartDiv = document.getElementById('gameStartDiv');
    let startGameButton = document.getElementById('startGameButton');
    let nextSentenceDiv = document.getElementById('nextSentenceDiv');
    let nextSentenceButton = document.getElementById('nextSentenceButton');
    
    admin = true;

    gameStartDiv.style.display = 'block';
    startGameButton.addEventListener('click', (event) => {
      gameStartDiv.style.display = 'none';

      socket.emit('startGame');
    });
    nextSentenceButton.addEventListener('click', (event) => {
      if(socket.connected) {
        nextSentenceDiv.style.display = 'none';

        socket.emit('nextSentence');
      }
      else {
        window.location = '/';
      }
    });
  });

  //----------------------------------------------------------------------------
  //This event gets called if the admin disconnects and we need to make another
  //player the admin.
  socket.on('adminUpdated', () => {
    admin = true;
    console.log('Server event: adminUpdated. We are now the room host.');
    
    //Make sure the nextSentence button is hooked up to our event handler.
    let nextSentenceDiv = document.getElementById('nextSentenceDiv');
    let nextSentenceButton = document.getElementById('nextSentenceButton');
    
    nextSentenceButton.addEventListener('click', (event) => {
      if(socket.connected) {
        nextSentenceDiv.style.display = 'none';

        socket.emit('nextSentence');
      }
      else {
        window.location = '/';
      }
    });
  });

  //----------------------------------------------------------------------------
  //This event gets called for every player when the game starts.
  socket.on('firstSentence', (firstPrompt, maxTurns) => {
    let sentenceEnterDiv = document.getElementById('sentenceEnterDiv');
    let sentencePrompt = document.getElementById('sentencePrompt');
    
    lastPrompt = '';

    sentenceEnterDiv.style.display = 'block';
    sentencePrompt.innerHTML = firstPrompt;

    let sentenceButton = document.getElementById('sentenceButton');
    let sentenceTextBox = document.getElementById('sentenceTextBox');

    //We don't attach the event listeners straight away, to ensure players don't
    //accidentally skip a step by double-clicking.
    setTimeout(() => {
        sentenceButton.addEventListener('click', sendSentence);
        sentenceTextBox.addEventListener('keyup', sendSentenceKeyUp);
      },
      500);
    
    let emojiButton = document.getElementById('emojiButton');
    
    emojiPicker.on('emoji', selection => {
      sentenceTextBox.value = sentenceTextBox.value.substring(0, sentenceTextBox.selectionStart) +
                              selection.emoji +
                              sentenceTextBox.value.substring(sentenceTextBox.selectionStart);
    });
    
    emojiButton.addEventListener('click', () => emojiPicker.togglePicker(emojiButton));
    
    if(admin) {
      let roomURLDiv = document.getElementById('roomURLDiv');
      
      roomURLDiv.style.display = 'none';
    }
    
    let roomTitle = document.getElementById('roomTitle');
    
    numTurns = maxTurns;
    roomTitle.innerHTML = room + '\'s Room (turn: 1/' + numTurns + ')';
    ++turn;

	sentenceTextBox.focus();

    if(!mute) {
      let robotVoice = new SpeechSynthesisUtterance();
      robotVoice.text = sentencePrompt.innerHTML;
      window.speechSynthesis.speak(robotVoice);
    }
    
    twemoji.parse(document.body);
  });

  //----------------------------------------------------------------------------
  //Update clients so they know how many players they're waiting on before the
  //next turn is triggered.
  socket.on('waiting', (num) => {
    let sentenceEnterDiv = document.getElementById('sentenceEnterDiv');

    if(sentenceEnterDiv.style.display == 'none') {
      let waitingDiv = document.getElementById('waitingDiv');

      waitingDiv.style.display = 'block';
    }
    let waitingText = document.getElementById('waitingText');

    waitingText.innerHTML = 'Waiting on ' + num + ' players.'
  });

  //----------------------------------------------------------------------------
  //Called at the start of every turn other than the first one.
  socket.on('newPrompt', (prompt, nextPrompts, hidePrevious) => {
    let waitingDiv = document.getElementById('waitingDiv');
    let sentenceEnterDiv = document.getElementById('sentenceEnterDiv');
    let sentencePrompt = document.getElementById('sentencePrompt');
    
    if(timeoutCountdownId > 0) {
      clearTimeout(timeoutCountdownId);
      timeoutCountdownId = 0;
    }
    
    lastPrompt = prompt;

    waitingDiv.style.display = 'none';

    sentenceEnterDiv.style.display = 'block';
    sentencePrompt.innerHTML = nextPrompts;
    if(!hidePrevious) {
      sentencePrompt.innerHTML += ' ' + prompt;
    }

    let sentenceTextBox = document.getElementById('sentenceTextBox');
    let sentenceButton = document.getElementById('sentenceButton');

    hidePreviousGlobal = hidePrevious;
    if(hidePrevious) {
      previous = prompt;
      sentenceTextBox.value = '';
    }
    else {
      sentenceTextBox.value = prompt;
    }
    
    //We don't attach the event listeners straight away, to ensure players don't
    //accidentally skip a step by double-clicking.
    setTimeout(() => {
        sentenceButton.addEventListener('click', sendSentence);
        sentenceTextBox.addEventListener('keyup', sendSentenceKeyUp);
      },
      500);
    
    let roomTitle = document.getElementById('roomTitle');
    
    roomTitle.innerHTML = room + '\'s Room (turn: ' + turn + '/' + numTurns + ')';
    ++turn;

	sentenceTextBox.focus();

    if(!mute) {
      let robotVoice = new SpeechSynthesisUtterance();
      robotVoice.text = sentencePrompt.innerHTML;
      window.speechSynthesis.speak(robotVoice);
    }
    
    twemoji.parse(document.body);
  });

  //----------------------------------------------------------------------------
  //Gets called for each of the completed final sentences.
  //data contains all of the phrases generated by a specific initial phrase.
  socket.on('finalSentence', (data) => {
    let finalSentencesDiv = document.getElementById('finalSentences');
    let sentenceEnterDiv = document.getElementById('sentenceEnterDiv');
    let waitingDiv = document.getElementById('waitingDiv');

    sentenceEnterDiv.style.display = 'none';
    waitingDiv.style.display = 'none';

    finalSentencesDiv.style.display = 'block';

    finalSentencesDiv.innerHTML += '<h2>' + data.name + '\'s Phrase:</h2>';
    finalSentencesDiv.innerHTML += '<p><strong><span class="highlightText">' +
                                   data.sentences[0].name +
                                   ':</span></strong> ' +
                                   data.sentences[0].sentence +
                                   '</p>';

    window.scrollTo(0, document.body.scrollHeight);

    finalSentences = data;
    finalSentenceIndex = 0;
    console.log('finalSentences length: ', finalSentences.sentences.length);
    
    let roomTitle = document.getElementById('roomTitle');
    
    roomTitle.innerHTML = room + '\'s Room';
    
    twemoji.parse(document.body);

    if(!mute) {
      let robotVoice = new SpeechSynthesisUtterance();
      robotVoice.text = data.name + '\'s Phrase: ' +
                                    finalSentences.sentences[finalSentenceIndex].sentence;

      //Hook up triggerNextSentence() so it will get called when the robot lady
      //has finished saying the current sentence.
      robotVoice.onend = triggerNextSentence;

      window.speechSynthesis.speak(robotVoice);
    }
    else {
      setTimeout(triggerNextSentence, 1000);
    }
  });

  //----------------------------------------------------------------------------
  //Used to send error messages to the client from the server.
  socket.on('errorMessage', (error) => {
    console.log('Error message: ', error);
    window.alert(error);
  });
  
  //----------------------------------------------------------------------------
  //Called from the server to force a page reload. This is necessary if we
  //try and join the game with the same name as someone already in the game.
  socket.on('reloadPage', () => {
    location.reload();
  });
  
  //----------------------------------------------------------------------------
  //Called from the server to force us to load the main page. This happens if
  //the host disconnects before the game has started.
  socket.on('loadMainPage', () => {
    console.log('loadMainPage');
    window.location.href = '/';
  });

  //----------------------------------------------------------------------------
  //Called from the server if we're taking too long to enter our text for this
  //turn.
  socket.on('timeoutWarning', () => {
    let sentencePrompt = document.getElementById('sentencePrompt');
    
    sentencePrompt.innerHTML = 'Better hurry up! Only 10 seconds remaining!';
    
    timeoutCount = 10;
    timeoutCountdownId = setTimeout(timeoutCountdown, 1000);
  });
}

//------------------------------------------------------------------------------
//Only send sentence to the server on return key up.
function sendSentenceKeyUp(event) {
  if(event.keyCode == 13) {
    sendSentence();
  }
}

//------------------------------------------------------------------------------
//Sends the passed-in sentence to the server.
function sendSentence() {
  let sentenceTextBox = document.getElementById('sentenceTextBox');
  let sentence = '';
  
  if(timeoutCountdownId > 0) {
      clearTimeout(timeoutCountdownId);
      timeoutCountdownId = 0;
    }
  
  if(hidePreviousGlobal) {
    sentence = previous + sentenceTextBox.value;
  }
  else {
    sentence = sentenceTextBox.value;
  }
  
  if((sentence.length > 0) && (sentence != lastPrompt)) {
    let sentenceEnterDiv = document.getElementById('sentenceEnterDiv');
    let sentenceButton = document.getElementById('sentenceButton');

    console.log('Sending ' + sentence);

    socket.emit('sendSentence', sentence);
    sentenceEnterDiv.style.display = 'none';

    sentenceTextBox.removeEventListener('keyup', sendSentenceKeyUp);
    sentenceButton.removeEventListener('click', sendSentence);
  }
  else if(sentence.length < 1) {
    alert('Please enter some text before clicking Send phrase');
  }
  else if(sentence == lastPrompt) {
    alert('Please modify the phrase "' + lastPrompt + '" before clicking Send phrase');
  }
}

//------------------------------------------------------------------------------
//Used to implement the timeout counter display.
function timeoutCountdown() {
  let sentencePrompt = document.getElementById('sentencePrompt');
  
  --timeoutCount;
  if(timeoutCount > 0) {
    sentencePrompt.innerHTML = 'Better hurry up! Only ' + timeoutCount + ' seconds remaining!';
    
    timeoutCountdownId = setTimeout(timeoutCountdown, 1000);
  }
  else {
    sentencePrompt.innerHTML = 'Better hurry up! 0 seconds remaining!';
    
    timeoutCountdownId = 0;
  }
}

//------------------------------------------------------------------------------
//------------------------------------------------------------------------------
var finalSentences;
var finalSentenceIndex = 0;

//------------------------------------------------------------------------------
//Gets called automatically when the robot lady has finished saying the current
//sentence.
function triggerNextSentence() {
  ++finalSentenceIndex;
  
  //If there are more sentences still to be said, say the next one.
  if(finalSentenceIndex < finalSentences.sentences.length) {
    let finalSentencesDiv = document.getElementById('finalSentences');
    
    finalSentencesDiv.innerHTML += '<p><strong><span class="highlightText">' +
                                   finalSentences.sentences[finalSentenceIndex].name +
                                   ':</span></strong> ' +
                                   finalSentences.sentences[finalSentenceIndex].sentence +
                                   '</p>';
    
    twemoji.parse(document.body);
    
    window.scrollTo(0, document.body.scrollHeight);
    
    if(!mute) {
      let robotVoice = new SpeechSynthesisUtterance();
      robotVoice.text = finalSentences.sentences[finalSentenceIndex].sentence;

      robotVoice.onend = triggerNextSentence;

      window.speechSynthesis.speak(robotVoice);
    }
    else {
      setTimeout(triggerNextSentence, 1000)
    }
  }
  //If we've said all our current sentences...
  else {
    //If we've been disconnected, that means we've played every single sentence
    //created by every single player, so we can enable the restart button.
    if(!socket.connected) {
      let nextSentenceDiv = document.getElementById('nextSentenceDiv');
      let nextSentenceButton = document.getElementById('nextSentenceButton');
      
      nextSentenceDiv.style.display = 'block';
      if(admin) {
        nextSentenceButton.innerHTML = 'Host another game';
      }
      else {
        nextSentenceButton.innerHTML = 'Host a game';
      }
      
      window.scrollTo(0, document.body.scrollHeight);
      
      if(!admin) {
        nextSentenceButton.addEventListener('click', (event) => {
          window.location = '/';
        });
      }
    }
    //If we've not been disconnected, give the admin access to the next sentence
    //button.
    else if(admin) {
      let nextSentenceDiv = document.getElementById('nextSentenceDiv');
      let nextSentenceButton = document.getElementById('nextSentenceButton');
      
      nextSentenceDiv.style.display = 'block';
      nextSentenceButton.innerHTML = 'Next sentence';
      
      window.scrollTo(0, document.body.scrollHeight);
    }
  }
}
