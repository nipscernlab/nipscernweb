// Function to handle site translation - update links as needed
function translateSite(language) {
    alert(`Switching site language to ${language}`);
    // Logic for changing the language (fetching translations, etc.)
}


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