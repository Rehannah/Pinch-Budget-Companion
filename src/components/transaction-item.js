// Simple renderer for a transaction item — returns an HTML string for insertion.
function TransactionItem(transaction){
    const sign = transaction.type === 'income' ? '+' : '-';
    const cls = transaction.type === 'income' ? 'text-success' : 'text-danger';
    return `
        <div class="transaction-item d-flex align-items-center justify-content-between p-2 border-bottom">
            <div>
                <div class="small">${transaction.date} • ${transaction.description || ''}</div>
            </div>
            <div class="text-end ${cls} fw-semibold">${sign}$${Number(transaction.amount).toFixed(2)}</div>
        </div>
    `;
}

export default TransactionItem;