document.addEventListener('DOMContentLoaded', function() {
    const projectsButton = document.getElementById('projects-button');
    const projectsDropdown = document.getElementById('projects-dropdown');

    // Show/Hide dropdown on click
    projectsButton.addEventListener('click', function(e) {
        e.preventDefault(); // Prevent the default anchor behavior
        projectsDropdown.classList.toggle('hidden');
    });

    // Close dropdown when clicking outside
    window.addEventListener('click', function(e) {
        if (!projectsButton.contains(e.target) && !projectsDropdown.contains(e.target)) {
            projectsDropdown.classList.add('hidden');
        }
    });
});
