//------------------------------------------------------------------------------
//Display any error messages once the page has loaded.
window.addEventListener('load', (event) => {
  if(errorMessage.length > 0) {
    console.log(errorMessage);
    window.alert(errorMessage);
  }
});
