# ToDo

⭕ Server timeout triggered erroneously. Did I fix this by testing for null
    instead?

⭕ Dark/Light mode button gets out of sync sometimes?

⭕ Backup to github.

⭕ Add asterisks to hide previous prompt.
  > ⭕ How will this work though?

---

❓ Add Custom Settings option to set multiple prompts that cycle if we reach
   the last prompt before the end of the game.

❓ Make the emoji picker a custom option.

❓ Use emojis to show who's still thinking up a response

❓ Option to export final sentences. (pdf? video?)

❓ Rule presets in Custom Settings.

---

❌ Timer to deal with players who aren't writing anything.
  > ❌ Add timeout time to custom settings.

❌ Include FAQ page about license etc.

❌ Disconnect bugs:
  > ❌ If someone disconnects after they've posted their sentence for the turn
       but before the turn has ended, it messes up the numSentencesSent count.
        (and seems to mess things up for future turns)

❌ Don't briefly show Set Name widget for host when starting a game.

❌ Add button to turn off text-to-speech 🔇/🔊.

❌ Add dark mode 🌛/🌞.

❌ Remove `playerDisconnected` event.

❌ About page:
  > ❌ About the game.
  
  > ❌ Example alternative rules.
  
  > ❌ About the license.
  
  > ❌ Thanks ('Everyone at Biome'? or name the folk who specifically
    offered suggestions? Caitlin, Doug, James, Matthew).

  > ❌ Credit frameworks.

❌ Add emoji to denote disconnected players.

❌ Find a way to prevent footer from overlaying existing text when
    scrolling up.

❌ Make sure buttons are highlighted when focused.

❌ Do not allow players to join games after they've started.

❌ Open links in new tab.

❌ Find a javascript emoji picker.

❌ Integrate Twemoji.

❌ Fix bug where clicking away from text box sends sentence.

❌ Include room name in server logs.

❌ Fix copy URL.

❌ Include footer with license and author on every page.

❌ When the host disconnects (possibly other players too?) the correct chain
   of sentences is not preserved (had a chain of `Medium apple → Medium apple
   → Smaller onionoo`).

❌ When the host disconnects before the game has started, the game breaks.

❌ Add Custom Settings option to hide previous phrase.

❌ Sanitise all inputs. Don't want server exceptions from people misbehaving!

❌ Add button click feedback.

❌ Add logging of final sentences so I can see what is being sent to players.

❌ Favicon.

❌ Make sure turn counter takes into account num rounds.

❌ Fix games remaining active even after all players have disconnected.

❌ Visual round counter.

❌ If the admin disconnects, make another player the admin.
    
❌ Figure out a way to gracefully handle players disconnecting mid-game.
  > ❌ Treat the player as though they're still there, send the sentence they
        received w/no changes immediately.
        
  > ❌ Use the `disconnected` variable to track disconnected players while
        retaining their existing data.
  
❌ Add error message if player tries to host a game when there's already an
   active game with that name running.
    
❌ Disable send phrase button (and return key handler) when player submits for
   500ms to prevent accidental double sends.
  
❌ Add custom game mode: host can set the initial and subsequent prompts.

❌ Add option to play multiple rounds, to better handle a small number of players.

❌ Host clicks a button to trigger the next person's phrase at the end.

❌ Players only connect to server on setting their name.

❌ Fix css to work in chrome.

❌ Transition to room-based games.<br/>
  > ❌ Move index.hbs to game.hbs.

  > ❌ Turn index.hbs into a simple 'Host Game' page.

  > ❌ Entering your name and clicking the Host Game button will put you on a
    `telemaphoneroo-gamabarane.glitch.me/game?room=<host_name>` page.

  > ❌ Other players can join the game by navigating to that URL.

  > ❌ At the end of the game, delete the room.
  
  > ❌ Don't allow people to host a game if there's already a game with that
    name in progress.
