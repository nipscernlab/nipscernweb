document.addEventListener("DOMContentLoaded", function () {
    let translations;
    let preferredLanguage = localStorage.getItem("preferredLanguage") || "en";

    function applyTranslations(language, translations) {
        const elements = document.querySelectorAll("[data-i18n]");
        elements.forEach(function (element) {
            const key = element.getAttribute("data-i18n");
            if (translations[language] && translations[language][key]) {
                if (element.tagName.toLowerCase() === "title") {
                    document.title = translations[language][key];
                } else if (element.id === "downloadBtn") {
                    element.textContent = translations[language][key];
                } else {
                    element.textContent = translations[language][key];
                }
            }
        });
        localStorage.setItem("preferredLanguage", language);
    }

    fetch("/json/json_idioma.json")
        .then(response => response.json())
        .then(data => {
            translations = data;
            if (!Object.keys(translations).includes(preferredLanguage)) {
                preferredLanguage = "en";
            }
            applyTranslations(preferredLanguage, translations);

            const languageButtons = document.querySelectorAll(".language-selector .language-option");
            languageButtons.forEach(button => {
                button.addEventListener("click", function () {
                    const language = this.getAttribute("data-lang");
                    applyTranslations(language, translations);
                });
            });
        })
        .catch(error => {
            console.error("Error loading translations:", error);
        });

    document.getElementById("downloadBtn").addEventListener("click", function () {
        const fileUrl = "https://github.com/nipscernlab/websapho/raw/main/files/SAPHO.exe";
        const a = document.createElement("a");
        a.href = fileUrl;
        a.download = "SAPHO.exe";  // Name of the file after download
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    });
});
