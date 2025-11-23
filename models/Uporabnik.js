const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); 

const UporabnikShema = new mongoose.Schema({
    ime: { type: String, required: true, trim: true },
    priimek: { type: String, trim: true },
    telefon: { type: String },
    
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    geslo: { type: String, required: true },
    
    // 🟢 NOVO: Polje za shranjevanje Google ID-ja
    // sparse: true omogoča, da je večina dokumentov brez Google ID-ja (če niso prijavljeni z Googlom)
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
    // 🚨 KLJUČNI POPRAVEK: Prepreči primerjanje gesla za uporabnike, ustvarjene z Google OAuth.
    // V passportConfig.js smo predvideli, da se geslo nastavi kot 'google_oauth_user_no_password_set_...'
    if (this.googleId || this.geslo.startsWith('google_oauth_user_no_password_set_')) {
        // Če je uporabnik prijavljen z Googlom, vedno vrnemo FALSE,
        // s čimer preprečimo prijavo preko navadne /prijava rute.
        return false; 
    }
    
    // Za navadne uporabnike uporabimo bcrypt primerjavo
    return bcrypt.compare(vnesenoGeslo, this.geslo);
};


// ⭐ KLJUČNA SPREMEMBA: Izvozimo SAMO shemo.
module.exports = UporabnikShema;