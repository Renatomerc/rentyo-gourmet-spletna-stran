// ========================================
// 🟢 uporabnik.js — Uporabnik model (Sedaj izvaža samo SHEMO!)
// POPRAVLJENO: Dodan fcmToken za PUSH obvestila
// POPRAVLJENO: Dodana podpora za AppleId in posodobljena validacija gesla
// ⭐ NOVO: Polja za ponastavitev gesla so ostala, a je odstranjena metoda getResetPasswordToken, saj sedaj uporabljamo OTP v Controllerju
// ⭐ NOVO: DODANO POLJE ZA PRILJUBLJENE RESTAVRACIJE
// ========================================

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); 
// ⭐ OPOMBA: Uvoz 'crypto' ni več potreben v tem modelu, ker je odstranjena funkcija getResetPasswordToken
// const crypto = require('crypto'); // Odstranjeno, ker ni več potrebno

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

    // 🔥 NOVO: POLJE ZA PRILJUBLJENE RESTAVRACIJE (SHRANJUJEMO ID-je)
    favorite_restaurants: [{
        type: mongoose.Schema.ObjectId,
        ref: 'Restavracija'
    }],
    
    // 🔥 POPRAVKI ZA FCM TOKEN: Odstranitev default: null in unique: true
    fcmToken: { 
        type: String, 
        sparse: true 
    },
    
    // ⭐ NOVO: POLJA ZA PONASTAVITEV GESLA ⭐
    // Ta polja uporabljamo za shranjevanje NEHEŠIRANE 6-mestne kode in 5-minutnega časa poteka (logika je v authController.js)
    resetPasswordToken: { type: String, select: false }, 
    resetPasswordExpires: { type: Date, select: false },

}, { timestamps: true });

// Metoda za primerjavo gesla
UporabnikShema.methods.primerjajGeslo = async function(vnesenoGeslo) {
    // ⭐ POSODOBLJENO: Preveri tudi, ali obstaja Apple ID
    if (!this.geslo || this.googleId || this.appleId) {
        return false; 
    }
    return bcrypt.compare(vnesenoGeslo, this.geslo);
};


// ❌ ODSTRANJENO: Stara metoda getResetPasswordToken, ki je heširala žetone, je odstranjena.
// Celotna logika (generiranje OTP in shranjevanje) se zdaj izvaja v authController.js.

// ⭐ KRITIČEN POPRAVEK: Izvažamo SAMO Shemo, ne modela.
// Model bo definiran ločeno na primarni (mongoose) in sekundarni (dbUsers) povezavi.
module.exports = UporabnikShema;