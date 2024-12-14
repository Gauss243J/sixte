// middleware/auth.js
module.exports = {
    ensureAuthenticated: function(req, res, next) {
        if (req.isAuthenticated()) {
            return next();
        }
        req.flash('error_msg', 'Veuillez vous connecter pour accéder à cette page');
        res.redirect('/login');
    }
};
