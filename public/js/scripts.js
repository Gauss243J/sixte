// public/js/scripts.js

// Confirmation avant suppression
document.addEventListener('DOMContentLoaded', () => {
    const deleteButtons = document.querySelectorAll('.delete-btn');
    deleteButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            if (!confirm('Êtes-vous sûr de vouloir supprimer cet élément?')) {
                e.preventDefault();
            }
        });
    });

    // Confirmation avant envoi de SMS
    const smsForms = document.querySelectorAll('form[action^="/sms/send-reminder"]');
    smsForms.forEach(form => {
        form.addEventListener('submit', (e) => {
            const confirmSend = confirm('Êtes-vous sûr de vouloir envoyer un SMS de rappel à ce client?');
            if (!confirmSend) {
                e.preventDefault();
            }
        });
    });
});
