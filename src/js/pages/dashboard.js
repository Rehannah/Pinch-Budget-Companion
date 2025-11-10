// This file contains the logic specific to the dashboard page, including functions to update the budget overview and manage categories.

document.addEventListener('DOMContentLoaded', function() {
    const budgetOverview = document.getElementById('budget-overview');
    const categoryList = document.getElementById('category-list');
    const addCategoryForm = document.getElementById('add-category-form');
    const categoryInput = document.getElementById('category-input');
    const budgetInput = document.getElementById('budget-input');

    // Load initial data from LocalForage
    loadDashboardData();

    // Event listener for adding a new category
    addCategoryForm.addEventListener('submit', function(event) {
        event.preventDefault();
        const categoryName = categoryInput.value;
        const budgetAmount = parseFloat(budgetInput.value);
        if (categoryName && !isNaN(budgetAmount)) {
            addCategory(categoryName, budgetAmount);
            categoryInput.value = '';
            budgetInput.value = '';
        }
    });

    // Function to load dashboard data
    function loadDashboardData() {
        // Retrieve budget and categories from LocalForage
        localforage.getItem('categories').then(function(categories) {
            if (categories) {
                categories.forEach(category => {
                    displayCategory(category.name, category.budget);
                });
            }
        }).catch(function(err) {
            console.error('Error loading categories:', err);
        });

        // Retrieve total budget from LocalForage
        localforage.getItem('totalBudget').then(function(totalBudget) {
            budgetOverview.textContent = totalBudget ? `Total Budget: $${totalBudget.toFixed(2)}` : 'Total Budget: $0.00';
        }).catch(function(err) {
            console.error('Error loading total budget:', err);
        });
    }

    // Function to display a category
    function displayCategory(name, budget) {
        const categoryItem = document.createElement('li');
        categoryItem.textContent = `${name}: $${budget.toFixed(2)}`;
        categoryList.appendChild(categoryItem);
    }

    // Function to add a new category
    function addCategory(name, budget) {
        localforage.getItem('categories').then(function(categories) {
            categories = categories || [];
            categories.push({ name, budget });
            return localforage.setItem('categories', categories);
        }).then(function() {
            displayCategory(name, budget);
        }).catch(function(err) {
            console.error('Error adding category:', err);
        });
    }
});