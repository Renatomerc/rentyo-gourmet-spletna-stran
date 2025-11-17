// ===============================================
// 🗄️ RESTAVRACIJA MODEL (Mongoose Shema)
// POPRAVLJENO: Dodan rezervacijaId v shemo Komentarjev
// ===============================================
const mongoose = require('mongoose');

// 1. Shema za vdelan dokument Rezervacija
const RezervacijaSchema = new mongoose.Schema({
    // 🟢 POPRAVEK: DODAN KLJUČNI uporabnikId za povezavo z registriranim uporabnikom
    uporabnikId: {
        type: mongoose.Schema.Types.ObjectId, // Uporabimo pravilen Mongoose tip
        ref: 'Uporabnik' // Referenca na Uporabnik model
    },
    status: { 
        type: String, 
        default: 'POTRJENO',
        enum: ['POTRJENO', 'PREKLICANO', 'ZAKLJUČENO'] 
    },
    
    casStart: { type: Number, required: true },
    trajanjeUr: { type: Number, required: true },
    imeGosta: { type: String, required: true },
    telefon: String,
    stevilo_oseb: { type: Number, required: true },
    datum: { type: String, required: true },
});

// 2. Shema za vdelan dokument Miza
const MizaSchema = new mongoose.Schema({
    Miza: { type: String, required: true }, 
    kapaciteta: { type: Number, default: 4 }, 
    rezervacije: [RezervacijaSchema] 
});

// 3. Shema za lokalizirane opise (za i18n)
const LocalizedDescriptionSchema = new mongoose.Schema({
    sl: String, // Slovenski opis
    en: String, // Angleški opis
    hr: String, // Hrvaški opis
    de: String, // Nemški opis
}, { _id: false });


// =======================================================
// 🟢 POPRAVLJENO: Podshema za Komentarje - Dodan rezervacijaId
// =======================================================
const KomentarShema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Uporabnik', // Povezava na vaš model uporabnika
        required: true
    },
    uporabniskoIme: {
        type: String,
        required: true,
        default: 'Anonimni gost'
    },
    ocena: {
        type: Number,
        min: 1,
        max: 5,
        required: true
    },
    komentar: {
        type: String,
        trim: true,
        maxlength: 500
    },
    // ⭐ KLJUČNA SPREMEMBA: DODAJANJE rezervacijaId
    rezervacijaId: { 
        type: mongoose.Schema.Types.ObjectId,
        required: true, 
        // Unique index na tej ravni sheme ne bo deloval v vdelanem dokumentu,
        // vendar je pomemben za logiko preverjanja na Express routerju.
    },
    datum: {
        type: Date,
        default: Date.now
    }
}, { _id: true }); 


// 4. GLAVNA Shema za Restavracijo 
const RestavracijaSchema = new mongoose.Schema({
    // ----- OSNOVNA POLJA -----
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

    mize: [MizaSchema], 

    status: { 
        type: String, 
        default: 'neaktivna_ceka_placilo',
        enum: ['aktivna', 'neaktivna_ceka_placilo', 'aktivna_ceka_potrditev_trr'] 
    },

    // ----- DODATNA POLJA ZA FRONTEND IN GEO-ISKANJE -----
    
    // 🔥 POPRAVLJENO: Dodan setter za pravilno shranjevanje decimalne vrednosti
    ocena_povprecje: { 
        type: Number, 
        default: 0,
        min: 0,
        max: 5,
        // Setter poskrbi, da se vrednost shranjuje na eno decimalno mesto
        set: v => parseFloat(v).toFixed(1) 
    },
    st_ocen: { type: Number, default: 0, min: 0 },
    
    // 🌟 NOVO: Polje za shranjevanje vseh komentarjev in ocen
    komentarji: [KomentarShema], 
    
    priceRange: { type: Number, default: 1, min: 1, max: 3 }, 
    
    description: LocalizedDescriptionSchema, 
    
    mainImageUrl: String,
    // 🔥 POPRAVEK: Zamenjano galleryUrls z GALERIJA_SLIK
    galerija_slik: { 
        type: [String], // Array stringov
        default: []
    },

    menu: {
        sl: Object, 
        en: Object,
        hr: Object,
        de: Object,
    },
    
    // 🔥 NOVO: Polja za Google oceno
    googleRating: { 
        type: Number, 
        default: 0,
        min: 0,
        max: 5
    },
    googleReviewCount: { 
        type: Number, 
        default: 0
    },
    // ------------------------------------------------
    
    // 🔥 KLJUČNO: Geospatial polje (MongoDB GeoJSON Point)
    lokacija: {
        type: {
            type: String, // Mora biti 'Point'
            enum: ['Point'], 
            required: false // Ni zahtevano za vso bazo
        },
        coordinates: {
            type: [Number], // [longitude, latitude]
            required: false
        }
    },
    
    // Originalni latitude in longitude za vsak slučaj (čeprav je 'lokacija' boljši)
    latitude: Number, 
    longitude: Number,

}, {
    timestamps: true,
    collection: 'restavracijas' 
});

// 🔥 KLJUČNO: Dodajanje 2dsphere indeksa za polje 'lokacija'
RestavracijaSchema.index({ lokacija: '2dsphere' });


// Ustvarjanje in izvoz Mongoose Modela
const Restavracija = mongoose.model('Restavracija', RestavracijaSchema);

module.exports = Restavracija;