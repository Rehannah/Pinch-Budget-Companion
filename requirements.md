Pinch Budget Companion

Stack:
• React Native front-end application
• Firebase data store
• Firebase authentication

Application is mobile-first, responsive for desktop.

How does it work:

1. On first load or reset:
   User selects Month name and Year, and inputs Budget Base Amount (the fixed pool of money to be divided among the categories)

User adds Categories/Envelopes (if not already loaded from the previous month on reset):
• Expense categories: each has a numeric limit.
• Income categories: no limit (income categories do not store or enforce limits).
• Data must persist between sessions until the user resets for a new month.

App initializes the dashboard using these inputs.

2. Dashboard Page
   Main elements:
   • Displays the month specified from initial setup (Month YYYY). This is editable.
   • Bank pool (based on transactions that are labelled for the bank)
   • Budget Base (fixed, editable).
   • Total Income (based on income transactions this month).
   • Total Expenses (based on expense transactions this month).
   • Savings this Month = Budget Base – Total Expenses
   • Percentage Spent (shown visually as a progress bar) = (Total Expenses / Budget Base) × 100.

Budget Overview:
Filter - by category type (income/expense)
Sort – Name (A-Z), Highest to Lowest amount spent/earned, Lowest to Highest amount spent/earned
Search
Lists all categories (income and expenses). Each show:
• Category name
• Limit amount (for expenses only)
• Amount spent / earned
• Remaining balance.
• A visual indicator (bar/bucket) showing used vs. remaining limit.
• For Income categories, just the amount earned is needed, without any visual bars.
Allows:
• Adding or deleting categories.
• Editing category limits.
• Editing the budget base amount.

Enforcement Rules:
• Expense transactions can exceed the category's numeric limit
• If adding a transaction would cause the total expenses to exceed the Budget Base, the app prompts the user to increase the Budget Base or cancel adding the transaction.
• Editing transactions must be validated the same way as adding them: edits that would make the Budget Base exceed their limits prompts the user to increase the Budget Base or cancel the edit operation.

3. Transactions Page
   Main elements:
   • Displays list of all transactions:
   • Date (dd-mm-yyyy).
   • Category.
   • Amount.
   • Type (Income or Expense).
   • Description.

Allows:
• Adding new transaction.
o When adding a transaction:
Select type (Income or Expense).
Select or add category (adding creates category in dashboard too).
Checkbox for whether it is a bank pool transaction or not.
Enter date, amount, and description.
• Editing existing transaction.
• Deleting transaction.
Upon saving, the dashboard updates automatically. The app should autosave changes made.
Visual cues:
Income transactions appear differently from expense ones (e.g., colour coding or icon).

Bank pool transaction means that the transaction amount is added to the bank pool, not subtracted from the category limits. This means that the expense does not affect the limits of the category, since its amount pulls from the bank and not the budget base. Therefore, it is added to the bank pool amount in the dashboard. Bank pool is the accumulation of bank pool transaction amounts. The bank pool is cumulative, not a balance that gets depleted when you record a transaction. It tells you how much you've spent on these exceptional items.
Bank pool transaction

- The transaction is still recorded as an expense.
- It appears in the transaction log.
- It does not count toward the monthly Budget Base.
- It does not affect the category's spending limit or remaining balance.
- Its amount is added to the Bank Pool total.
- Editing or deleting the transaction recalculates the Bank Pool automatically.

If a transaction is added of category Debts repaid to me or Debt owed to me, the person associated with the debt must also be indicated by putting their name in braces in the description. Eg: [Sam] repaid $50 or $100 borrowed by [Lisa].

If a transaction goes over the limit, the user is warned but allowed to do so. The amount the category is over by is shown in the dashboard.

4. Debts
   Displays a table listing person, previously owing, owing this month, repaid this month, balance
   • Person – the name of the person added from the transactions page e.g.: Lisa or Sam (fixed, pulled from transactions page)
   • Previously Owing – the amount the person was owing before the month’s transactions (default $0, editable)
   • Owing this month (the total from the transactions listed with that person’s name in braces. Eg: the total amount for the transactions of category Debt owed to me with Lisa’s name in braces in the description. (fixed)
   • Repaid this month – The total amount for the transactions of category Debts repaid to me with that person’s name in braces. (fixed)
   • Balance = (Previously Owing + Owing this month) – Repaid this month. (fixed, can be a negative number)
   Editing the information from associated transactions should reflect here as well.

5. Investments
   Investment summary:
   • Current Principal = current amount invested in TTIF; editable through an Edit action.
   • Annual Rate = editable annual percentage rate; default is 3.49% p.a.
   • Unit Price = fixed at TT$20 and is not editable.
   • Units Held = Current Principal / TT$20; calculated and displayed automatically.
   • Investment details are actual saved values and must remain separate from hypothetical projection values.

   Potential Monthly Contribution:
   • Starts at the current month's Savings from the dashboard.
   • A slider temporarily increases the contribution for projection scenarios only.
   • Slider changes must not modify the actual budget, saved principal, or saved contribution data.

   Projection rules:
   • Use the configured annual rate and fixed TT$20 unit price.
   • Compound returns daily and reinvest quarterly payouts into the projected principal; reinvestment is always on and is not user-configurable.
   • Add the Potential Monthly Contribution every 30 days in the hypothetical projection.
   • Display the next quarterly payout (reinvested), projected invested principal (current principal + hypothetical contributions + reinvested quarterly payouts), total projected investment earnings generated, projected one-year value, and estimated monthly income equivalent (total projected annual earnings / 12).
   • Reinvested earnings are already included in projected invested principal and projected one-year value. Do not add total earnings to either value a second time; only interest accrued after the last quarterly reinvestment remains outside projected invested principal at the one-year point.
   • Clearly identify all projection outputs as estimates, not guaranteed returns, and show the assumptions used.

6. Settings Page
   Resetting the app for a new month:
   • Clears transaction records.
   • Prompts for new month and base setup again.
   • Optionally can save categories and their limits to be used for the next month's budget, otherwise all categories and their limits are removed for the next month.
   • Investment data is always saved but pulls from the savings data from the current month.
