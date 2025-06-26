# How the rooms are going to work

## (to try and keep things straight in my head)

1. Server creates the room when someone enters their name and clicks the Host
   Game button.
2. Server moves host to `/game?room=<room name>`. Players only connect to server
   when they load the `/game` page and enter their name (host's name is already
   set, so they shouldn't have to click the Set Name button; it should happen
   automatically).
3. Players use socket.io's `request.query` field when connecting to tell the
   server which room they're joining.
   