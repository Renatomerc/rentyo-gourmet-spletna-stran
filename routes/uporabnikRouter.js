// ==========================================================
// 🟢 POSODOBLJENA uporabnikRoutes.js — Router za Avtentikacijo
// ==========================================================
module.exports = (JWT_SECRET_KEY, preveriGosta, zahtevajPrijavo) => { 

    const express = require('express');
    const router = express.Router();
    const mongoose = require('mongoose'); 
    const passport = require('passport'); 

    // ⭐ 1. Uvoz Shem in Modelov
    const UporabnikShema = require('../models/Uporabnik'); 
    const Restavracija = require('../models/Restavracija');
    const dbUsers = require('../dbUsers'); 

    // ⭐ 2. KLJUČNO: Ustvarimo model Uporabnik (na sekundarni povezavi)
    const Uporabnik = dbUsers.model('Uporabnik', UporabnikShema); 
    
    // ⭐ 3. KLJUČNO: UVOZIMO CELOTEN AUTH CONTROLLER!
    const authController = require('../controllers/authController')(
        JWT_SECRET_KEY, 
        Uporabnik, 
        Restavracija 
    );
    
    // 🔥 NOVO: UVOZIMO TUDI RESTAVRACIJE CONTROLLER za upravljanje priljubljenih!
    const restavracijeController = require('../controllers/restavracijeController')(
        Uporabnik, // Controller potrebuje model Uporabnik (za priljubljene)
        Restavracija, // Controller potrebuje model Restavracija
        JWT_SECRET_KEY
    );
    
    // ==========================================================
    // 🟠 GLAVNE RUTe, KI KLIČEJO FUNKCIJE IZ CONTROLLERJA
    // ==========================================================

    // Prijava / Registracija / Odjava
    router.post('/registracija', authController.registracija);
    router.post('/prijava', authController.prijava);
    router.post('/odjava', authController.odjava);

    // Profil (Zaščitene poti)
    router.get('/profil', preveriGosta, zahtevajPrijavo, authController.profil);
    router.delete('/profil', preveriGosta, zahtevajPrijavo, authController.izbrisProfila);
    
    
    // ==========================================================
    // ⭐ NOVE POTI ZA PONASTAVITEV GESLA (Z PIN KODO) ⭐
    // ==========================================================
    
    // 1. Zahteva PIN kode
    router.post('/forgot-password', authController.forgotPassword);
    
    // 2. Potrditev PIN kode in ponastavitev gesla
    router.post('/reset-password/confirm', authController.confirmResetPassword);

    
    // ==========================================================
    // 🔥🔥 NOVE POTI ZA FCM IN PRILJUBLJENE (Za reševanje težav) 🔥🔥
    // ==========================================================
    
    // 1. Shranjevanje in posodabljanje FCM Tokena (Push Obvestila)
    // To je KLJUČNA pot za rešitev težave z obvestili!
    router.post('/shrani-fcm-token', zahtevajPrijavo, authController.saveFCMToken); // Uporabimo NOVO funkcijo iz authControllerja!

    // 2. Pridobivanje/Preklapljanje Priljubljenih (Čeprav je to v restavracijeController, je pot logično povezana z uporabnikom)
    // Opomba: Ti dve poti bi lahko bili v ločenem routerju 'restavracije', vendar če uporabljate samo en router za uporabniške akcije, sta lahko tukaj.
    router.get('/priljubljene', zahtevajPrijavo, restavracijeController.getFavoriteRestaurants);
    
    // TO REŠUJE NAPAKO 404 NA INDEX.HTML! Pota mora biti: /api/uporabnik/priljubljene/toggle
    router.post('/priljubljene/toggle', zahtevajPrijavo, restavracijeController.toggleFavorite);


    // ==========================================================
    // 🔴 SOCIALNA PRIJAVA Z GOOGLE & APPLE RUTE (OSTANEJO TUKAJ!)
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