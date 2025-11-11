const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); // Še vedno rabimo, če ga uporabljamo za metode

const UporabnikShema = new mongoose.Schema({
    ime: { type: String, required: true, trim: true },
    priimek: { type: String, trim: true },
    telefon: { type: String },
    
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    geslo: { type: String, required: true },
    
    jeLastnik: { type: Boolean, default: false },
    // required funkcija je pravilna
    cena: { type: Number, default: 0, required: function() { return this.jeLastnik; } },
    
    // 🟢 NOVO POLJE: Točke zvestobe
    tockeZvestobe: {
        type: Number,
        default: 0
    }

}, { timestamps: true });

// Metoda za primerjavo gesla ostaja, ker je uporabljena v routerju
UporabnikShema.methods.primerjajGeslo = async function(vnesenoGeslo) {
    return bcrypt.compare(vnesenoGeslo, this.geslo);
};


// ⭐ KLJUČNA SPREMEMBA: Izvozimo SAMO shemo.
// Končni model se bo ustvaril v 'uporabnikRouter.js' s povezavo na dbUsers.
module.exports = UporabnikShema;
