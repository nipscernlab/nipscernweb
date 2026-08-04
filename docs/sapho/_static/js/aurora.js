document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('img[alt*="captura" i], img[alt*="AURORA" i]')
    .forEach((img) => img.classList.add('screenshot'));
});
