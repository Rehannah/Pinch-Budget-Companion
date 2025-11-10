const TransactionItem = ({ transaction, onEdit, onDelete }) => {
    return (
        <div className="transaction-item">
            <div className="transaction-details">
                <span className="transaction-date">{transaction.date}</span>
                <span className="transaction-description">{transaction.description}</span>
                <span className={`transaction-amount ${transaction.type}`}>
                    {transaction.type === 'income' ? '+' : '-'}${transaction.amount.toFixed(2)}
                </span>
            </div>
            <div className="transaction-actions">
                <button onClick={() => onEdit(transaction.id)}>Edit</button>
                <button onClick={() => onDelete(transaction.id)}>Delete</button>
            </div>
        </div>
    );
};

export default TransactionItem;