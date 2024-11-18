function toggleAnswer(questionElement) {
    const answerElement = questionElement.nextElementSibling;
    const iconElement = questionElement.querySelector('.icon');

    // Toggle visibility of the answer
    if (answerElement.style.display === "block") {
        answerElement.style.display = "none";
        iconElement.classList.remove('active');
    } else {
        answerElement.style.display = "block";
        iconElement.classList.add('active');
    }
}
