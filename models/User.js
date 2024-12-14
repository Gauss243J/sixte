// models/User.js
const mongoose = require('mongoose');
const passportLocalMongoose = require('passport-local-mongoose');

const UserSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true
    },
    // Passport-Local-Mongoose ajoute username & password
});

// Plugin pour Passport-Local-Mongoose
UserSchema.plugin(passportLocalMongoose, { usernameField: 'email' });

module.exports = mongoose.model('User', UserSchema);
