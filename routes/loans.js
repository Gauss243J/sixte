// routes/loans.js
const express = require('express');
const router = express.Router();
const Loan = require('../models/Loan');
const Client = require('../models/Client');
const { ensureAuthenticated } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

// Middleware pour s'assurer que l'utilisateur est authentifié
router.use(ensureAuthenticated);

// Liste des prêts avec pagination et filtrage
router.get('/', ensureAuthenticated, async (req, res) => {
    try {
        // Récupérer les paramètres de recherche et de pagination depuis les query params
        const { search, startDate, endDate, status } = req.query;
        const page = parseInt(req.query.page) || 1;
        const limit = 10; // Nombre de prêts par page

        // Construire le filtre de recherche
        let filter = {};

        // Filtrer par statut si fourni
        if (status && status !== 'All') {
            filter.status = status;
        }

        // Filtrer par plage de dates si fourni
        if (startDate && endDate) {
            filter.date = { 
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

        // Calculer le nombre total de prêts correspondant au filtre
        const totalLoans = await Loan.countDocuments(filter).exec();
        const totalPages = Math.ceil(totalLoans / limit);
        const currentPage = Math.min(page, totalPages) || 1;

        // Récupérer les prêts paginés avec les détails du client
        const loans = await Loan.find(filter)
            .populate('client')
            .sort({ date: -1 }) // Trier par date décroissante
            .limit(limit)
            .skip((currentPage - 1) * limit)
            .exec();

        // Définir les options de statut disponibles
        const statusOptions = ['All', 'Pending', 'Repaid', 'Overdue']; // Ajustez selon vos statuts

        res.render('loans/list', { 
            loans, 
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
        req.flash('error_msg', 'Erreur lors de la récupération des prêts');
        res.redirect('/dashboard');
    }
});

// Formulaire d'ajout de prêt
router.get('/add', async (req, res) => {
    const clients = await Client.find().exec();
    res.render('loans/add', { clients });
});

// Traitement de l'ajout de prêt
router.post('/add', [
    body('client').notEmpty().withMessage('Le client est requis'),
    body('amount').isNumeric().withMessage('Le montant doit être un nombre'),
    body('reason').notEmpty().withMessage('Le motif est requis'),
    body('repaymentDate').isISO8601().withMessage('Date de remboursement invalide')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const clients = await Client.find().exec();
        return res.render('loans/add', { errors: errors.array(), clients });
    }

    const { client, amount, reason, repaymentDate } = req.body;

    try {
        const loan = new Loan({
            client,
            amount,
            reason,
            repaymentDate
        });
        await loan.save();
        req.flash('success_msg', 'Prêt ajouté avec succès');
        res.redirect('/loans');
    } catch (err) {
        req.flash('error_msg', 'Erreur lors de l\'ajout du prêt');
        res.redirect('/loans/add');
    }
});

// Modifier un prêt (à implémenter)
router.get('/edit/:id', async (req, res) => {
    try {
        const loan = await Loan.findById(req.params.id).exec();
        if (!loan) {
            req.flash('error_msg', 'Prêt non trouvé');
            return res.redirect('/loans');
        }
        const clients = await Client.find().exec();
        res.render('loans/edit', { loan, clients });
    } catch (err) {
        req.flash('error_msg', 'Erreur lors de la récupération du prêt');
        res.redirect('/loans');
    }
});

// Traitement de la modification du prêt
router.put('/edit/:id', [
    body('client').notEmpty().withMessage('Le client est requis'),
    body('amount').isNumeric().withMessage('Le montant doit être un nombre'),
    body('reason').notEmpty().withMessage('Le motif est requis'),
    body('repaymentDate').isISO8601().withMessage('Date de remboursement invalide')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const loan = await Loan.findById(req.params.id).exec();
        const clients = await Client.find().exec();
        return res.render('loans/edit', { loan, clients, errors: errors.array() });
    }

    const { client, amount, reason, repaymentDate, status } = req.body;

    try {
        const loan = await Loan.findById(req.params.id).exec();
        if (!loan) {
            req.flash('error_msg', 'Prêt non trouvé');
            return res.redirect('/loans');
        }

        loan.client = client;
        loan.amount = amount;
        loan.reason = reason;
        loan.repaymentDate = repaymentDate;
        loan.status = status || 'Pending';
        await loan.save();

        req.flash('success_msg', 'Prêt mis à jour avec succès');
        res.redirect('/loans');
    } catch (err) {
        req.flash('error_msg', 'Erreur lors de la mise à jour du prêt');
        res.redirect('/loans');
    }
});

// Supprimer un prêt
router.delete('/delete/:id', async (req, res) => {
    try {
        await Loan.findByIdAndDelete(req.params.id).exec();
        req.flash('success_msg', 'Prêt supprimé avec succès');
        res.redirect('/loans');
    } catch (err) {
        req.flash('error_msg', 'Erreur lors de la suppression du prêt');
        res.redirect('/loans');
    }
});

// API pour obtenir les prêts par client (utilisé pour les paiements)
router.get('/by-client/:clientId', async (req, res) => {
    try {
        const loans = await Loan.find({ client: req.params.clientId, status: 'Pending' }).exec();
        res.json(loans);
    } catch (err) {
        res.status(500).json({ error: 'Erreur lors de la récupération des prêts' });
    }
});

module.exports = router;
