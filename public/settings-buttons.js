import { EmojiButton } from 'https://cdn.jsdelivr.net/npm/@joeattardi/emoji-button@latest/dist/index.min.js';

var emojiPicker = new EmojiButton({style: 'twemoji'});

const prefersDarkScheme = window.matchMedia("(prefers-color-scheme: dark)");
var darkMode = false;
var mute = false;

export {
  darkMode,
  mute
};

const currentTheme = localStorage.getItem('theme');
if (currentTheme == 'dark') {
  document.body.classList.toggle('darkTheme');
} else if (currentTheme == 'light') {
  document.body.classList.toggle('lightTheme');
}

const currentMute = localStorage.getItem('mute');
if(currentMute == 'true') {
  mute = true;
}

//------------------------------------------------------------------------------
//Setup the settings buttons.
window.addEventListener('load', (event) => {
  //Set up dark mode button.
  let darkModeButton = document.getElementById('darkModeButton');
  
  if(prefersDarkScheme.matches) {
    if(currentTheme !== 'light') {
      darkModeButton.innerHTML = '🌛';
      darkModeButton.title = 'Switch to light mode';
      darkMode = true;
    }
  }
  
  darkModeButton.addEventListener('click', () => {
    darkMode = !darkMode;
    
    if(prefersDarkScheme.matches)
      document.body.classList.toggle('lightTheme');
    else
      document.body.classList.toggle('darkTheme');
    
    if(darkMode) {
      darkModeButton.innerHTML = '🌛';
      darkModeButton.title = 'Switch to light mode';
    }
    else {
      darkModeButton.innerHTML = '🌞';
      darkModeButton.title = 'Switch to dark mode';
    }
    
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
    
    twemoji.parse(darkModeButton);
  });
  
  //Set up mute button
  let muteText2Speech = document.getElementById('muteText2Speech');
  
  if(mute)
    muteText2Speech.innerHTML = '🔇';
  
  muteText2Speech.addEventListener('click', () => {
    mute = !mute;
    
    if(mute) {
      muteText2Speech.innerHTML = '🔇';
      muteText2Speech.title = 'Unmute game speech'
    }
    else
    {
      muteText2Speech.innerHTML = '🔊';
      muteText2Speech.title = 'Mute game speech'
    }
    
    localStorage.setItem('mute', mute ? 'true' : 'false');
    
    twemoji.parse(muteText2Speech);
  });

  twemoji.parse(document.body);
});
