# Pinch-Budget-Companion

## Overview
This project is a mobile-first web application designed to manage personal finances. It includes a dashboard for budget tracking, a transactions page for managing income and expenses, and a settings page for data management.

## Project Structure
```
pinch-budget-companion
├── src
│   ├── dashboard.html
│   ├── login.html
│   ├── settings.html
│   ├── transactions.html
│   ├── manifest.json
│   ├── css
│   │   ├── components.css
│   │   └── styles.css
│   ├── components
│   │   └── header.js
│   ├── firebase-config.js
│   └── js
│       ├── app.js
│       ├── auth.js
│       ├── auth-ui.js
│       ├── cloud-storage.js
│       ├── login.js
│       └── pages
│           ├── dashboard.js
│           ├── settings.js
│           └── transactions.js
├── package.json
├── package-lock.json
├── README.md
└── requirements.md
```

## Features
- **Dashboard**: View budget information, category limits, and transaction summaries. Add or delete categories and update budget amounts.
- **Transactions**: Track all transactions, with options to add, edit, or delete entries. Distinguish between income and expenses visually.
- **Settings**: Manage app data with options to export to Excel, restart for a new month, and import data from a file.

## Technologies Used
- HTML, CSS, JavaScript
- Bootstrap 5
- Firebase Authentication
- Firestore cloud storage

## Setup & Development

1. Clone the repository:

```bash
git clone <repository-url>
cd pinch-budget-companion
```

2. Install dependencies:

```bash
npm install
```

3. Serve the app locally:

```bash
npm run serve
```

4. Open the app in your browser at `http://localhost:8000`.

Notes:
- App state is stored in Firestore and synchronized per authenticated user.
- The app is designed as a static multi-page web app using ES modules.

## Usage
- Navigate through the app using the header links.
- Use the dashboard to manage your budget.
- Track transactions on the transactions page.
- Adjust settings as needed in the settings page.

## Contributing
Contributions are welcome! Please submit a pull request or open an issue for any enhancements or bug fixes.

## License
This project is licensed under the MIT License.