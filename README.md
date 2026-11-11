# Pinch-Budget-Companion

## Overview

Pinch Budget Companion is a mobile-first personal budgeting web application designed to complement an existing monthly budgeting spreadsheet.

The application helps users manage their monthly budget, track income and expenses, monitor category spending limits, and record exceptional one-off expenses.

## Project Structure

```text
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

### 1. Dashboard

Provides an overview of the current month's budget, income, expenses, and category allocations.

### 2. Transactions

Provides a centralized record of all income and expenses.

### 3. Debts

Provides an overview of money owed to the user and repayments received.

### 4. Investments

Provides a simple investment projection tool.

### 5. Settings

Provides options for managing the current month's budget and application data.

## Technologies Used

- HTML5
- CSS3
- JavaScript (ES Modules)
- Bootstrap 5
- Firebase Authentication
- Cloud Firestore

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

3. Serve the application locally:

```bash
npm run serve
```

4. Open the application in your browser:

`http://localhost:8000`

## Contributing

Contributions are welcome! Please submit a pull request or open an issue for enhancements, bug fixes, or suggestions.

## License

This project is licensed under the MIT License.
