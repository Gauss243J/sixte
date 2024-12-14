// models/Payment.js

const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema({
    amount: { type: Number, required: true },
    paymentDate: { type: Date, default: Date.now },
    loan: { type: mongoose.Schema.Types.ObjectId, ref: 'Loan' },
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' },
});

module.exports = mongoose.model('Payment', PaymentSchema);
