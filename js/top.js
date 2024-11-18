window.onscroll = function() { scrollFunction(); };

function scrollFunction() {
  const backToTopBtn = document.getElementById("backToTopBtn");
  // Check if the page has been scrolled down
  if (document.body.scrollTop > 20 || document.documentElement.scrollTop > 20) {
    backToTopBtn.style.display = "block"; // Ensure it's in the layout
    setTimeout(() => {
      backToTopBtn.style.opacity = "1"; // Fade in smoothly
    }, 10); // Small delay for smooth fade-in
  } else {
    backToTopBtn.style.opacity = "0"; // Fade out smoothly
    setTimeout(() => {
      if (backToTopBtn.style.opacity === "0") {
        backToTopBtn.style.display = "none"; // Hide after fade-out
      }
    }, 500); // Match the fade-out duration
  }
}

// Smooth scroll back to top
document.getElementById("backToTopBtn").onclick = function() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
};
