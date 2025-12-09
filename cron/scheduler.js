// ========================================
// ⏱️ CRON SCHEDULER: Pošiljanje opomnikov za prihajajoče rezervacije
// POPRAVEK: Uporablja Restavracija.aggregate() za iskanje vdelanih rezervacij.
// ========================================
const cron = require('node-cron');
const admin = require('firebase-admin');
const moment = require('moment-timezone');

// 🔥 KLJUČNA SPREMEMBA: Uvozimo Restavracija, ne Rezervacija
const Restavracija = require('../models/Restavracija');
const Uporabnik = require('../models/Uporabnik');     

// KLJUČNO: Nastavitev časovnega pasu na Slovenijo.
const TIMEZONE = 'Europe/Ljubljana'; 

// ====================================================
// FUNKCIJA ZA POSODOBITEV (SUB-DOKUMENT)
// ====================================================
async function posodobiStatusOpomnika(restavracijaId, rezervacijaId) {
    try {
        // Uporaba Positional Array Filters ($[r]) za posodobitev sub-dokumenta.
        const result = await Restavracija.updateOne(
            { 
                "_id": restavracijaId,
                "mize.rezervacije._id": rezervacijaId // Preverimo, da rezervacija obstaja znotraj
            },
            { 
                // Uporabimo $[] za mize in nato $[r] za rezervacije
                $set: { "mize.$[].rezervacije.$[r].opomnikPoslan": true }
            },
            { 
                arrayFilters: [
                    // Filtriramo, da posodobimo samo sub-dokument z ustreznim ID-jem
                    { "r._id": rezervacijaId }
                ] 
            }
        );
        
        if (result.modifiedCount === 0) {
            console.warn(`⚠️ Opozorilo: Sub-dokument ID ${rezervacijaId} ni bil posodobljen (verjetno že posodobljen).`);
        } else {
            console.log(`✅ Status opomnika posodobljen za rezervacijo ID ${rezervacijaId}.`);
        }
        
    } catch (error) {
        console.error(`❌ NAPAKA pri posodabljanju opomnika za ID ${rezervacijaId}:`, error);
    }
}


// ====================================================
// FUNKCIJA ZA POŠILJANJE PUSH OBOVESTILA
// ====================================================
async function posljiObvestilo(fcmToken, rezervacijaData) {
    // casStart (npr. 14) spremenimo v format HH:mm (npr. "14:00")
    const casString = String(rezervacijaData.casStart).padStart(2, '0') + ':00';
    
    const message = {
        notification: {
            title: `⏰ Opomnik: Rezervacija ob ${casString}`,
            body: `Ne pozabite skenirati QR kode v restavraciji ${rezervacijaData.restavracijaIme} in potrditi prihod za točke!`,
        },
        data: {
            // Data payload za specifično obdelavo v mobilni aplikaciji
            tip_obvestila: 'OPOMNIK_PRIHOD',
            rezervacijaId: String(rezervacijaData.rezervacijaId),
            cas_rezervacije: casString
        },
        token: fcmToken,
    };

    try {
        const response = await admin.messaging().send(message);
        console.log(`✅ Opomnik uspešno poslan za rezervacijo ID ${rezervacijaData.rezervacijaId}:`, response);
        
        // Zapis v bazo, da je bil opomnik poslan (Posodobi vdelan sub-dokument)
        await posodobiStatusOpomnika(rezervacijaData.restavracijaId, rezervacijaData.rezervacijaId);
        
    } catch (error) {
        console.error(`❌ NAPAKA pri pošiljanju opomnika za ID ${rezervacijaData.rezervacijaId}:`, error);
    }
}


// ====================================================
// GLAVNA CRON NALOGA
// ====================================================
const checkAndSendReminders = async () => {
    const currentTime = moment().tz(TIMEZONE);
    // Logiranje trenutnega časa za sledenje
    console.log(`[Scheduler] Preverjanje rezervacij. Čas: ${currentTime.format('YYYY-MM-DD HH:mm:ss')}`);
    
    try {
        // 1. ISKANJE VDELANIH REZERVACIJ Z AGGREGATE
        const reservationsData = await Restavracija.aggregate([
            // 1. Razdeli tabele
            { $unwind: "$mize" },
            // 2. Razdeli rezervacije
            { $unwind: "$mize.rezervacije" },
            
            // 3. Match: AKTIVNO in opomnik še ni bil poslan
            { $match: {
                // ⭐ POPRAVEK: Iščemo status "AKTIVNO" (namesto "POTRJENO")
                "mize.rezervacije.status": "AKTIVNO", 
                "mize.rezervacije.opomnikPoslan": { $ne: true }
            }},
            
            // 4. Poizvedba po uporabniku za fcmToken
            { $lookup: {
                from: 'uporabniks', // Predpostavljeno ime kolekcije uporabnikov
                localField: 'mize.rezervacije.uporabnikId',
                foreignField: '_id',
                as: 'uporabnik'
            }},
            { $unwind: { path: '$uporabnik', preserveNullAndEmptyArrays: true } }, // Uporabimo preserveNull... če uporabnik ni najden

            // 5. Projekcija potrebnih polj
            { $project: {
                _id: 0, 
                restavracijaId: "$_id",
                rezervacijaId: "$mize.rezervacije._id",
                restavracijaIme: "$ime",
                fcmToken: "$uporabnik.fcmToken",
                datum: "$mize.rezervacije.datum",
                casStart: "$mize.rezervacije.casStart", // To je število (npr. 14)
                uporabnikId: "$uporabnik._id"
            }}
        ]);

        if (reservationsData.length === 0) {
            console.log('[Scheduler] Ni najdenih AKTIVNIH rezervacij, ki čakajo na opomnik.');
            return;
        }

        let remindersSent = 0;

        for (const rezervacija of reservationsData) {
            
            // Konvertiramo številčno uro (npr. 14) v niz (npr. "14:00")
            const casString = String(rezervacija.casStart).padStart(2, '0') + ':00';
            
            // Sestavimo celoten čas rezervacije in ga analiziramo glede na časovni pas
            const rezervacijaDateTime = moment.tz(
                `${rezervacija.datum} ${casString}`, 
                'YYYY-MM-DD HH:mm', 
                TIMEZONE
            );

            // Izračunamo, koliko minut je do rezervacije
            const minutesUntilReservation = rezervacijaDateTime.diff(currentTime, 'minutes');
            
            // ⭐ DODANO ZA DEBUGIRANJE: Izpišemo VSAKEGA kandidata, da vidimo, kje se ustavi
            console.log(`[Scheduler Debug] KANDIDAT: ID=${rezervacija.rezervacijaId}, Čas: ${rezervacija.datum} ${casString}, Preostalo: ${minutesUntilReservation} minut.`);


            // Pogoj za opomnik: pošlji točno, ko je med 15 in 16 minut pred rezervacijo
            if (minutesUntilReservation === 15) {
                
                if (rezervacija.fcmToken) {
                    await posljiObvestilo(rezervacija.fcmToken, rezervacija);
                    remindersSent++;
                } else {
                    console.log(`Uporabnik ID ${rezervacija.uporabnikId} nima žetona. Opomnik ni poslan.`);
                }
            }
        }
        
        if (remindersSent > 0) {
            console.log(`[Scheduler] Skupno število poslanih opomnikov v tem ciklu: ${remindersSent}`);
        }

    } catch (error) {
        console.error('❌ KRITIČNA NAPAKA v Cron Job schedulerju:', error);
    }
};


// ----------------------------------------------------
// IZVOZ: Glavna funkcija za zagon schedulerja
// ----------------------------------------------------
exports.startScheduler = () => {
    // '0 * * * * *' = Izvede se vsako minuto (na 0. sekundi)
    console.log('⏱️ Cron Job Scheduler zagnan. Naloga preverja rezervacije vsako minuto.');
    cron.schedule('0 * * * * *', checkAndSendReminders, {
        timezone: TIMEZONE
    });
};