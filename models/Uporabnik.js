// ========================================
// 🟢 uporabnik.js — Uporabnik model (Sedaj izvaža samo SHEMO!)
// ========================================

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); 

const UporabnikShema = new mongoose.Schema({
    ime: { type: String, required: true, trim: true },
    priimek: { type: String, trim: true },
    telefon: { type: String },
    
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    // Pomembno: geslo ni obvezno, če je prisoten googleId
    geslo: { type: String, required: function() { return !this.googleId; } }, 
    
    googleId: { type: String, unique: true, sparse: true }, 

    jeLastnik: { type: Boolean, default: false },
    cena: { type: Number, default: 0, required: function() { return this.jeLastnik; } },
    
    tockeZvestobe: {
        type: Number,
        default: 100
    }

}, { timestamps: true });

// Metoda za primerjavo gesla
UporabnikShema.methods.primerjajGeslo = async function(vnesenoGeslo) {
    if (!this.geslo || this.googleId) {
        return false; 
    }
    return bcrypt.compare(vnesenoGeslo, this.geslo);
};


// ⭐ KRITIČEN POPRAVEK: Izvažamo SAMO Shemo, ne modela.
// Model bo definiran ločeno na primarni (mongoose) in sekundarni (dbUsers) povezavi.
module.exports = UporabnikShema;