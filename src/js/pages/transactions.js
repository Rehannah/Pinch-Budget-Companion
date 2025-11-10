// This file contains the logic for the transactions page, including functions to add, edit, and delete transactions.

document.addEventListener('DOMContentLoaded', function() {
    const transactionForm = document.getElementById('transaction-form');
    const transactionList = document.getElementById('transaction-list');

    // Load transactions from LocalForage
    loadTransactions();

    // Event listener for adding a transaction
    transactionForm.addEventListener('submit', function(event) {
        event.preventDefault();
        const transactionData = new FormData(transactionForm);
        const transaction = {
            id: Date.now(),
            description: transactionData.get('description'),
            amount: parseFloat(transactionData.get('amount')),
            type: transactionData.get('type') // 'income' or 'expense'
        };
        addTransaction(transaction);
        transactionForm.reset();
    });

    // Function to load transactions from LocalForage
    function loadTransactions() {
        localforage.getItem('transactions').then(transactions => {
            if (transactions) {
                transactions.forEach(transaction => {
                    displayTransaction(transaction);
                });
            }
        }).catch(err => {
            console.error('Error loading transactions:', err);
        });
    }

    // Function to add a transaction
    function addTransaction(transaction) {
        localforage.getItem('transactions').then(transactions => {
            transactions = transactions || [];
            transactions.push(transaction);
            localforage.setItem('transactions', transactions).then(() => {
                displayTransaction(transaction);
            }).catch(err => {
                console.error('Error saving transaction:', err);
            });
        });
    }

    // Function to display a transaction
    function displayTransaction(transaction) {
        const transactionItem = document.createElement('div');
        transactionItem.className = 'transaction-item';
        transactionItem.innerHTML = `
            <span>${transaction.description}</span>
            <span>${transaction.amount}</span>
            <span>${transaction.type}</span>
            <button class="edit-btn" data-id="${transaction.id}">Edit</button>
            <button class="delete-btn" data-id="${transaction.id}">Delete</button>
        `;
        transactionList.appendChild(transactionItem);

        // Event listeners for edit and delete buttons
        transactionItem.querySelector('.edit-btn').addEventListener('click', () => editTransaction(transaction.id));
        transactionItem.querySelector('.delete-btn').addEventListener('click', () => deleteTransaction(transaction.id));
    }

    // Function to edit a transaction
    function editTransaction(id) {
        // Logic for editing a transaction will go here
        console.log('Edit transaction with ID:', id);
    }

    // Function to delete a transaction
    function deleteTransaction(id) {
        localforage.getItem('transactions').then(transactions => {
            transactions = transactions.filter(transaction => transaction.id !== id);
            localforage.setItem('transactions', transactions).then(() => {
                loadTransactions(); // Reload transactions to reflect changes
            }).catch(err => {
                console.error('Error deleting transaction:', err);
            });
        });
    }
});