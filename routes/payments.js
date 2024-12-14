// routes/payments.js
const express = require('express');
const router = express.Router();
const Payment = require('../models/Payment');
const Client = require('../models/Client');
const Loan = require('../models/Loan');
const { ensureAuthenticated } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

// Middleware pour s'assurer que l'utilisateur est authentifié
router.use(ensureAuthenticated);



// Liste des paiements avec pagination et filtrage
router.get('/', ensureAuthenticated, async (req, res) => {
    try {
        // Récupérer les paramètres de recherche et de pagination depuis les query params
        const { search, startDate, endDate, status } = req.query;
        const page = parseInt(req.query.page) || 1;
        const limit = 10; // Nombre de paiements par page

        // Construire le filtre de recherche
        let filter = {};

        // Filtrer par statut si fourni
        if (status && status !== 'All') {
            filter.status = status;
        }

        // Filtrer par plage de dates si fourni
        if (startDate && endDate) {
            filter.paymentDate = { 
                $gte: new Date(startDate), 
                $lte: new Date(endDate) 
            };
        }

        // Filtrer par nom de client si fourni
        if (search) {
            // Rechercher les clients correspondant au nom
            const clients = await Client.find({ name: { $regex: search, $options: 'i' } }).select('_id').exec();
            const clientIds = clients.map(client => client._id);
            filter.client = { $in: clientIds };
        }

        // Calculer le nombre total de paiements correspondant au filtre
        const totalPayments = await Payment.countDocuments(filter).exec();
        const totalPages = Math.ceil(totalPayments / limit);
        const currentPage = Math.min(page, totalPages) || 1;

        // Récupérer les paiements paginés avec les détails du client et du prêt
        const payments = await Payment.find(filter)
            .populate('client loan')
            .sort({ paymentDate: -1 }) // Trier par date de paiement décroissante
            .limit(limit)
            .skip((currentPage - 1) * limit)
            .exec();

        // Définir les options de statut disponibles
        const statusOptions = ['All', 'Completed', 'Pending', 'Failed']; // Ajustez selon vos statuts

        res.render('payments/list', { 
            payments, 
            currentPage, 
            totalPages, 
            search: search || '',
            startDate: startDate || '',
            endDate: endDate || '',
            status: status || 'All',
            statusOptions
        });
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Erreur lors de la récupération des paiements');
        res.redirect('/dashboard');
    }
});



// Formulaire d'ajout de paiement
router.get('/add', async (req, res) => {
    const clients = await Client.find().exec();
    res.render('payments/add', { clients });
});

// Traitement de l'ajout de paiement
router.post('/add', [
    body('client').notEmpty().withMessage('Le client est requis'),
    body('loan').notEmpty().withMessage('Le prêt est requis'),
    body('amount').isNumeric().withMessage('Le montant doit être un nombre')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const clients = await Client.find().exec();
        return res.render('payments/add', { errors: errors.array(), clients });
    }

    const { client, loan, amount } = req.body;

    try {
        const payment = new Payment({
            client,
            loan,
            amount
        });
        await payment.save();

        // Mettre à jour le statut du prêt si nécessaire
        const loanDoc = await Loan.findById(loan);
        if (loanDoc) {
            loanDoc.amount -= amount;
            if (loanDoc.amount <= 0) {
                loanDoc.status = 'Repaid';
            }
            await loanDoc.save();
        }

        req.flash('success_msg', 'Paiement effectué avec succès');
        res.redirect('/payments');
    } catch (err) {
        req.flash('error_msg', 'Erreur lors de l\'ajout du paiement');
        res.redirect('/payments/add');
    }
});

// Modifier un paiement (à implémenter)
router.get('/edit/:id', async (req, res) => {
    try {
        const payment = await Payment.findById(req.params.id).exec();
        if (!payment) {
            req.flash('error_msg', 'Paiement non trouvé');
            return res.redirect('/payments');
        }
        const clients = await Client.find().exec();
        const loans = await Loan.find({ client: payment.client }).exec();
        res.render('payments/edit', { payment, clients, loans });
    } catch (err) {
        req.flash('error_msg', 'Erreur lors de la récupération du paiement');
        res.redirect('/payments');
    }
});

// Traitement de la modification du paiement
router.put('/edit/:id', [
    body('client').notEmpty().withMessage('Le client est requis'),
    body('loan').notEmpty().withMessage('Le prêt est requis'),
    body('amount').isNumeric().withMessage('Le montant doit être un nombre')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const payment = await Payment.findById(req.params.id).exec();
        const clients = await Client.find().exec();
        const loans = await Loan.find({ client: payment.client }).exec();
        return res.render('payments/edit', { payment, clients, loans, errors: errors.array() });
    }

    const { client, loan, amount } = req.body;

    try {
        const payment = await Payment.findById(req.params.id).exec();
        if (!payment) {
            req.flash('error_msg', 'Paiement non trouvé');
            return res.redirect('/payments');
        }

        // Récupérer l'ancien prêt pour ajuster le montant
        const oldLoan = await Loan.findById(payment.loan).exec();
        if (oldLoan) {
            oldLoan.amount += payment.amount;
            if (oldLoan.amount > 0 && oldLoan.status === 'Repaid') {
                oldLoan.status = 'Pending';
            }
            await oldLoan.save();
        }

        // Mettre à jour le paiement
        payment.client = client;
        payment.loan = loan;
        payment.amount = amount;
        await payment.save();

        // Mettre à jour le nouveau prêt
        const newLoan = await Loan.findById(loan).exec();
        if (newLoan) {
            newLoan.amount -= amount;
            if (newLoan.amount <= 0) {
                newLoan.status = 'Repaid';
            }
            await newLoan.save();
        }

        req.flash('success_msg', 'Paiement mis à jour avec succès');
        res.redirect('/payments');
    } catch (err) {
        req.flash('error_msg', 'Erreur lors de la mise à jour du paiement');
        res.redirect('/payments');
    }
});

// Supprimer un paiement
router.delete('/delete/:id', async (req, res) => {
    try {
        const payment = await Payment.findById(req.params.id).exec();
        if (!payment) {
            req.flash('error_msg', 'Paiement non trouvé');
            return res.redirect('/payments');
        }

        // Récupérer le prêt pour ajuster le montant
        const loan = await Loan.findById(payment.loan).exec();
        if (loan) {
            loan.amount += payment.amount;
            if (loan.amount > 0 && loan.status === 'Repaid') {
                loan.status = 'Pending';
            }
            await loan.save();
        }

        await Payment.findByIdAndDelete(req.params.id).exec();
        req.flash('success_msg', 'Paiement supprimé avec succès');
        res.redirect('/payments');
    } catch (err) {
        req.flash('error_msg', 'Erreur lors de la suppression du paiement');
        res.redirect('/payments');
    }
});

module.exports = router;

