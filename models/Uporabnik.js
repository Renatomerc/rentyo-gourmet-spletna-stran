// ========================================
// 🟢 uporabnik.js — Uporabnik model (POPRAVLJEN IZVOZ)
// ========================================

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); 

const UporabnikShema = new mongoose.Schema({
    ime: { type: String, required: true, trim: true },
    priimek: { type: String, trim: true },
    telefon: { type: String },
    
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    geslo: { type: String, required: true },
    
    // 🟢 NOVO: Polje za shranjevanje Google ID-ja
    googleId: { type: String, unique: true, sparse: true }, 

    jeLastnik: { type: Boolean, default: false },
    cena: { type: Number, default: 0, required: function() { return this.jeLastnik; } },
    
    tockeZvestobe: {
        type: Number,
        default: 100 // KLJUČNO POPRAVLJENO: Začetnih 100 točk
    }

}, { timestamps: true });

// Metoda za primerjavo gesla
UporabnikShema.methods.primerjajGeslo = async function(vnesenoGeslo) {
    // Prepreči primerjanje gesla za uporabnike, ustvarjene z Google OAuth.
    if (this.googleId || this.geslo.startsWith('google_oauth_user_no_password_set_')) {
        return false; 
    }
    
    // Za navadne uporabnike uporabimo bcrypt primerjavo
    return bcrypt.compare(vnesenoGeslo, this.geslo);
};


// ⭐ KRITIČEN POPRAVEK: Ustvarimo in izvozimo MODEL (Uporabnik) iz sheme (UporabnikShema).
// Sedaj lahko kličemo Uporabnik.findById, Uporabnik.create itd.
const Uporabnik = mongoose.model('Uporabnik', UporabnikShema);
module.exports = Uporabnik;