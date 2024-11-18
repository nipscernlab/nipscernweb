const storageKey = 'theme-preference'

const onClick = () => {
  // flip current value
  theme.value = theme.value === 'light'
    ? 'dark'
    : 'light'

  setPreference()
}

const getColorPreference = () => {
  if (localStorage.getItem(storageKey))
    return localStorage.getItem(storageKey)
  else
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
}

const setPreference = () => {
  localStorage.setItem(storageKey, theme.value)
  reflectPreference()
}

const reflectPreference = () => {
  document.firstElementChild
    .setAttribute('data-theme', theme.value)

  document
    .querySelector('#theme-toggle')
    ?.setAttribute('aria-label', theme.value)
}

const theme = {
  value: getColorPreference(),
}

// set early so no page flashes / CSS is made aware
reflectPreference()

window.onload = () => {
  // set on load so screen readers can see latest value on the button
  reflectPreference()

  // now this script can find and listen for clicks on the control
  document
    .querySelector('#theme-toggle')
    .addEventListener('click', onClick)
}

// sync with system changes
window
  .matchMedia('(prefers-color-scheme: dark)')
  .addEventListener('change', ({matches:isDark}) => {
    theme.value = isDark ? 'dark' : 'light'
    setPreference()
  })

    // Smooth Scroll for Navbar Links
$(document).ready(function() {
   // Select all links with hashes within the nav
$('a.nav-link[href*="#"]').on('click', function(e) {
    // Prevent default anchor behavior if there is a valid hash
    if (this.hash !== "") {
        e.preventDefault();

        // Store the hash
        const hash = this.hash;

        // Animate the scroll using the offset of the target section
        $('html, body').animate({
            scrollTop: $(hash).offset().top
        }, 50, 'easeInOutCubic', function() {
            // Optional: Add the hash to the URL after scrolling
            // window.location.hash = hash; // Uncomment this line if you want the hash to be added to the URL
        });
    }
});

    // Dark Mode Toggle
    const darkModeToggle = document.getElementById('theme-toggle');
    const body = document.body;

    darkModeToggle.addEventListener('click', () => {
        body.classList.toggle('dark-mode');
        body.classList.toggle('light-mode');
        
        // Removed the text content change
        // darkModeToggle.textContent = body.classList.contains('dark-mode') ? 'Dark Mode' : 'Light Mode';
    });
});
