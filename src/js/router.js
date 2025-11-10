// This file handles navigation between different pages of the application, managing the loading of content dynamically.

const routes = {
    '/': 'index.html',
    '/dashboard': 'dashboard.html',
    '/transactions': 'transactions.html',
    '/settings': 'settings.html',
};

function navigateTo(route) {
    const contentDiv = document.getElementById('content');
    const page = routes[route] || routes['/'];

    fetch(page)
        .then(response => response.text())
        .then(html => {
            contentDiv.innerHTML = html;
            // Optionally, you can call a specific initialization function for the loaded page
            if (page === 'dashboard.html') {
                initDashboard();
            } else if (page === 'transactions.html') {
                initTransactions();
            } else if (page === 'settings.html') {
                initSettings();
            }
        })
        .catch(error => {
            console.error('Error loading page:', error);
            contentDiv.innerHTML = '<p>Error loading page. Please try again later.</p>';
        });
}

window.addEventListener('popstate', () => {
    navigateTo(location.pathname);
});

document.addEventListener('DOMContentLoaded', () => {
    const links = document.querySelectorAll('a[data-route]');
    links.forEach(link => {
        link.addEventListener('click', (event) => {
            event.preventDefault();
            const route = link.getAttribute('href');
            history.pushState(null, '', route);
            navigateTo(route);
        });
    });

    // Initial navigation
    navigateTo(location.pathname);
});