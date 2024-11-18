document.addEventListener('DOMContentLoaded', function () {
    const languageButton = document.getElementById('language-button');
    const languageDropdown = document.getElementById('language-dropdown');
    const selectedLanguage = document.querySelector('.selected-language');
    const selectedFlag = document.getElementById('selected-flag');

    // Toggle dropdown visibility
    languageButton.addEventListener('click', function () {
        const isVisible = languageDropdown.classList.toggle('show');
        languageDropdown.style.pointerEvents = isVisible ? 'auto' : 'none';
    });

    // Handle language selection
    document.querySelectorAll('#language-dropdown a').forEach(function (option) {
        option.addEventListener('click', function (event) {
            event.preventDefault();
            const language = option.getAttribute('data-lang');
            const logo = option.getAttribute('data-logo');

            selectedLanguage.textContent = option.textContent.trim();
            selectedFlag.src = logo;
            languageDropdown.classList.remove('show');
            languageDropdown.style.pointerEvents = 'none';

            localStorage.setItem('selectedLanguage', JSON.stringify({ lang: language, logo }));
            loadTranslations().then(translations => {
                translatePage(translations, language);
            });
        });
    });

    // Load stored language on page load
    const storedLanguage = JSON.parse(localStorage.getItem('selectedLanguage'));
    if (storedLanguage) {
        selectedLanguage.textContent = storedLanguage.lang === 'en' ? '🇬🇧 English' :
            storedLanguage.lang === 'pt' ? '🇧🇷 Português' :
            storedLanguage.lang === 'no' ? '🇳🇴 Norge' : '🇫🇷 Français';
        selectedFlag.src = storedLanguage.logo;
        loadTranslations().then(translations => {
            translatePage(translations, storedLanguage.lang);
        });
    }

    // Close dropdown if clicked outside
    document.addEventListener('click', function (event) {
        if (!languageButton.contains(event.target) && !languageDropdown.contains(event.target)) {
            languageDropdown.classList.remove('show');
            languageDropdown.style.pointerEvents = 'none';
        }
    });
});

// Load translations from JSON file
async function loadTranslations() {
    const response = await fetch('../nipscernwebtest/projects/language.json');
    return await response.json();
}

// Translate page elements
function translatePage(translations, lang) {
    document.querySelectorAll('[data-i18n]').forEach((element) => {
        const key = element.getAttribute('data-i18n');
        if (translations[lang] && translations[lang][key]) {
            element.innerHTML = translations[lang][key];
        }
    });
}
