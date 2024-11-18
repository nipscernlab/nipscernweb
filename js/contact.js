function handleSubmit(event) {
    event.preventDefault();

    // Get form values
    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const message = document.getElementById('message').value;

    // Perform submission logic (e.g., send to a server)
    console.log('Form submitted:', {
        name,
        email,
        message
    });

    // Reset the form
    event.target.reset();

    // Display a success message (can be enhanced further)
    alert('Thank you for contacting us, ' + name + '! We will get back to you soon.');
}

