document.getElementById("downloadButton").addEventListener("click", function () {
    const thankYouMessage = document.getElementById("thankYouMessage");
    
    // Remove d-none to start showing the message, then add show for transition
    thankYouMessage.classList.remove("d-none");
    
    setTimeout(() => {
        thankYouMessage.classList.add("show");
    }, 50); // Delay to allow CSS to process the transition

    // Optional: Hide the message after a few seconds with smooth exit
    setTimeout(() => {
        thankYouMessage.classList.remove("show");
        setTimeout(() => {
            thankYouMessage.classList.add("d-none");
        }, 600); // Delay to match the CSS transition time
    }, 3000);

    
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