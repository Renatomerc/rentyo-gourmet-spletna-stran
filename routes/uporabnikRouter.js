// ==========================================================
// 🟢 POSODOBLJENA uporabnikRoutes.js — Router za Avtentikacijo
// Logika PREMAKNJENA v authController.js! Ta datoteka sedaj samo USMERJA.
// ==========================================================
module.exports = (JWT_SECRET_KEY, preveriGosta, zahtevajPrijavo) => { 

    const express = require('express');
    const router = express.Router();
    // Odstranjeni uvozi: jwt, bcrypt (so v Controllerju)
    const mongoose = require('mongoose'); 
    const passport = require('passport'); 

    // ⭐ 1. Uvoz Shem in Modelov
    const UporabnikShema = require('../models/Uporabnik'); 
    const Restavracija = require('../models/Restavracija');
    const dbUsers = require('../dbUsers'); 

    // ⭐ 2. KLJUČNO: Ustvarimo model Uporabnik (na sekundarni povezavi)
    const Uporabnik = dbUsers.model('Uporabnik', UporabnikShema); 
    
    // ⭐ 3. KLJUČNO: UVOZIMO CELOTEN AUTH CONTROLLER!
    // Controller sedaj prejme ključ in modele, ki jih potrebuje za izvajanje logike.
    const authController = require('../controllers/authController')(
        JWT_SECRET_KEY, 
        Uporabnik, 
        Restavracija 
    );
    
    // ==========================================================
    // 🟠 GLAVNE RUTe, KI KLIČEJO FUNKCIJE IZ CONTROLLERJA
    // ==========================================================

    // Prijava / Registracija / Odjava
    // Logika je v authController.js
    router.post('/registracija', authController.registracija);
    router.post('/prijava', authController.prijava);
    router.post('/odjava', authController.odjava);

    // Profil (Zaščitene poti)
    router.get('/profil', preveriGosta, zahtevajPrijavo, authController.profil);
    router.delete('/profil', preveriGosta, zahtevajPrijavo, authController.izbrisProfila);
    
    
    // ⭐ NOVE POTI ZA PONASTAVITEV GESLA ⭐
    // Obe funkciji kličeta logiko iz Controllerja
    router.post('/forgot-password', authController.forgotPassword);
    router.post('/reset-password/:token', authController.resetPassword);

    // ==========================================================
    // 🔴 SOCIALNA PRIJAVA Z GOOGLE & APPLE RUTE (OSTANEJO TUKAJ!)
    // Ker potrebujejo Passport.js (req, res, next) in generiranje tokena
    // ==========================================================

    // --- GOOGLE PRIJAVA ---
    router.get('/google', (req, res, next) => {
        const redirectUrl = req.query.redirectUrl || '/'; 
        passport.authenticate('google', { 
            scope: ['profile', 'email'],
            state: redirectUrl 
        })(req, res, next);
    });

    router.get('/google/callback', 
        passport.authenticate('google', { 
            session: false, 
            failureRedirect: '/?status=error&msg=Go_neuspešno' 
        }), 
        (req, res) => {
            // Uporabimo pomožne funkcije iz Controllerja!
            const zeton = authController.generirajZeton(req.user._id);
            authController.nastaviAuthPiškotek(res, zeton); 
            
            const frontendRedirectUrl = req.query.state || '/';
            res.redirect(`${frontendRedirectUrl}?zeton=${zeton}&ime=${req.user.ime}&jeLastnik=${req.user.jeLastnik || false}&telefon=${req.user.telefon || ''}`);
        }
    );

    // --- APPLE PRIJAVA ---
    router.get('/apple', (req, res, next) => {
        const redirectUrl = req.query.redirectUrl || '/';
        passport.authenticate('apple', { 
            scope: ['name', 'email'],
            state: redirectUrl 
        })(req, res, next);
    });

    router.post('/apple/callback', 
        passport.authenticate('apple', { 
            session: false, 
            failureRedirect: '/?status=error&msg=Ap_neuspešno' 
        }), 
        (req, res) => {
            // Uporabimo pomožne funkcije iz Controllerja!
            const zeton = authController.generirajZeton(req.user._id);
            authController.nastaviAuthPiškotek(res, zeton); 

            const frontendRedirectUrl = req.body.state || '/';
            res.redirect(`${frontendRedirectUrl}?zeton=${zeton}&ime=${req.user.ime}&jeLastnik=${req.user.jeLastnik || false}&telefon=${req.user.telefon || ''}`);
        }
    );

    return router; 
};