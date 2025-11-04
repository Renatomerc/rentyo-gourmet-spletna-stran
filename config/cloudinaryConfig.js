const cloudinary = require('cloudinary').v2; // Uporaba 'require'

cloudinary.config({
    // VNESITE VAŠE DEJANSKE, PREVERJENE KLJUČE:
    cloud_name: 'dv2enn06r', // Preverite, če je 0 ali O. Prej je bilo dv2ennm6r, zdaj dv2enn06r
    api_key: '841128837943596',
    api_secret: 'Zbsc6fO8V4fd33plrOPH4xVWanU', // 👈 VNESITE SVOJ TAJNI KLJUČ TUKAJ!
    secure: true
});

module.exports = cloudinary;