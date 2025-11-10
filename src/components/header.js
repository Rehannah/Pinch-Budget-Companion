const Header = () => {
    return `
  <header class="w-full bg-surface border-b p-3">
            <div class="max-w-lg mx-auto flex items-center justify-between">
                <a href="index.html" class="text-primary font-semibold">Pinch</a>
                <div class="flex items-center gap-3">
                  <nav class="hidden sm:flex gap-3">
                    <a href="dashboard.html" class="text-gray-600">Dashboard</a>
                    <a href="transactions.html" class="text-gray-600">Transactions</a>
                    <a href="settings.html" class="text-gray-600">Settings</a>
                  </nav>
                  <button id="dark-toggle-btn" class="p-2 rounded bg-gray-100 text-sm">Dark</button>
                </div>
            </div>
        </header>
    `;
};

export default Header;