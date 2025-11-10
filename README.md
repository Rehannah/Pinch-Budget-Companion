# Pinch-Budget-Companion

## Overview
This project is a mobile-first web application designed to manage personal finances. It includes a dashboard for budget tracking, a transactions page for managing income and expenses, and a settings page for data management.

## Project Structure
```
pinch-budget-companion
├── src
│   ├── index.html
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

## Setup Instructions
1. Clone the repository:
   ```
   git clone <repository-url>
   ```
2. Navigate to the project directory:
   ```
3. Install dependencies (if any):
   ```
   npm install
   ```
4. Open `src/index.html` in a web browser to view the application.

## Usage
- Navigate through the app using the header links.
- Use the dashboard to manage your budget.
- Track transactions on the transactions page.
- Adjust settings as needed in the settings page.

## Contributing
Contributions are welcome! Please submit a pull request or open an issue for any enhancements or bug fixes.

## License
This project is licensed under the MIT License.