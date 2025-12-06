// ========================================
// 🟢 uporabnik.js — Uporabnik model (Sedaj izvaža samo SHEMO!)
// POPRAVLJENO: Dodan fcmToken za PUSH obvestila
// POPRAVLJENO: Dodana podpora za AppleId in posodobljena validacija gesla
// ========================================

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); 

const UporabnikShema = new mongoose.Schema({
    ime: { type: String, required: true, trim: true },
    priimek: { type: String, trim: true },
    telefon: { type: String },
    
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    
    // ⭐ POSODOBLJENO: Geslo ni obvezno, če je prisoten googleId ALI appleId
    geslo: { 
        type: String, 
        required: function() { 
            // Geslo je obvezno, samo če ni prisoten socialni ID
            return !this.googleId && !this.appleId; 
        } 
    }, 
    
    googleId: { type: String, unique: true, sparse: true }, 
    
    // ⭐ NOVO: POLJE ZA APPLE ID
    appleId: { 
        type: String, 
        unique: true, 
        sparse: true 
    }, 

    jeLastnik: { type: Boolean, default: false },
    cena: { type: Number, default: 0, required: function() { return this.jeLastnik; } },
    
    // ⭐ POLJE ZA DRŽAVO
    drzava: { 
        type: String, 
        required: true,      // Polje je obvezno pri novih registracijah
        default: 'Neznano',  // Privzeta vrednost za nazaj združljivost (starejši uporabniki)
        trim: true 
    },
    // ⭐ KONEC POLJA

    tockeZvestobe: {
        type: Number,
        default: 0
    },

    // 🔥 POPRAVKI ZA FCM TOKEN: Odstranitev default: null in unique: true
    fcmToken: { 
        type: String, 
        sparse: true 
    },

}, { timestamps: true });

// Metoda za primerjavo gesla
UporabnikShema.methods.primerjajGeslo = async function(vnesenoGeslo) {
    // ⭐ POSODOBLJENO: Preveri tudi, ali obstaja Apple ID
    if (!this.geslo || this.googleId || this.appleId) {
        return false; 
    }
    return bcrypt.compare(vnesenoGeslo, this.geslo);
};


// ⭐ KRITIČEN POPRAVEK: Izvažamo SAMO Shemo, ne modela.
// Model bo definiran ločeno na primarni (mongoose) in sekundarni (dbUsers) povezavi.
module.exports = UporabnikShema;