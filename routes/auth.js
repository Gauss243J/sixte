// routes/auth.js
const express = require('express');
const router = express.Router();
const passport = require('passport');
const User = require('../models/User');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcrypt');

// Page de login
router.get('/login', (req, res) => {
    res.render('auth/login');
});

// Traitement du login
router.post('/login', passport.authenticate('local', {
    successRedirect: '/dashboard',
    failureRedirect: '/login',
    failureFlash: true
}));

// Page d'inscription
router.get('/register', (req, res) => {
    res.render('auth/register');
});

// Traitement de l'inscription
router.post('/register', [
    body('email').isEmail().withMessage('Email invalide'),
    body('password').isLength({ min: 6 }).withMessage('Le mot de passe doit contenir au moins 6 caractères'),
    body('password2').custom((value, { req }) => {
        if (value !== req.body.password) {
            throw new Error('Les mots de passe ne correspondent pas');
        }
        return true;
    })
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.render('auth/register', { errors: errors.array() });
    }

    const { email, password } = req.body;
    try {
        const user = new User({ email });
        await User.register(user, password);
        req.flash('success_msg', 'Inscription réussie. Vous pouvez maintenant vous connecter.');
        res.redirect('/login');
    } catch (err) {
        req.flash('error_msg', err.message);
        res.redirect('/register');
    }
});

// Déconnexion
router.get('/logout', (req, res, next) => {
    req.logout(function(err) {
        if (err) { return next(err); }
        req.flash('success_msg', 'Vous êtes déconnecté');
        res.redirect('/login');
    });
});

// Mot de passe oublié (simplifié)
router.get('/forgot-password', (req, res) => {
    res.render('auth/forgot-password');
});

// Traitement du mot de passe oublié (à implémenter)
router.post('/forgot-password', async (req, res) => {
    // Implémenter la logique de réinitialisation du mot de passe (email, token, etc.)
    req.flash('success_msg', 'Fonctionnalité à implémenter');
    res.redirect('/login');
});

module.exports = router;
