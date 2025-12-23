const mongoose = require('mongoose');

const PromocijaShema = new mongoose.Schema({
    slika_url: { type: String, required: true }, // Cloudinary link
    ciljna_drzava: { type: String, default: 'SI' }, // 'SI', 'HR', 'AT', 'IT', itd.
    aktivna: { type: Boolean, default: true },
    
    // Naslov promocije v vseh podprtih jezikih
    naslov: {
        sl: { type: String },
        en: { type: String },
        de: { type: String },
        hr: { type: String },
        it: { type: String },
        fr: { type: String },
        hu: { type: String },
        cs: { type: String },
        es: { type: String },
        et: { type: String },
        nl: { type: String },
        pt: { type: String },
        sk: { type: String }
    },
    
    // Opis promocije v vseh podprtih jezikih
    opis: {
        sl: { type: String },
        en: { type: String },
        de: { type: String },
        hr: { type: String },
        it: { type: String },
        fr: { type: String },
        hu: { type: String },
        cs: { type: String },
        es: { type: String },
        et: { type: String },
        nl: { type: String },
        pt: { type: String },
        sk: { type: String }
    },
    
    ustvarjeno: { type: Date, default: Date.now }
});

// Preverimo, če model že obstaja, da preprečimo napako pri ponovnem nalaganju (OverWriteModelError)
module.exports = mongoose.models.Promocija || mongoose.model('Promocija', PromocijaShema);