// models/Client.js

const mongoose = require('mongoose');

const ClientSchema = new mongoose.Schema({
    name: { type: String, required: true },
    registrationDate: { type: Date, default: Date.now },
    contactInfo: {
        email: { type: String },
        phone: { type: String },
        address: { type: String },
    },
    loans: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Loan' }],
    payments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Payment' }],
});

module.exports = mongoose.model('Client', ClientSchema);
