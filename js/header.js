window.addEventListener('DOMContentLoaded', () => {

    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            const id = entry.target.getAttribute('id');
            if (entry.intersectionRatio > 0) {
                document.querySelector(`nav li a[href="#${id}"]`).parentElement.classList.add('active');
            } else {
                document.querySelector(`nav li a[href="#${id}"]`).parentElement.classList.remove('active');
            }
        });
    });

    // Track all sections that have an `id` applied
    document.querySelectorAll('section[id]').forEach((section) => {
        observer.observe(section);
    });

});

document.addEventListener('DOMContentLoaded', function() {
    const toggleNavButton = document.getElementById('toggle-nav-button');
    const nav = document.querySelector('nav.section-nav');

    toggleNavButton.addEventListener('click', function() {
        if (nav.classList.contains('visible')) {
            // Hide the navigation with smooth transition
            nav.classList.remove('visible');
            setTimeout(() => {
                nav.classList.add('hidden');
            }, 300); // Duration of the fade-out transition
        } else {
            // Show the navigation with smooth transition
            nav.classList.remove('hidden');
            setTimeout(() => {
                nav.classList.add('visible');
            }, 10); // A slight delay to trigger the transition
        }
    });
});