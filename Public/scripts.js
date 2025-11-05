// -------------------------------------------------------------
// 0. LOGIKA PREVAJANJA (i18n) - DODATEK
// -------------------------------------------------------------

const updateContent = () => {
    // 1. Prevede celotno stran z uporabo elementov z atributom data-i18n
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');

        // Posebno ravnanje za placeholderje ([placeholder]search.key)
        if (key.startsWith('[placeholder]')) {
            const placeholderKey = key.replace('[placeholder]', '');
            el.placeholder = i18next.t(placeholderKey);
        } else {
            // Standardno prevajanje textContent
            el.textContent = i18next.t(key);
        }
    });

    // 2. Posebno ravnanje za opcije za število oseb (pluralizacija)
    const steviloOsebSelect = document.getElementById('stevilo_oseb');
    if (steviloOsebSelect) {
        // Shranimo trenutno izbrano vrednost, da jo ohranimo po prevodu
        const selectedValue = steviloOsebSelect.value;

        Array.from(steviloOsebSelect.options).forEach(option => {
            const count = parseInt(option.value);
            if (count > 0) {
                // Uporaba standardnega pluralizacijskega ključa "search.persons"
                option.textContent = i18next.t('search.persons', { count: count });
            }
        });

        // Obnovimo izbrano vrednost, če jo je uporabnik spremenil
        steviloOsebSelect.value = selectedValue;
    }

    // 3. Posodobimo tudi naslov strani
    const titleElement = document.querySelector('title');
    if (titleElement) {
        titleElement.textContent = i18next.t('app.title');
    }

    // 4. POSODOBIMO VSEBINO WARNING MODALA PO PREVODU
    if (document.getElementById('warningModal')) {
        posodobiWarningModalVsebino();
    }

    // Prevajanje vsebine v modalnem oknu, ki je dinamično ustvarjena
    const rezervacijaGumb = document.getElementById('rezervacijaModalGumb');
    if (rezervacijaGumb) {
        rezervacijaGumb.textContent = i18next.t('modal.reserve_button');
    }

    // 5. Posodobi naslov v Modalu Podrobnosti (ki je sedaj fiksno v HTML)
    const modalReservationTitle = document.getElementById('modalReservationTitle');
    if (modalReservationTitle) {
        modalReservationTitle.textContent = i18next.t('modal.reservation_title');
    }

    // -------------------------------------------------------------
    // 6. POPRAVLJENA LOGIKA ZA DINAMIČNO PREPISOVANJE LINKOV (HREF)
    //    * KLJUČNO: JSON mora zdaj vrniti samo pot (npr. '/o-nas.html').
    //    * Koda sama doda jezik in predpono '/public/'.
    // -------------------------------------------------------------
    const currentLang = i18next.language || 'sl'; 
    
    document.querySelectorAll('[data-i18n-href]').forEach(el => {
        const key = el.getAttribute('data-i18n-href');
        
        // i18next.t() dobi generično pot (npr. '/o-nas.html')
        const genericPath = i18next.t(key); 

        // 1. Preverimo, ali je pot veljavna in se razlikuje od ključa
        if (genericPath && genericPath !== key) {
            
            // 2. ZGRADIMO PRAVILNO ABSOLUTNO POT, ki vključuje jezik in '/public/'
            // Pričakovana končna pot: /public/sl/o-nas.html
            // OPOMBA: glede na to, da je index.html v korenu, je /public/ morda odveč, a ga pustimo.
            const dynamicPath = `/${currentLang}${genericPath.startsWith('/') ? genericPath : '/' + genericPath}`;
            
            el.setAttribute('href', dynamicPath);
        } else if (genericPath === key) {
             // Opozorilo, če ključ ni najden, kar povzroči, da gumb ostane href='#'
             console.warn(`Ključ poti ni najden v JSON: ${key}. Preverite datoteko i18n/${currentLang}.json.`);
        }
    });
}; // Konec funkcije updateContent

const setupLanguageSwitcher = () => {
    const langSelect = document.querySelector('.izbira-jezika');
    if (langSelect) {
        // Nastavimo select na trenutni jezik
        langSelect.value = i18next.language;

        langSelect.addEventListener('change', (e) => {
            const newLang = e.target.value;
            // Shranimo izbiro v localStorage za naslednji obisk
            localStorage.setItem('lang', newLang);

            // Zamenjamo jezik in prevedemo vsebino
            i18next.changeLanguage(newLang, (err, t) => {
                if (err) return console.error('Napaka pri menjavi jezika:', err);
                updateContent();
            });
        });
    }
};

const initI18n = (defaultLang) => {
    i18next
        .use(i18nextHttpBackend) // Uporabimo backend za nalaganje JSON datotek
        .init({
            lng: defaultLang, // Privzeti jezik (sl)
            fallbackLng: 'sl',
            ns: ['translation'], // Namespace, ki ga uporabljamo
            backend: {
                // Pot do datotek s prevodi
                loadPath: './i18n/{{lng}}.json'
            },
            debug: false
        }, (err, t) => {
            if (err) return console.error('Napaka pri inicializaciji i18next:', err);
            // Po uspešnem nalaganju prevedemo stran in nastavimo poslušalca
            updateContent();
            setupLanguageSwitcher();
            // Po prevajanju se prikaže warning modal, če ga še nismo videli
            prikaziWarningModal();
        });
};

// Zagon prevajanja ob nalaganju strani
const savedLang = localStorage.getItem('lang') || 'sl'; // Preveri shranjen jezik
if (typeof i18next !== 'undefined') {
    initI18n(savedLang);
} else {
    console.error('i18next knjižnica ni naložena!');
}

// -------------------------------------------------------------
// 1. GLOBALNA NASTAVITEV IN TOKEN
// -------------------------------------------------------------
// 🔥 KRITIČEN POPRAVEK: API_BASE_URL mora biti celoten URL Render servisa, 
// sicer se klici na rentyo.eu domeno končajo z 404!
const API_BASE_URL = 'https://rentyo-gourmet-spletna-stran.onrender.com/api'; 
const authTokenKey = 'jwtToken'; // Ključ za shranjevanje žetona

// Pridobi avtentikacijski žeton iz localStorage
const getAuthHeaders = () => {
    const token = localStorage.getItem(authTokenKey);
    return {
        'Content-Type': 'application/json',
        // Če obstaja, dodamo Authorizacija glavo (za zaščitene poti)
        ...(token && { 'Authorization': `Bearer ${token}` })
    };
};

// Funkcija za prikaz sporočila uporabniku
const prikaziSporocilo = (msg, tip = 'info') => {
    let container = document.getElementById('sporocila-container');
    if (!container) {
        // Če container ne obstaja, ga ustvarimo
        container = document.createElement('div');
        container.id = 'sporocila-container';
        const mainElement = document.querySelector('main');
        if (mainElement) {
            mainElement.prepend(container);
        } else {
            document.body.prepend(container);
        }
    }

    // Določitev barve in stila
    let style = 'bg-blue-100 text-blue-800';
    if (tip === 'error') {
        style = 'bg-red-100 text-red-800';
    } else if (tip === 'success') {
        style = 'bg-green-100 text-green-800';
    }

    // Uporaba ustvarjenega sporočila
    container.innerHTML = `<div class="p-3 mb-3 text-sm rounded ${style} shadow-md transition-opacity duration-300">${msg}</div>`;

    // Samodejno skrivanje sporočila
    setTimeout(() => {
        container.innerHTML = '';
    }, 5000); // Sporočilo izgine po 5 sekundah
};

// Pomožna funkcija za formatiranje datuma iz Flatpickr v YYYY-MM-DD
const formatirajDatumZaBackend = (datum) => {
    if (!datum) return '';
    // Predpostavljamo format DD. MM. YYYY (npr. 01. 11. 2025)
    // OPOMBA: Flatpickr pogosto vrača že formatiran ISO datum. Preverite to!
    const parts = datum.split('.').map(s => s.trim());
    if (parts.length === 3) {
        // Obrnemo v YYYY-MM-DD
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
    // Če je že v ISO formatu, ga vrnemo (Flatpickr ga včasih avtomatsko nastavi)
    return datum; 
};


// -------------------------------------------------------------
// 2. LOGIKA ISKANJA RESTAVRACIJ IN POVEZOVANJE DOGODKOV
// -------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
    // A. PRIDOBITEV OSNOVNIH ELEMENTOV
    const isciForm = document.querySelector('.iskalnik'); // Uporabljamo class
    const hitraIskanjaGumbi = document.querySelectorAll('.gumb-kategorija');

    // B. Nastavitev poslušalcev za ISKANJE
    if (isciForm) {
        // Uporabimo ID-je iz vašega HTML-ja
        isciForm.addEventListener('submit', (e) => handleIskanjeRestavracij(e,
            document.getElementById('restavracija_mesto').value,
            document.getElementById('datum').value,
            document.getElementById('cas').value,
            document.getElementById('stevilo_oseb').value
        ));
    }

    // C. Nastavitev poslušalcev za HITRA ISKANJA
    hitraIskanjaGumbi.forEach(gumb => {
        gumb.addEventListener('click', (e) => {
            e.preventDefault();

            const dataI18nKey = e.target.getAttribute('data-i18n');
            const kuhinjaKljuc = dataI18nKey ? dataI18nKey.split('.').pop() : e.target.textContent.trim();

            // Preusmerimo na glavno iskalno funkcijo s polji iz iskalnega obrazca
            handleIskanjeRestavracij(e,
                document.getElementById('restavracija_mesto').value,
                document.getElementById('datum').value,
                document.getElementById('cas').value,
                document.getElementById('stevilo_oseb').value,
                kuhinjaKljuc // Dodamo nepreveden ključ kuhinje kot parameter
            );
        });
    });

    // KLIC NA ZAGONU STRANI: Nalaganje privzetih restavracij takoj ob zagonu
    naloziPrivzeteRestavracije();

    // Nastavitev zapiranja modala za restavracijo (iz dela 2)
    setupRestavracijaModalClosure();

});


// Funkcija za nalaganje privzetih (priljubljenih) restavracij ob zagonu
async function naloziPrivzeteRestavracije() {
    // Uporaba pravilnega API_BASE_URL bo sedaj odpravila 404
    const url = `${API_BASE_URL}/restavracije/privzeto`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (response.ok) {
            // KLJUČNA SPREMEMBA: Dodan 'true' kot zadnji argument -> Je privzeto nalaganje
            prikaziRezultate(data,
                document.getElementById('datum').value || '',
                document.getElementById('cas').value || '',
                document.getElementById('stevilo_oseb').value || '2',
                true // Določa, da je to privzeto nalaganje
            );
        } else {
            console.error('Napaka pri nalaganju privzetih restavracij:', data.msg);
            prikaziSporocilo(data.msg || i18next.t('messages.default_load_error'), 'error');
        }
    } catch (error) {
        console.error('Napaka pri API klicu za privzeto nalaganje:', error);
        prikaziSporocilo(i18next.t('messages.server_connection_error_retry'), 'error'); // Posodobljeno: boljše sporočilo
    }
}


/**
 * Obdeluje iskanje, posreduje parametre API-ju in prikaže rezultate.
 */
async function handleIskanjeRestavracij(e, iskanjeVrednost, datum, cas, steviloOseb, kuhinjaKljuc = null) {
    e.preventDefault();

    // Dodajmo vizualni fokus na kontejner z rezultati
    const rezultatiContainerElement = document.getElementById('restavracije-container');
    if (rezultatiContainerElement) {
        rezultatiContainerElement.scrollIntoView({ behavior: 'smooth' });
    }

    if (!iskanjeVrednost && !kuhinjaKljuc) {
        return prikaziSporocilo(i18next.t('messages.enter_search_criteria'), 'error');
    }

    // Sestavimo Query String parametre
    const params = new URLSearchParams();
    if (iskanjeVrednost) {
        params.append('iskanje', iskanjeVrednost);
    }
    if (kuhinjaKljuc) {
        params.append('kuhinja', kuhinjaKljuc);
    }

    // KLJUČNO: Pošljemo format datuma YYYY-MM-DD
    const datumFormated = formatirajDatumZaBackend(datum);

    if (datumFormated) params.append('datum', datumFormated);
    if (cas) params.append('cas', cas);
    if (steviloOseb) params.append('osebe', steviloOseb);


    const url = `${API_BASE_URL}/restavracije/isci?${params.toString()}`;

    try {
        prikaziSporocilo(i18next.t('messages.searching', { criteria: iskanjeVrednost || kuhinjaKljuc }), 'info');
        const response = await fetch(url);
        const data = await response.json();

        const rezultatiContainer = document.getElementById('restavracije-container');
        if (rezultatiContainer) {
            rezultatiContainer.innerHTML = '';
        }

        if (response.ok) {
            prikaziSporocilo(i18next.t('messages.search_success', { count: data.length }), 'success');
            // Sedaj so vsi potrebni parametri za rezervacijo vključeni
            // KLJUČNA SPREMEMBA: Dodan 'false' kot zadnji argument -> Je aktivno iskanje
            prikaziRezultate(data, datumFormated, cas, steviloOseb, false); 
        } else {
            // Posodobljena obravnava napake
            const errorMsg = data.msg || i18next.t('messages.search_error');
            prikaziSporocilo(errorMsg, 'error');
            // KLJUČNA SPREMEMBA: Dodan 'false' kot zadnji argument -> Je aktivno iskanje, brez rezultatov
            prikaziRezultate([], datumFormated, cas, steviloOseb, false); 
        }
    } catch (error) {
        console.error('Napaka pri API klicu za iskanje:', error);
        prikaziSporocilo(i18next.t('messages.server_connection_error'), 'error');
    }
}


/**
 * Prikazuje najdene restavracije v mreži in jim priloži podatke rezervacije.
 * @param {Array} restavracije - Seznam restavracij.
 * @param {string} datum - Izbrani datum (YYYY-MM-DD).
 * @param {string} cas - Izbrani čas (HH:MM).
 * @param {string} steviloOseb - Število oseb.
 * @param {boolean} jePrivzetoNalaganje - Ali gre za nalaganje priljubljenih (true) ali iskalnih rezultatov (false).
 */
function prikaziRezultate(restavracije, datum, cas, steviloOseb, jePrivzetoNalaganje = false) { 
    const rezultatiContainer = document.getElementById('restavracije-container');
    if (!rezultatiContainer) return;

    rezultatiContainer.innerHTML = '';

    const naslov = document.querySelector('.kartice-restavracij h2');
    
    // LOGIKA ZA POSODABLJANJE NASLOVA SEKCIJE
    if (naslov) {
        if (jePrivzetoNalaganje) {
             // 1. Pri zagonu: 'Priljubljeno v vaši bližini'
            naslov.textContent = i18next.t('results.popular_title');
        } else {
             // 2. Po iskanju: 'Rezultati iskanja' ali 'Ni najdenih'
            naslov.textContent = restavracije.length > 0 
                ? i18next.t('results.search_results') 
                : i18next.t('messages.no_restaurants_found');
        }
    }

    if (restavracije.length === 0) {
        // Če ni rezultatov, počistimo kontejner in zaključimo, pri čemer naslov ostane posodobljen.
        return; 
    }

    // Pridobimo trenutni jezik za izbiro opisa
    const currentLang = i18next.language;

    restavracije.forEach(restavracija => {
        const kartica = document.createElement('div');
        kartica.className = 'kartica';
        // KLJUČNO: Shranimo ID, da ga lahko kliknemo za modal!
        kartica.dataset.restavracijaId = restavracija._id;

        // Logika za prikaz ocene v obliki zvezdic
        const rating = restavracija.ocena_povprecje || 0;
        const zvezdice = '★'.repeat(Math.round(rating)) + '☆'.repeat(5 - Math.round(rating));

        // Izberemo ustrezen lokaliziran opis. Če ni opisa, uporabimo SL (fallback).
        const lokaliziranOpis = restavracija.description ? restavracija.description[currentLang] || restavracija.description.sl : i18next.t('results.na');

        // Določitev glavne slike
        const slikaUrl = restavracija.mainImageUrl || `https://placehold.co/400x200/51296a/white?text=${restavracija.ime.replace(/\s/g, '+')}`;

        // Logika za cene (€, €€, €€€)
        const cenovniRazred = '€'.repeat(restavracija.priceRange || 1);

        const kuhinjaBesedilo = restavracija.cuisine && restavracija.cuisine.length > 0
            ? restavracija.cuisine.join(', ')
            : i18next.t('results.na');

        let gumbBesedilo = i18next.t('results.reserve_button');
        if (cas && datum && steviloOseb && cas !== i18next.t('search.select_time')) {
             // Datum je že v YYYY-MM-DD
            gumbBesedilo = i18next.t('results.check_tables', { time: cas });
        }

        kartica.innerHTML = `
            <img src="${slikaUrl}" class="kartica-slika" alt="${i18next.t('results.image_alt_prefix')} ${restavracija.ime}">
            <div class="kartica-vsebina">
                <h3>${restavracija.ime} <span class="ocena-stevilka">(${cenovniRazred})</span></h3>
                <div class="info-ocena-oddaljenost">
                    <p class="ocena">${zvezdice} <span class="ocena-stevilka">(${rating.toFixed(1)})</span></p>
                    <span class="oddaljenost"><i class="fas fa-route"></i> 2.5 km</span>
                </div>
                <p class="opis">${lokaliziranOpis}</p>

                <div class="razpolozljivost-ovoj">
                    <strong>${i18next.t('results.cuisine')}:</strong>
                    <span>${kuhinjaBesedilo}</span>
                </div>

                <button class="gumb-rezervacija"
                    data-restavracija-id="${restavracija._id}"
                    data-ime="${restavracija.ime}"
                    data-datum="${datum}"
                    data-cas="${cas}"
                    data-stevilo-oseb="${steviloOseb}"
                    data-rezervacija-gumb>
                    ${gumbBesedilo}
                </button>
            </div>
        `;
        rezultatiContainer.appendChild(kartica);
    });

    // Povežemo poslušalce na dinamično ustvarjene KARTICE (odprejo modal)
    document.querySelectorAll('.kartica').forEach(card => {
        card.addEventListener('click', handleOdpriModalPodrobnosti);
    });

    // Povežemo poslušalce na dinamično ustvarjene gumbe za rezervacijo
    document.querySelectorAll('.gumb-rezervacija[data-rezervacija-gumb]').forEach(button => {
        // Preprečimo podvojeno sprožitev
        button.addEventListener('click', (e) => {
            e.stopPropagation(); // Prepreči, da bi klik dosegel kartico
            handlePripravaRezervacije(e);
        });
    });
}


// -------------------------------------------------------------
// 3. NOVA LOGIKA REZERVACIJE (PROSTE URE & IZVEDBA)
// -------------------------------------------------------------

/**
 * Pripravi modal, pobere podatke iz gumba in preveri proste mize in ure.
 */
function handlePripravaRezervacije(e) {
    e.preventDefault();

    const restavracijaId = e.target.dataset.restavracijaId;
    const restavracijaIme = e.target.dataset.ime;
    const datum = e.target.dataset.datum; // YYYY-MM-DD format
    const cas = e.target.dataset.cas;
    const steviloOseb = parseInt(e.target.dataset.steviloOseb);

    // KLJUČNO PREVERJANJE: Če niso vneseni vsi podatki v iskalnik, prikažemo napako
    if (!datum || !steviloOseb || cas === i18next.t('search.select_time')) {
        // Če manjkajo polja, preprosto odpremo modal in uporabnik lahko tam vpiše manjkajoče (glej prikaziModalPodrobnosti)
        prikaziSporocilo(i18next.t('messages.required_reservation_fields_select_time'), 'info');
        // Odpremo modal samo s podatki restavracije (ID)
        handleOdpriModalPodrobnosti({ currentTarget: e.currentTarget.closest('.kartica') });
        return;
    }

    // 1. Prikažemo modal
    handleOdpriModalPodrobnosti({ currentTarget: e.currentTarget.closest('.kartica') });

    // 2. Nastavimo polja v modalu na vrednosti iz iskalnika
    // Uporabimo setTimeout, da se prepričamo, da je modalna vsebina že narisana
    setTimeout(() => {
        const modalReservationContainer = document.getElementById('tabRezervacija');
        if (modalReservationContainer) {
            // POZOR: datum je že v YYYY-MM-DD, a za prikaz na frontendu je morda potreben DD.MM.YYYY
            // V tem primeru pustimo, da ga Flatpickr prebere, saj je njegova vrednost shranjena v inputu.
            modalReservationContainer.querySelector('[data-reserv-id]').value = restavracijaId;
            modalReservationContainer.querySelector('[data-reserv-datum]').value = datum;
            modalReservationContainer.querySelector('[data-reserv-osebe]').value = steviloOseb;
            
            // 3. Takoj sprožimo iskanje prostih ur
            preveriProsteUre({
                restavracijaId: restavracijaId,
                datum: datum,
                stevilo_oseb: steviloOseb
            });
        }
    }, 50); // Kratka zamuda
}


/**
 * Kliče API end-point za pridobitev prostih ur za izbrani datum/število oseb.
 */
async function preveriProsteUre(rezervacijaPodatki) {
    const { restavracijaId, datum, stevilo_oseb } = rezervacijaPodatki;
    
    // Vizualna posodobitev med nalaganjem
    const rezultatiContainer = document.getElementById('prosteUreRezultati');
    if (rezultatiContainer) {
        rezultatiContainer.innerHTML = `<p class="p-4 text-center text-blue-500">${i18next.t('messages.checking_availability')}</p>`;
    }

    try {
        const url = `${API_BASE_URL}/restavracije/proste_ure`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ restavracijaId, datum, stevilo_oseb })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            if (data.mize && data.mize.length > 0) {
                prikaziProsteUre(data.mize, datum, stevilo_oseb);
            } else {
                rezultatiContainer.innerHTML = `<p class="p-4 text-center text-red-500">${i18next.t('messages.no_tables_found')}</p>`;
            }
        } else {
            prikaziSporocilo(data.msg || i18next.t('messages.availability_check_failed'), 'error');
            if (rezultatiContainer) {
                rezultatiContainer.innerHTML = `<p class="p-4 text-center text-red-500">${data.msg || i18next.t('messages.availability_check_failed')}</p>`;
            }
        }
    } catch (error) {
        console.error('Napaka pri preverjanju prostih ur:', error);
        prikaziSporocilo(i18next.t('messages.server_connection_error_retry'), 'error');
        if (rezultatiContainer) {
             rezultatiContainer.innerHTML = `<p class="p-4 text-center text-red-500">${i18next.t('messages.server_connection_error_retry')}</p>`;
        }
    }
}


/**
 * Prikazuje proste ure kot gumbe, razvrščene po mizi.
 * 🔥 KLJUČNI POPRAVEK: V gumb dodamo data-miza-id, da vemo, katero mizo rezervirati.
 */
function prikaziProsteUre(mize, datum, steviloOseb) {
    const rezultatiContainer = document.getElementById('prosteUreRezultati');
    if (!rezultatiContainer) return;
    
    rezultatiContainer.innerHTML = '';
    let html = '';

    mize.forEach(miza => {
        html += `<h4 class="text-lg font-semibold mt-4 mb-2">${i18next.t('modal.table_label')} ${miza.mizaIme} (${i18next.t('modal.capacity')}: ${miza.kapaciteta})</h4>`;
        html += `<div class="flex flex-wrap gap-2">`;
        
        miza.prosteUre.forEach(uraDecimal => {
            // Pretvorba iz decimalnega formata (npr. 18.5) v HH:MM format (npr. 18:30)
            const ura = Math.floor(uraDecimal);
            const minute = (uraDecimal % 1) * 60;
            const casString = `${String(ura).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
            
            html += `
                <button class="gumb-izbira-ure" 
                    data-cas-decimal="${uraDecimal}" 
                    data-miza-ime="${miza.mizaIme}"
                    data-miza-id="${miza.mizaId || 'neznan_id'}"  <!-- 🔥 POPRAVEK: DODAN MIZA ID -->
                    data-datum="${datum}"
                    data-osebe="${steviloOseb}"
                    data-ura-string="${casString}">
                    ${casString}
                </button>
            `;
        });
        html += `</div>`;
    });
    
    rezultatiContainer.innerHTML = html;
    
    // Nastavimo poslušalce za izbiro ure (ki sproži potrditveni modal)
    document.querySelectorAll('.gumb-izbira-ure').forEach(gumb => {
        gumb.addEventListener('click', odpriPotrditveniModal);
    });
}


/**
 * Prikazuje finalni potrditveni modal, preden pošlje podatke.
 * ⚠️ POPRAVEK: Odstranjena prepovedana funkcija confirm().
 */
function odpriPotrditveniModal(e) {
    const gumb = e.currentTarget;
    
    // 1. Poberemo vse potrebne podatke 
    const casStartDecimal = parseFloat(gumb.dataset.casDecimal);
    const mizaIme = gumb.dataset.mizaIme; 
    const datum = gumb.dataset.datum;
    const steviloOseb = parseInt(gumb.dataset.osebe);
    const casString = gumb.dataset.uraString;
    const mizaId = gumb.dataset.mizaId; // 🔥 Sedaj je na voljo
    
    // Dobimo ID restavracije iz skritega polja v modalu
    const restavracijaId = document.getElementById('tabRezervacija').querySelector('[data-reserv-id]').value;
    
    // Če mizaId ni definiran, se ustavi!
    if (!mizaId || mizaId === 'neznan_id') {
        console.error("Miza ID ni bil najden v data-atributih gumba.");
        prikaziSporocilo("Napaka: Manjka identifikator mize.", 'error');
        return;
    }


    const rezervacijaPodatki = {
        restavracijaId,
        mizaId, 
        // ⚠️ Ker ni polja za ime/telefon, uporabimo privzeto:
        imeGosta: 'Spletni Gost', 
        telefon: '000 000 000',
        stevilo_oseb: steviloOseb,
        datum: datum, 
        casStart: casStartDecimal,
        trajanjeUr: 1.5,
        mizaIme: mizaIme 
    };

    // ----------------------------------------------------------------------------------
    // 🔥 POPRAVEK PROTOKOLA: Namesto confirm() (ki je prepovedan), 
    // prikažemo sporočilo, ki simulira, da bi se moral prikazati potrditveni modal.
    // Nato sprožimo rezervacijo, saj pravi modal ni mogoč.
    // ----------------------------------------------------------------------------------
    const potrditvenoSporocilo = i18next.t('messages.confirm_reservation', { miza: mizaIme, cas: casString });
    prikaziSporocilo(`${potrditvenoSporocilo} ${i18next.t('messages.reservation_starting')}`, 'info');

    // Takojšna izvedba rezervacije
    handleIzvedbaRezervacije(rezervacijaPodatki);
}


/**
 * Pošlje dejansko rezervacijo na backend.
 * 🔥 POSODOBLJENO: Uporablja nov end-point: /restavracije/ustvari_rezervacijo
 */
async function handleIzvedbaRezervacije(podatki) {

    // Popravek end-pointa
    const url = `${API_BASE_URL}/restavracije/ustvari_rezervacijo`;

    try {
        prikaziSporocilo(i18next.t('messages.reserving', { cas: podatki.casStart, stevilo: podatki.stevilo_oseb }), 'info');

        // 🔥 POZOR: Backend zahteva casStart kot DECIMALNO številko (npr. 18.5),
        // zato pošiljamo podatki.casStart (ki je že decimalno število).
        
        // Pripravimo payload, ki ga zahteva backend
        const payload = {
            restavracijaId: podatki.restavracijaId,
            mizaId: podatki.mizaId,
            imeGosta: podatki.imeGosta,
            telefon: podatki.telefon,
            stevilo_oseb: podatki.stevilo_oseb,
            datum: podatki.datum,
            casStart: podatki.casStart,
            trajanjeUr: podatki.trajanjeUr 
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (response.ok) {
            prikaziSporocilo(i18next.t('messages.reservation_success', { miza: podatki.mizaIme, cas: podatki.casStart }), 'success');
            // Zapri modal
            document.getElementById('restavracijaModal').classList.remove('active');
        } else {
            prikaziSporocilo(data.msg || i18next.t('messages.reservation_failed'), 'error');
        }

    } catch (error) {
        console.error('Napaka pri API klicu za rezervacijo:', error);
        prikaziSporocilo(i18next.t('messages.server_connection_error_retry'), 'error');
    }
}


// -------------------------------------------------------------
// 5. LOGIKA MODALNEGA OKNA ZA DETALJNO RESTAVRACIJO
// -------------------------------------------------------------

const restavracijaModal = document.getElementById('restavracijaModal');

/**
 * Nastavi poslušalce za zapiranje modala in inicializira preklop zavihkov.
 */
function setupRestavracijaModalClosure() {
    const gumbZapriRestavracija = document.getElementById('zapriRestavracijaModal');

    if (gumbZapriRestavracija && restavracijaModal) {
        gumbZapriRestavracija.addEventListener('click', () => {
            restavracijaModal.classList.remove('active');
        });
        window.addEventListener('click', (event) => {
            if (event.target === restavracijaModal) {
                restavracijaModal.classList.remove('active');
            }
        });
        // Klic setupRestavracijaTabs mora biti znotraj handleOdpriModalPodrobnosti
        // da zagotovi, da so DOM elementi prisotni.
    }
}


/**
 * Nastavi poslušalce za preklapljanje zavihkov znotraj detajlnega modala.
 * Opomba: Klicana je v handleOdpriModalPodrobnosti, ko je modalna vsebina že napolnjena.
 */
function setupRestavracijaTabs() {
    // Opomba: Te elemente je treba po vsakem odpiranju modala znova najti!
    const tabs = document.querySelectorAll('.restavracija-vsebina .modal-tab');
    const contents = document.querySelectorAll('.restavracija-vsebina .modal-vsebina-skrol .tab-content');

    tabs.forEach(tab => {
        tab.removeEventListener('click', handleTabClick); // Preprečimo podvajanje
        tab.addEventListener('click', handleTabClick);
    });
}

/**
 * Funkcija za obravnavo klika na zavihek.
 */
function handleTabClick(e) {
    const targetId = e.target.dataset.tab;

    const tabs = document.querySelectorAll('.restavracija-vsebina .modal-tab');
    const contents = document.querySelectorAll('.restavracija-vsebina .modal-vsebina-skrol .tab-content');

    // Odstrani aktivnost vsem tabom in vsebini
    tabs.forEach(t => t.classList.remove('active'));
    contents.forEach(c => c.classList.remove('active'));

    // Aktivira izbrani tab in vsebino
    e.target.classList.add('active');
    const targetContent = document.getElementById(targetId);
    if (targetContent) {
        targetContent.classList.add('active');
    }
    
    // 🔥 KLJUČNO: Če se odpre zavihek Rezervacija, priključimo poslušalce za preverjanje
    if (targetId === 'tabRezervacija') {
        setupReservationFormListeners();
    }
}

/**
 * Pripne poslušalce na polja za rezervacijo v modalu (za samodejno preverjanje razpoložljivosti).
 */
function setupReservationFormListeners() {
    const tabRezervacija = document.getElementById('tabRezervacija');
    if (!tabRezervacija) return;

    const restavracijaIdInput = tabRezervacija.querySelector('[data-reserv-id]');
    const datumInput = tabRezervacija.querySelector('[data-reserv-datum]');
    const osebeInput = tabRezervacija.querySelector('[data-reserv-osebe]');
    const gumbPreveri = document.getElementById('rezervacijaModalGumb');
    
    // Poslušalec za gumb (če uporabnik ročno pritisne)
    if (gumbPreveri) {
        // Odstranimo prejšnje poslušalce, da preprečimo podvajanje
        gumbPreveri.onclick = null; 
        gumbPreveri.onclick = (e) => {
            e.preventDefault();
            const datumFormated = formatirajDatumZaBackend(datumInput.value);

            if (datumFormated && restavracijaIdInput.value && osebeInput.value) {
                preveriProsteUre({
                    restavracijaId: restavracijaIdInput.value,
                    datum: datumFormated,
                    stevilo_oseb: parseInt(osebeInput.value)
                });
            } else {
                 prikaziSporocilo(i18next.t('messages.required_reservation_fields'), 'error');
            }
        };
    }
    
    // Dodatni poslušalci za spremembo polj, ki sprožijo samodejno preverjanje
    const autoCheck = () => {
        const datumFormated = formatirajDatumZaBackend(datumInput.value);
        if (datumFormated && restavracijaIdInput.value && osebeInput.value) {
            preveriProsteUre({
                restavracijaId: restavracijaIdInput.value,
                datum: datumFormated,
                stevilo_oseb: parseInt(osebeInput.value)
            });
        }
    };
    
    // Odstranimo prejšnje in dodamo nove poslušalce na polja
    datumInput.onchange = autoCheck;
    osebeInput.onchange = autoCheck;
}


/**
 * Pridobi ID iz kartice, pokliče API in odpre modal s podatki.
 */
async function handleOdpriModalPodrobnosti(e) {
    // Preveri, ali smo kliknili na gumb za rezervacijo znotraj kartice
    if (e.target.closest('[data-rezervacija-gumb]')) {
        // Če je bil klik na gumbu, se to obdela v handlePripravaRezervacije
        return;
    }

    const kartica = e.currentTarget;
    const restavracijaId = kartica.dataset.restavracijaId;

    if (!restavracijaId) return;

    try {
        prikaziSporocilo(i18next.t('messages.loading_details'), 'info');

        const url = `${API_BASE_URL}/restavracije/${restavracijaId}`; // Uporabljamo GET /:id
        const response = await fetch(url);
        const data = await response.json();

        if (response.ok) {
            prikaziModalPodrobnosti(data);
            restavracijaModal.classList.add('active');
            prikaziSporocilo(''); // Počisti sporočilo
            
            // 🔥 KLJUČNO: Nastavimo poslušalce za zavihke in rezervacijo takoj
            setupRestavracijaTabs();
            // Če je privzet aktivni zavihek Rezervacija, priključimo poslušalce
            const activeTab = document.querySelector('.modal-tab.active');
            if (activeTab && activeTab.dataset.tab === 'tabRezervacija') {
                setupReservationFormListeners();
            }

        } else {
            prikaziSporocilo(data.msg || i18next.t('messages.search_error'), 'error');
        }
    } catch (error) {
        console.error('Napaka pri pridobivanju detajlov restavracije:', error);
        prikaziSporocilo(i18next.t('messages.server_connection_error_retry'), 'error');
    }
}


/**
 * Vstavi podatke v HTML strukturo detajlnega modala.
 * 🔥 POTRDITEV: Ta funkcija dinamično naloži Meni z uporabo ustvariMenijaHTML.
 */
function prikaziModalPodrobnosti(restavracija) {
    if (!restavracijaModal) return;

    const currentLang = i18next.language;

    // Lokalizacija podatkov
    const opis = restavracija.description ? restavracija.description[currentLang] || restavracija.description.sl : i18next.t('results.na');
    const slikaUrl = restavracija.mainImageUrl || '';
    const rating = restavracija.ocena_povprecje || 0;
    const cenovniRazred = '€'.repeat(restavracija.priceRange || 1);

    // 1. NAPOLNIMO STATIČNE ELEMENTE MODALA
    document.getElementById('modalSlika').style.backgroundImage = `url('${slikaUrl}')`;
    document.getElementById('modalIme').innerHTML = `${restavracija.ime} <span class="ocena-stevilka">(${cenovniRazred})</span>`;
    document.getElementById('modalKuhinja').innerHTML = `<i class="fas fa-utensils"></i> ${restavracija.cuisine.join(', ')}`;
    document.getElementById('modalLokacija').innerHTML = `<i class="fas fa-map-marker-alt"></i> ${restavracija.naslovPodjetja || i18next.t('messages.location_na')}`;
    document.getElementById('modalOcena').innerHTML = `<i class="fas fa-star"></i> ${rating.toFixed(1)}/5 (${restavracija.st_ocen || 0})`;
    document.getElementById('modalOpis').textContent = opis;

    // 2. Napolnimo zavihek MENI (Dinamična vsebina)
    const tabMeni = document.getElementById('tabMeni');
    if(tabMeni) {
        tabMeni.innerHTML = ustvariMenijaHTML(restavracija.menu, currentLang);
    }

    // 3. Napolnimo zavihek GALERIJA
    const tabGalerija = document.getElementById('tabGalerija');
    if(tabGalerija) {
        tabGalerija.innerHTML = ustvariGalerijeHTML(restavracija.galleryUrls, restavracija.latitude, restavracija.longitude);
    }
    
    // 4. Počistimo rezultate prostih ur (ker nismo še preverili)
    const tabRezervacija = document.getElementById('tabRezervacija');
    if (tabRezervacija) {
        const rezultatiContainer = document.getElementById('prosteUreRezultati');
        if (rezultatiContainer) {
            rezultatiContainer.innerHTML = `<p class="p-4 text-center text-gray-500">${i18next.t('messages.enter_date_and_persons')}</p>`;
        }
        
        // Povežemo ID restavracije v skrit input v obrazcu rezervacije
        const restavracijaIdInput = tabRezervacija.querySelector('[data-reserv-id]');
        if (restavracijaIdInput) {
            restavracijaIdInput.value = restavracija._id;
        }
        
    }

    // 5. Ponovno prevajanje (za vsebino modala)
    updateContent();
}


/**
 * Generira HTML za meni restavracije (lokalizirano).
 */
function ustvariMenijaHTML(meniPodatki, lang) {
    if (!meniPodatki || !meniPodatki[lang] || Object.keys(meniPodatki[lang]).length === 0) {
        return `<p data-i18n="modal.no_menu" class="p-4 text-center text-gray-500">${i18next.t('modal.no_menu')}</p>`;
    }

    const menuLang = meniPodatki[lang];
    let html = '';

    // Iteracija čez kategorije
    for (const kategorija in menuLang) {
        if (menuLang.hasOwnProperty(kategorija)) {
            const prevedenaKategorija = i18next.t(`menu_categories.${kategorija}`, { defaultValue: kategorija.charAt(0).toUpperCase() + kategorija.slice(1) });

            html += `<h4 class="text-xl font-bold mt-6 mb-3 border-b pb-1 text-gray-700">${prevedenaKategorija}</h4><ul class="meni-seznam space-y-2">`;

            // Iteracija čez jedi v kategoriji
            menuLang[kategorija].forEach(jed => {
                html += `
                    <li class="flex justify-between items-center text-gray-600">
                        <strong class="font-semibold">${jed.name}</strong>
                        <span class="font-mono text-lg text-indigo-600">${jed.price.toFixed(2)} €</span>
                    </li>
                `;
            });
            html += `</ul>`;
        }
    }

    return `<div class="meni-seznam">${html}</div>`;
}


/**
 * Generira HTML za galerijo in zemljevid.
 */
function ustvariGalerijeHTML(galerijaUrl, lat, lng) {
    let slikeHtml = `<h4 data-i18n="modal.gallery_title" class="text-xl font-bold mb-3 text-gray-700">${i18next.t('modal.gallery_title')}</h4>`;
    if (galerijaUrl && galerijaUrl.length > 0) {
        slikeHtml += `<div class="galerija-slike grid grid-cols-2 md:grid-cols-3 gap-4">`;
        galerijaUrl.forEach((url, index) => {
            slikeHtml += `<img src="${url}" alt="Slika restavracije ${index + 1}" class="w-full h-32 object-cover rounded-lg shadow-md hover:shadow-xl transition duration-300 cursor-pointer">`;
        });
        slikeHtml += `</div>`;
    } else {
        slikeHtml += `<p class="p-4 text-center text-gray-500">${i18next.t('modal.no_gallery')}</p>`;
    }

    let zemljevidHtml = `<h4 data-i18n="modal.map_title" class="text-xl font-bold mb-3 mt-6 text-gray-700">${i18next.t('modal.map_title')}</h4>`;
    if (lat && lng) {
        // Uporaba Google Maps embed formata
        zemljevidHtml += `
            <div class="zemljevid-ovoj rounded-lg overflow-hidden shadow-lg">
                <iframe
                    src="https://maps.google.com/maps?q=${lat},${lng}&z=15&output=embed"
                    width="100%"
                    height="400"
                    style="border:0;"
                    allowfullscreen=""
                    loading="lazy">
                </iframe>
            </div>
        `;
    } else {
        zemljevidHtml += `<p class="p-4 text-center text-gray-500">${i18next.t('modal.no_map')}</p>`;
    }

    return `<div class="galerija-sekcija p-4">${slikeHtml}</div><div class="zemljevid-sekcija p-4">${zemljevidHtml}</div>`;
}


// -------------------------------------------------------------
// 6. LOGIKA ZA WARNING MODAL
// -------------------------------------------------------------

const warningModal = document.getElementById('warningModal');

/**
 * Dinamično napolni vsebino warning modala z lokaliziranim besedilom.
 */
function posodobiWarningModalVsebino() {
    if (!warningModal) return;

    // Ker koda v index.html že vsebuje statičen warning modal, posodobimo samo besedilo
    document.getElementById('warningMessage').textContent = i18next.t('warning.default_message');

    // Poslušalec na gumb je potrebno priključiti samo enkrat ob zagonu
    const gumbRazumem = document.getElementById('gumbRazumem');
    if (gumbRazumem) {
        gumbRazumem.removeEventListener('click', zapriWarningModal); // Odstranimo, če obstaja
        gumbRazumem.addEventListener('click', zapriWarningModal);
    }
}


/**
 * Prikazuje modal ob zagonu, če uporabnik še ni potrdil branja.
 */
function prikaziWarningModal() {
    if (!warningModal) return;

    // 1. Preveri, ali je uporabnik že potrdil
    const warningPotrjen = localStorage.getItem('warning_potrjen');

    if (warningPotrjen !== 'true') {
        // 2. Poskrbi za prevod
        posodobiWarningModalVsebino();

        // 3. Prikaži modal
        warningModal.classList.add('active');
    }
}

/**
 * Zapre modal in shrani v localStorage, da se ne prikaže ponovno.
 */
function zapriWarningModal() {
    if (warningModal) {
        // Dodamo class, da lahko kontroliramo vidnost s CSS
        warningModal.classList.remove('active');
        // Shrani, da je opozorilo potrjeno
        localStorage.setItem('warning_potrjen', 'true');
    }
}
