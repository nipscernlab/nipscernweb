document.addEventListener("DOMContentLoaded", function () {
    const navbarToggler = document.getElementById('navbarToggler');
    const navbarMenu = document.getElementById('navbarNav');
    
    let menuOpen = false; // Track the menu state

    navbarToggler.addEventListener('click', function () {
        if (menuOpen) {
            closeMenu();
        } else {
            openMenu();
        }
        menuOpen = !menuOpen;
    });

    function openMenu() {
        navbarMenu.style.display = 'block'; // Make sure menu is visible
        navbarMenu.style.height = '0'; // Start with height of 0 for transition

        // Apply height with a small delay to trigger the transition
        requestAnimationFrame(() => {
            navbarMenu.style.height = navbarMenu.scrollHeight + 'px'; // Smooth expand
        });
    }

    function closeMenu() {
        navbarMenu.style.height = '0'; // Collapse the menu smoothly
        navbarMenu.addEventListener('transitionend', function () {
            if (!menuOpen) {
                navbarMenu.style.display = 'none'; // Hide menu completely after transition ends
            }
        }, { once: true });
    }
});



document.addEventListener('DOMContentLoaded', function () {
    // Try to get selectedLanguage and selectedFlag elements if they exist
    const selectedLanguage = document.querySelector('.selected-language');
    const selectedFlag = document.getElementById('selected-flag');

    // Load the saved language from localStorage
    const storedLanguage = JSON.parse(localStorage.getItem('selectedLanguage'));

    // Only update selectedLanguage and selectedFlag if they exist on the current page
    if (storedLanguage) {
        if (selectedLanguage) {
            selectedLanguage.textContent = storedLanguage.lang === 'en' ? '🇬🇧 English' :
                storedLanguage.lang === 'pt' ? '🇧🇷 Português' :
                storedLanguage.lang === 'no' ? '🇳🇴 Norge' : '🇫🇷 Français';
        }
        if (selectedFlag) {
            selectedFlag.src = storedLanguage.logo;
        }

        // Load translations for the stored language and apply to the page
        loadTranslations().then(translations => {
            translatePage(translations, storedLanguage.lang);
        });
    }
});

// Function to load translations from the JSON file
async function loadTranslations() {
    const response = await fetch('language.json');
    return await response.json();
}

// Function to apply translations based on the selected language
function translatePage(translations, lang) {
    const elementsToTranslate = document.querySelectorAll('[data-i18n]');
    elementsToTranslate.forEach((element) => {
        const key = element.getAttribute('data-i18n');
        if (translations[lang] && translations[lang][key]) {
            element.innerHTML = translations[lang][key];
        }
    });
}