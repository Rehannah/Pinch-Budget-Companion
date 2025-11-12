const Header = () => {
    return `
    <header class="w-full bg-white dark:bg-surface border-b p-3">
        <div class="max-w-lg mx-auto flex items-center justify-between">
          <a href="dashboard.html" class="text-primary font-semibold">Pinch</a>
          <div class="flex items-center gap-3">
            <!-- Top navigation (visible on small+ screens) -->
            <nav class="hidden sm:flex gap-3" aria-label="Main navigation">
              <a data-nav href="dashboard.html" class="text-gray-600 dark:text-gray-300">Dashboard</a>
              <a data-nav href="transactions.html" class="text-gray-600 dark:text-gray-300">Transactions</a>
              <a data-nav href="settings.html" class="text-gray-600 dark:text-gray-300">Settings</a>
            </nav>
          </div>
        </div>
      </header>

      <!-- Mobile bottom navigation (rendered here so header is the single source of truth) -->
      <nav class="bottom-nav block md:hidden fixed inset-x-0 bottom-0 bg-white border-t">
        <div class="max-w-lg mx-auto flex justify-around items-center p-2">
          <a data-nav href="dashboard.html" class="p-3 text-center text-sm">Dashboard</a>
          <a data-nav href="transactions.html" class="p-3 text-center text-sm">Transactions</a>
          <a data-nav href="settings.html" class="p-3 text-center text-sm">Settings</a>
        </div>
      </nav>
    `;
};

function highlightActiveLinks(container=document){
    try{
        const current = (location.pathname.split('/').pop() || 'dashboard.html');
        const links = Array.from(container.querySelectorAll('a[data-nav]'));
        links.forEach(a=>{
            const href = a.getAttribute('href') || '';
            if(href === current || (href === 'dashboard.html' && current === '')){
                a.classList.add('text-primary','font-semibold');
                a.setAttribute('aria-current','page');
            } else {
                a.classList.remove('text-primary','font-semibold');
                a.removeAttribute('aria-current');
            }
        });
    }catch(e){ console.warn('highlightActiveLinks error', e); }
}

// Called after Header() has been injected into the DOM to wire up active link state.
export function initHeader(){
    const el = document.getElementById('app-header');
    if(!el) return;
    highlightActiveLinks(el);
    // Re-highlight on navigation (in case links are used without full page reload)
    window.addEventListener('popstate', ()=> highlightActiveLinks(document));
}

export default Header;