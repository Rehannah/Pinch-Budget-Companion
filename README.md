# Pinch-Budget-Companion

## Overview
This project is a mobile-first web application designed to manage personal finances. It includes a dashboard for budget tracking, a transactions page for managing income and expenses, and a settings page for data management.

## Project Structure
```
pinch-budget-companion
├── src
│   ├── dashboard.html
│   ├── transactions.html
│   ├── settings.html
│   ├── manifest.json
│   ├── sw.js
│   ├── css
│   │   ├── styles.css
│   │   └── components.css
│   ├── js
│   │   ├── app.js
│   │   ├── router.js
│   │   ├── storage.js
│   │   ├── lib
│   │   │   └── localforage.min.js
│   │   └── pages
│   │       ├── dashboard.js
│   │       ├── transactions.js
│   │       └── settings.js
│   └── components
│       ├── header.js
│       └── transaction-item.js
├── package.json
├── .gitignore
└── README.md
```

## Features
- **Dashboard**: View budget information, category limits, and transaction summaries. Add or delete categories and update budget amounts.
- **Transactions**: Track all transactions, with options to add, edit, or delete entries. Distinguish between income and expenses visually.
- **Settings**: Manage app data with options to export to Excel, restart for a new month, and import data from a file.

## Technologies Used
- HTML, CSS, JavaScript
- LocalForage for offline storage
- Progressive Web App (PWA) capabilities

## Setup & Development

This project uses Vite + Tailwind for development and builds. The source HTML/JS live in `src/` and the production build is output to `dist/`.

1. Clone the repository:

```bash
git clone <repository-url>
cd pinch-budget-companion
```

2. Install dependencies:

```bash
npm install
```

3. Run the dev server (hot reload):

```bash
npm run dev
```

Open the URL printed by Vite (usually http://localhost:5173). The dev server serves the `src/` directory and processes Tailwind via PostCSS.

4. Build for production:

```bash
npm run build
```

Built assets are placed in `dist/`.

5. Preview the production build locally:

```bash
npm run preview
```

Notes:
- The app stores data locally using LocalForage (IndexedDB). That keeps data across sessions until the user resets for a new month.
- For quick prototyping we used Tailwind directives in `src/css/styles.css` and Vite/PostCSS to produce final CSS.
- Tests will be added/recreated after a final code cleanup; a Vitest setup is present but tests may be adapted.

## Usage
- Navigate through the app using the header links.
- Use the dashboard to manage your budget.
- Track transactions on the transactions page.
- Adjust settings as needed in the settings page.

## Contributing
Contributions are welcome! Please submit a pull request or open an issue for any enhancements or bug fixes.

## License
This project is licensed under the MIT License.