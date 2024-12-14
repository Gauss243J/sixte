// routes/dashboard.js

const express = require('express');
const router = express.Router();
const Loan = require('../models/Loan');
const Payment = require('../models/Payment');
const Client = require('../models/Client');
const { ensureAuthenticated } = require('../middleware/auth');
const moment = require('moment');

// Middleware pour s'assurer que l'utilisateur est authentifié
router.use(ensureAuthenticated);

// Page du dashboard avec pagination et filtrage
router.get('/', async (req, res) => {
    try {
        // Récupérer le paramètre de filtrage de la période
        const timeFilter = req.query.timeFilter || 'all';

        // Définir la date de début en fonction du filtre
        let startDate = null;
        const today = moment();

        switch (timeFilter) {
            case '7d':
                startDate = moment().subtract(7, 'days').toDate();
                break;
            case '1m':
                startDate = moment().subtract(1, 'months').toDate();
                break;
            case '3m':
                startDate = moment().subtract(3, 'months').toDate();
                break;
            case '6m':
                startDate = moment().subtract(6, 'months').toDate();
                break;
            case '1y':
                startDate = moment().subtract(1, 'years').toDate();
                break;
            case 'all':
            default:
                startDate = null;
        }

        // Paramètres de pagination pour Prêts Récents et Paiements Récents
        const recentLoansPage = Math.max(1, parseInt(req.query.recentLoansPage)) || 1;
        const recentPaymentsPage = Math.max(1, parseInt(req.query.recentPaymentsPage)) || 1;
        const limit = 5; // Nombre d'éléments par page

        // Filtrer les prêts et paiements en fonction de la période
        let loanFilter = {};
        let paymentFilter = {};

        if (startDate) {
            loanFilter.date = { $gte: startDate };
            paymentFilter.paymentDate = { $gte: startDate };
        }

        // Calcul des totaux des prêts et des paiements
        const [totalLoans, totalPayments, totalAmountLoanedResult, totalAmountPaidResult] = await Promise.all([
            Loan.countDocuments(loanFilter),
            Payment.countDocuments(paymentFilter),
            Loan.aggregate([{ $match: loanFilter }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
            Payment.aggregate([{ $match: paymentFilter }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
        ]);

        const totalAmountLoaned = totalAmountLoanedResult[0]?.total || 0;
        const totalAmountPaid = totalAmountPaidResult[0]?.total || 0;

        // Calcul des dettes restantes
        const debtsRemaining = totalAmountLoaned - totalAmountPaid;

        // Calcul du ratio de paiement pour déterminer le statut
        const paymentRatio = totalAmountLoaned > 0 ? totalAmountPaid / totalAmountLoaned : 0;
        let status = 'Mauvais Payeur';
        if (paymentRatio >= 0.9) {
            status = 'Très Bon Payeur';
        } else if (paymentRatio >= 0.7) {
            status = 'Bon Payeur';
        } else if (paymentRatio >= 0.5) {
            status = 'Payeur Moyen';
        }

        // Calcul des totaux pour la pagination
        const totalRecentLoansPages = Math.ceil(totalLoans / limit);
        const totalRecentPaymentsPages = Math.ceil(totalPayments / limit);

        // S'assurer que les pages actuelles ne dépassent pas le nombre total de pages
        const currentLoansPage = Math.min(recentLoansPage, totalRecentLoansPages) || 1;
        const currentPaymentsPage = Math.min(recentPaymentsPage, totalRecentPaymentsPages) || 1;

        // Récupérer les prêts et paiements paginés
        const [recentLoans, recentPayments] = await Promise.all([
            Loan.find(loanFilter)
                .sort({ date: -1 })
                .limit(limit)
                .skip((currentLoansPage - 1) * limit)
                .populate('client')
                .exec(),
            Payment.find(paymentFilter)
                .sort({ paymentDate: -1 })
                .limit(limit)
                .skip((currentPaymentsPage - 1) * limit)
                .populate('client')
                .exec(),
        ]);

        // Récupérer les données pour les graphiques
        const [paymentsByDate, loansByDate] = await Promise.all([
            Payment.aggregate([
                { $match: paymentFilter },
                {
                    $group: {
                        _id: { $dateToString: { format: "%Y-%m-%d", date: "$paymentDate" } },
                        total: { $sum: "$amount" }
                    }
                },
                { $sort: { _id: 1 } }
            ]),
            Loan.aggregate([
                { $match: loanFilter },
                {
                    $group: {
                        _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
                        total: { $sum: "$amount" }
                    }
                },
                { $sort: { _id: 1 } }
            ]),
        ]);

        // Clients dont les échéances approchent (par exemple, dans les 7 prochains jours)
        const upcomingDate = moment().add(7, 'days').toDate();
        const todays = new Date();

        const upcomingLoans = await Loan.find({
            repaymentDate: { $gte: todays, $lte: upcomingDate },
            status: 'Pending'
        }).populate('client').exec();

        res.render('dashboard', {
            totalLoans,
            totalPayments,
            totalAmountLoaned,
            totalAmountPaid,
            debtsRemaining,
            status,
            recentLoans,
            recentPayments,
            paymentsByDate,
            loansByDate,
            upcomingLoans,
            recentLoansPage: currentLoansPage,
            totalRecentLoansPages,
            recentPaymentsPage: currentPaymentsPage,
            totalRecentPaymentsPages,
            timeFilter // Passer le filtre actuel à la vue
        });
    } catch (err) {
        console.log(err);
        req.flash('error_msg', 'Erreur lors du chargement du dashboard');
        res.redirect('/');
    }
});

module.exports = router;
