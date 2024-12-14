// server.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const flash = require('connect-flash');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const methodOverride = require('method-override');
const MongoStore = require('connect-mongo');
const path = require('path');
const bodyParser = require('body-parser');

// Import des modèles
const User = require('./models/User');

// Import des routes
const authRoutes = require('./routes/auth');
const clientRoutes = require('./routes/clients');
const loanRoutes = require('./routes/loans');
const paymentRoutes = require('./routes/payments');
const dashboardRoutes = require('./routes/dashboard');
const smsRoutes = require('./routes/sms');

const app = express();

// Connexion à la base de données
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log('MongoDB connecté'))
  .catch(err => console.log(err));

// Configuration EJS
app.set('view engine', 'ejs');
app.set('view options', { basedir: path.join(__dirname, 'views') });



// Middlewares
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(methodOverride('_method'));

// Session
app.use(session({
    secret: process.env.SESSION_SECRET || 'secret',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }),
    cookie: { maxAge: 1000 * 60 * 60 * 24 } // 1 jour
}));

// Flash messages
app.use(flash());

// Passport.js
app.use(passport.initialize());
app.use(passport.session());

// Configuration Passport Local Strategy
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// Middleware pour passer les variables à toutes les vues
app.use((req, res, next) => {
    res.locals.currentUser = req.user;
    res.locals.success_msg = req.flash('success_msg');
    res.locals.error_msg = req.flash('error_msg');
    res.locals.error = req.flash('error');
    res.locals.currentPath = req.path; // Ajout de cette ligne
    next();
});

// Routes
app.use('/', authRoutes);
app.use('/clients', clientRoutes);
app.use('/loans', loanRoutes);
app.use('/payments', paymentRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/sms', smsRoutes);

// Route principale
app.get('/', (req, res) => {
    res.redirect('/dashboard');
});

// Démarrer le serveur
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
});
