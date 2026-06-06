Core idea of application:

The application tracks a user's income and expenses across various categories and encourages the user to stick to their budget that they pre-set for the month.

Stack:

React Native front end appplication

Firebase data store

Firebase authentication

Application is mobile-first, responsive for desktop.

On first load or reset:

User selects Month (Month name + Year).

User inputs Budget Base Amount (the fixed pool of money to be divided).

User adds Categories:

- Expense categories: each has a numeric limit.

- Income categories: no limit (income categories do not store or enforce limits).

- Data must persist between sessions until the user resets for a new month.

App initializes the dashboard using these inputs.

3. Dashboard Page

Main elements:

Displays the month specified from initial setup(Month YYYY). This is editable.

Shows:

Budget Base (fixed, editable).

Total Income (this month).

Total Expenses (this month).

Budget Overview:

Remaining = Budget Base – Total Expenses.

Percentage Spent = (Total Expenses / Budget Base) × 100.

Should include a visual representation of how much is remaining.

Lists all categories (income and expenses):

Each shows:

Category name.

Limit amount (for expenses only).

Amount spent / earned.

Remaining balance.

A visual indicator (bar/bucket) showing used vs. remaining limit.

Income categories are styled differently from expenses.

Allows:

Adding or deleting categories.

Editing category limits.

Editing the budget base amount.

Enforcement Rules:

- Expense transactions can exceed the category's numeric limit as the goal is to track spendings and stick to the limit as much as possible.

- If total expenses would exceed the Budget Base, the app prompts the user to increase the Budget Base or cancel the operation.

- Editing transactions must be validated the same way as adding them: edits that would make the Budget Base exceed their limits are blocked unless the user increases the Budget Base via the provided UI.

4. Transactions Page

Main elements:

Displays list of all transactions:

Date (dd-mm-yyyy).

Category.

Amount.

Type (Income or Expense).

Description.

Allows:

Adding new transaction.

Editing existing transaction.

Deleting transaction.

When adding a transaction:

Select type (Income or Expense).

Select or add category (adding creates category in dashboard too).

Enter date, amount, and description.

Upon saving, the dashboard updates automatically. The app should autosave changes made.

Visual cues:

Income transactions appear differently from expense ones (e.g., color coding or icon).

5. Settings Page

Reset the app for a new month:

Clears transaction records.

Prompts for new month and base setup again.

Optionally can save categories and their limits to be used for the next month's budget, otherwise all categories and their limits are removed for the next month.
