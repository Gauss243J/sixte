// routes/sms.js
const express = require('express');
const router = express.Router();
const Client = require('../models/Client');
const Loan = require('../models/Loan');
const twilioClient = require('../config/twilio');
const { ensureAuthenticated } = require('../middleware/auth');

// Middleware pour s'assurer que l'utilisateur est authentifié
router.use(ensureAuthenticated);

// Route pour envoyer un SMS de rappel
router.post('/send-reminder/:loanId', async (req, res) => {
    const loanId = req.params.loanId;

    try {
        const loan = await Loan.findById(loanId).populate('client').exec();
        if (!loan) {
            req.flash('error_msg', 'Prêt non trouvé');
            return res.redirect('/dashboard');
        }

        const client = loan.client;
        if (!client.contactInfo.phone) {
            req.flash('error_msg', `Le client ${client.name} n'a pas de numéro de téléphone enregistré.`);
            return res.redirect('/dashboard');
        }

        const messageBody = `Bonjour ${client.name}, ceci est un rappel pour votre prêt de ${loan.amount}€ à rembourser avant le ${loan.repaymentDate.toDateString()}. Merci!`;

        await twilioClient.messages.create({
            body: messageBody,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: client.contactInfo.phone
        });

        req.flash('success_msg', `SMS de rappel envoyé à ${client.name}`);
        res.redirect('/dashboard');
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Erreur lors de l\'envoi du SMS');
        res.redirect('/dashboard');
    }
});

module.exports = router;
