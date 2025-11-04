const mongoose = require('mongoose');

// 1. Shema za vdelan dokument Rezervacija
// Vrača se v to datoteko, da se lahko vključi v MizaSchema, saj je struktura v bazi vpeta!
const RezervacijaSchema = new mongoose.Schema({
    casStart: { type: Number, required: true },
    trajanjeUr: { type: Number, required: true },
    imeGosta: { type: String, required: true },
    telefon: String,
    stevilo_oseb: { type: Number, required: true },
    datum: { type: String, required: true },
    // Mongoose bo avtomatsko dodal _id, kot je v vaši bazi.
});

// 2. Shema za vdelan dokument Miza
const MizaSchema = new mongoose.Schema({
    // Uporabil sem 'Miza' kot ste vi, čeprav je v JSON primeru 'ime'. 
    Miza: { type: String, required: true }, 
    kapaciteta: { type: Number, default: 4 }, 
    
    // 🔥 KLJUČNI POPRAVEK: Vračanje arraya 'rezervacije'
    rezervacije: [RezervacijaSchema] 
});

// 3. Shema za lokalizirane opise (za i18n)
const LocalizedDescriptionSchema = new mongoose.Schema({
    sl: String, // Slovenski opis
    en: String, // Angleški opis
    hr: String, // Hrvaški opis
    de: String, // Nemški opis
}, { _id: false });


// 4. GLAVNA Shema za Restavracijo - OHRANJA OSNOVNE PODATKE IN MIZE
const RestavracijaSchema = new mongoose.Schema({
    // ----- OBSTOJEČA POLJA -----
    ime: {
        type: String,
        required: [true, 'Ime restavracije je obvezno.'],
        trim: true
    },
    email: { 
        type: String,
        required: [true, 'E-mail je obvezen.'],
        unique: true,
        lowercase: true, 
        collation: { locale: 'en', strength: 2 } 
    },
    geslo: { 
        type: String,
        required: [true, 'Geslo je obvezno.']
    },
    imePodjetja: String, 
    naslovPodjetja: String, 
    davcnaStevilka: String, 
    drzava: String,
    cuisine: [String], 
    
    delovniCasStart: { type: Number, default: 8 }, 
    delovniCasEnd: { type: Number, default: 23 },   

    mize: [MizaSchema], // Mize ostanejo vdelane, kar je OK

    status: { 
        type: String, 
        default: 'neaktivna_ceka_placilo',
        enum: ['aktivna', 'neaktivna_ceka_placilo', 'aktivna_ceka_potrditev_trr'] 
    },

    // ----- NOVA POLJA, KI JIH POTREBUJE FRONTEND/BAZA -----
    
    // Polja za prikaz na kartici in v detajlih
    ocena_povprecje: { type: Number, default: 0 },
    st_ocen: { type: Number, default: 0 },
    priceRange: { type: Number, default: 1, min: 1, max: 3 }, 
    
    // Lokaliziran opis za i18n
    description: LocalizedDescriptionSchema, 
    
    // Slike
    mainImageUrl: String,
    galleryUrls: [String],

    // Meni (lokaliziran, kot objekt)
    menu: {
        sl: Object, 
        en: Object,
        hr: Object,
        de: Object,
    },
    
    // Geolokacija za zemljevid v modalu
    latitude: Number, 
    longitude: Number,

}, {
    timestamps: true,
    collection: 'restavracijas' 
});

// Ustvarjanje in izvoz Mongoose Modela
const Restavracija = mongoose.model('Restavracija', RestavracijaSchema);

module.exports = Restavracija;