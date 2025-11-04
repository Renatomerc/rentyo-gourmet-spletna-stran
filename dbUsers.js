const mongoose = require('mongoose');
require('dotenv').config();

const mongoURIUsers = process.env.DB_URI_USERS;

// Sekundarna povezava za uporabnike
const dbUsers = mongoose.createConnection(mongoURIUsers, {
    dbName: 'rentyo_users_auth', // Explicitno ime baze
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

dbUsers.on('connected', () => {
    console.log('✅ Povezava z MongoDB (Uporabniki) je uspešna! Baza: rentyo_users_auth');
});

dbUsers.on('error', (err) => {
    console.error('❌ Napaka pri povezovanju na MongoDB (Uporabniki):', err);
});

// Exportamo **povezavo**
module.exports = dbUsers;
