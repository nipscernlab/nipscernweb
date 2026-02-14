function toggleAnswer(button) {
    const icon = button.querySelector('.icon');
    const answer = button.nextElementSibling;
    
    // Fecha todos os outros (opcional - remova este bloco se quiser permitir múltiplos abertos)
    const allQuestions = document.querySelectorAll('.faq-question');
    allQuestions.forEach(item => {
        if (item !== button && item.classList.contains('active')) {
            item.classList.remove('active');
            item.nextElementSibling.style.maxHeight = null;
            item.nextElementSibling.style.opacity = '0';
        }
    });

    // Alterna o atual
    button.classList.toggle('active');

    if (button.classList.contains('active')) {
        answer.style.maxHeight = answer.scrollHeight + "px";
        answer.style.opacity = "1";
    } else {
        answer.style.maxHeight = null;
        answer.style.opacity = "0";
    }
}