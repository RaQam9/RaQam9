document.addEventListener('DOMContentLoaded', () => {
    const alertButton = document.getElementById('alertButton');
    const messageElement = document.getElementById('message');

    alertButton.addEventListener('click', () => {
        messageElement.textContent = 'رائع! الزر يعمل!';
        console.log('Button was clicked!');
    });
});
