// routes/clients.js

const express = require('express');
const router = express.Router();
const Client = require('../models/Client');
const { ensureAuthenticated } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const Loan = require('../models/Loan');
const Payment = require('../models/Payment');
// Middleware pour s'assurer que l'utilisateur est authentifié
router.use(ensureAuthenticated);

// Liste des clients avec pagination et filtres
router.get('/', async (req, res) => {
    const { page = 1, limit = 10, search, startDate, endDate } = req.query;

    const query = {};
    if (search) {
        query.name = { $regex: search, $options: 'i' };
    }
    if (startDate && endDate) {
        query.registrationDate = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    try {
        const clients = await Client.find(query)
            .sort({ registrationDate: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .exec();

        const count = await Client.countDocuments(query);

        res.render('clients/list', {
            clients,
            totalPages: Math.ceil(count / limit),
            currentPage: page,
            search,
            startDate,
            endDate
        });
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Erreur lors de la récupération des clients');
        res.redirect('/dashboard');
    }
});

// Formulaire d'ajout de client
router.get('/add', (req, res) => {
    res.render('clients/add');
});

// Traitement de l'ajout de client
router.post('/add', [
    body('name').notEmpty().withMessage('Le nom est requis'),
    body('phone').notEmpty().withMessage('Le numéro de téléphone est requis')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.render('clients/add', { errors: errors.array() });
    }

    const { name, email, phone, address } = req.body;

    try {
        const client = new Client({
            name,
            contactInfo: { email, phone, address }
        });
        await client.save();
        req.flash('success_msg', 'Client ajouté avec succès');
        res.redirect('/clients');
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Erreur lors de l\'ajout du client');
        res.redirect('/clients/add');
    }
});

// Détails d'un client avec pagination
router.get('/:id', ensureAuthenticated, async (req, res) => {
    try {
        const clientId = req.params.id;

        // Vérifiez si l'ID est valide
        if (!mongoose.Types.ObjectId.isValid(clientId)) {
            req.flash('error_msg', 'ID de client invalide');
            return res.redirect('/clients');
        }

        // Récupérez le client de base
        const client = await Client.findById(clientId).exec();

        if (!client) {
            req.flash('error_msg', 'Client non trouvé');
            return res.redirect('/clients');
        }

        // Obtenez les paramètres de pagination depuis les query params
        const loansPage = Math.max(1, parseInt(req.query.loansPage)) || 1;
        const paymentsPage = Math.max(1, parseInt(req.query.paymentsPage)) || 1;
        const limit = 5;

        // Récupérez le nombre total de prêts et de paiements
        const [totalLoans, totalPayments] = await Promise.all([
            Loan.countDocuments({ client: clientId }).exec(),
            Payment.countDocuments({ client: clientId }).exec()
        ]);

        // Calculez le nombre total de pages pour prêts et paiements
        const totalLoansPages = Math.ceil(totalLoans / limit);
        const totalPaymentsPages = Math.ceil(totalPayments / limit);

        // S'assurer que les pages actuelles ne dépassent pas le nombre total de pages
        const validLoansPage = Math.min(loansPage, totalLoansPages) || 1;
        const validPaymentsPage = Math.min(paymentsPage, totalPaymentsPages) || 1;

        // Récupérez les prêts paginés
        const loans = await Loan.find({ client: clientId })
            .sort({ date: -1 }) // Trier par date décroissante
            .limit(limit)
            .skip((validLoansPage - 1) * limit)
            .exec();

        // Récupérez les paiements paginés avec les détails du prêt
        const payments = await Payment.find({ client: clientId })
            .sort({ paymentDate: -1 }) // Trier par date de paiement décroissante
            .limit(limit)
            .skip((validPaymentsPage - 1) * limit)
            .populate('loan')
            .exec();

        // Récupérez le total des prêts et des paiements via agrégation
        const [totalLoanAmountResult, totalPaymentAmountResult] = await Promise.all([
            Loan.aggregate([
                { $match: { client: new mongoose.Types.ObjectId(clientId) } },
                { $group: { _id: null, total: { $sum: "$amount" } } }
            ]),
            Payment.aggregate([
                { $match: { client: new mongoose.Types.ObjectId(clientId) } },
                { $group: { _id: null, total: { $sum: "$amount" } } }
            ])
        ]);

        const totalLoanAmount = totalLoanAmountResult[0]?.total || 0;
        const totalPaymentAmount = totalPaymentAmountResult[0]?.total || 0;

        // Calculez les dettes restantes
        const debtsRemaining = Math.max(totalLoanAmount - totalPaymentAmount, 0);

        // Calculez le ratio de paiement pour déterminer le statut
        const paymentRatio = totalLoanAmount > 0 ? Math.min(totalPaymentAmount / totalLoanAmount, 1) : 1;

        let status = 'Mauvais Payeur';
        if (paymentRatio >= 0.9) {
            status = 'Très Bon Payeur';
        } else if (paymentRatio >= 0.7) {
            status = 'Bon Payeur';
        } else if (paymentRatio >= 0.5) {
            status = 'Payeur Moyen';
        }

        // Logs pour débogage
        console.log('Client:', client);
        console.log('Total Loans:', totalLoanAmount);
        console.log('Total Payments:', totalPaymentAmount);
        console.log('Debts Remaining:', debtsRemaining);
        console.log('Payment Ratio:', paymentRatio);
        console.log('Status:', status);

        res.render('clients/detail', { 
            client, 
            status, 
            loans, 
            payments, 
            debtsRemaining,
            loansPage: validLoansPage,
            paymentsPage: validPaymentsPage,
            totalLoansPages,
            totalPaymentsPages
        });
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Erreur lors de la récupération des détails du client');
        res.redirect('/clients');
    }
});

module.exports = router;

// Modifier un client
router.get('/edit/:id', async (req, res) => {
    try {
        const client = await Client.findById(req.params.id).exec();
        if (!client) {
            req.flash('error_msg', 'Client non trouvé');
            return res.redirect('/clients');
        }
        res.render('clients/edit', { client });
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Erreur lors de la récupération du client');
        res.redirect('/clients');
    }
});

// Traitement de la modification du client
router.put('/edit/:id', [
    body('name').notEmpty().withMessage('Le nom est requis'),
    body('phone').notEmpty().withMessage('Le numéro de téléphone est requis')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const client = await Client.findById(req.params.id).exec();
        return res.render('clients/edit', { client, errors: errors.array() });
    }

    const { name, email, phone, address } = req.body;

    try {
        const client = await Client.findById(req.params.id).exec();
        if (!client) {
            req.flash('error_msg', 'Client non trouvé');
            return res.redirect('/clients');
        }

        client.name = name;
        client.contactInfo = { email, phone, address };
        await client.save();

        req.flash('success_msg', 'Client mis à jour avec succès');
        res.redirect('/clients/' + req.params.id);
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Erreur lors de la mise à jour du client');
        res.redirect('/clients');
    }
});

// Supprimer un client
router.delete('/delete/:id', async (req, res) => {
    try {
        await Client.findByIdAndDelete(req.params.id).exec();
        req.flash('success_msg', 'Client supprimé avec succès');
        res.redirect('/clients');
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Erreur lors de la suppression du client');
        res.redirect('/clients');
    }
});

module.exports = router;
