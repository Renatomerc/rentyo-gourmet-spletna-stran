// ========================================
// 🟢 uporabnik.js — Uporabnik model (Sedaj izvaža samo SHEMO!)
// POPRAVLJENO: Dodan fcmToken za PUSH obvestila
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
        default: 0
    },

    // 🔥 KRITIČNA ZAČASNA SPREMEMBA: Odstranitev default: null in unique: true
    // To prisili Mongoose, da izbriše problematičen indeks 'fcmToken_1' v bazi.
    fcmToken: { 
        type: String, 
        // default: null, // IZBRISANO/ZAKOMENTIRANO
        // unique: true,  // IZBRISANO/ZAKOMENTIRANO
        sparse: true 
    },

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