// Simple renderer for a transaction item — returns an HTML string for insertion.
function TransactionItem(transaction){
    const sign = transaction.type === 'income' ? '+' : '-';
    const cls = transaction.type === 'income' ? 'text-success' : 'text-danger';
    return `
        <div class="transaction-item flex items-center justify-between p-2 border-b">
            <div>
                <div class="text-sm">${transaction.date} • ${transaction.description || ''}</div>
            </div>
            <div class="text-right ${cls} font-semibold">${sign}$${Number(transaction.amount).toFixed(2)}</div>
        </div>
    `;
}

export default TransactionItem;