// models/Loan.js

const mongoose = require('mongoose');

const LoanSchema = new mongoose.Schema({
    amount: { type: Number, required: true },
    date: { type: Date, default: Date.now },
    reason: { type: String, required: true },
    repaymentDate: { type: Date, required: true },
    status: { type: String, required: true, default: 'Pending' }, // Ajout de la valeur par défaut
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' },
});

module.exports = mongoose.model('Loan', LoanSchema);
