/* eslint-disable no-magic-numbers */
/* eslint-disable no-var */
/* eslint-disable vars-on-top */
/* eslint-disable no-redeclare */

const { calcToewijzingen } = require('./indeling.ts');
const { marktScenario } = require('./indeling-scenario.ts');

const { pluck } = require('./util.ts');

const FIRST_CHOICE = Number.MAX_SAFE_INTEGER - 1;
const SECOND_CHOICE = FIRST_CHOICE - 2;
const THIRD_CHOICE = FIRST_CHOICE - 3;

function calc(def) {
    const markt = marktScenario(def);
    return calcToewijzingen(markt);
}
function findPlaatsen(toewijzingen, sollicitatieNummer) {
    const ond = toewijzingen.find(({ ondernemer }) =>
        ondernemer.sollicitatieNummer === sollicitatieNummer
    );
    return ond ? ond.plaatsen.sort((a, b) => Number(a) - Number(b)) :
                ['Ondernemer niet gevonden in toewijzingen'];
}
function findOndernemers(wijzingen) {
    return wijzingen.map(({ ondernemer }) => ondernemer.sollicitatieNummer).sort();
}
function isRejected(afwijzingen, sollicitatieNummer) {
    return afwijzingen.some(({ ondernemer }) => ondernemer.sollicitatieNummer === sollicitatieNummer);
}

describe('Een ondernemer die ingedeeld wil worden', () => {
    it('wordt toegewezen aan een lege plek', () => {
        const { toewijzingen, afwijzingen } = calc({
            ondernemers: [{}],
            marktplaatsen: [{}]
        });

        expect(toewijzingen.length).toBe(1);
        expect(afwijzingen.length).toBe(0);
    });

    it('komt niet op een inactieve marktplaats', () => {
        const { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1, status: 'vpl', plaatsen: ['1'] },
                { sollicitatieNummer: 2 }
            ],
            marktplaatsen: [{ inactive: true }]
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([]);
        expect(findOndernemers(afwijzingen)).toStrictEqual([1, 2]);
    });

    it('komt op een standwerkerplaats als hij standwerker is', () => {
        const { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1, voorkeur: { branches: ['standwerker'] } },
                { sollicitatieNummer: 2, voorkeur: { branches: ['standwerker'] } }
            ],
            marktplaatsen: [
                {}, { branches: ['standwerker'] }
            ],
            branches: [{
                brancheId: 'standwerker', verplicht: true
            }]
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([1]);
        expect(findOndernemers(afwijzingen)).toStrictEqual([2]);
        expect(findPlaatsen(toewijzingen, 1)).toStrictEqual(['2']);
    });

    it('komt op een bakplaats als deze niet gebruikt wordt', () => {
        const { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1 }
            ],
            marktplaatsen: [
                { branches: ['bak'] }
            ],
            branches: [
                { brancheId: 'bak', verplicht: true }
            ]
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([1]);
        expect(findOndernemers(afwijzingen)).toStrictEqual([]);
        expect(findPlaatsen(toewijzingen, 1)).toStrictEqual(['1']);
    });

    it('komt op een EVI plaats als deze niet gebruikt wordt', () => {
        const { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1 }
            ],
            marktplaatsen: [
                { verkoopinrichting: ['eigen-materieel'] }
            ]
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([1]);
        expect(findOndernemers(afwijzingen)).toStrictEqual([]);
        expect(findPlaatsen(toewijzingen, 1)).toStrictEqual(['1']);
    });

    it.skip('komt op de plek van een afgewezen ondernemer, na een afwijzing wegens te weinig ruimte', () => {
        const indeling = calc({
            ondernemers: [
                { sollicitatieNummer: 1, status: 'vpl', plaatsen: ['1', '2'], voorkeur: { minimum: 3 } },
                { sollicitatieNummer: 2 },
                { sollicitatieNummer: 3, voorkeur: { maximum: 2 } },
            ],
            marktplaatsen: [
                {}, {}, {}
            ],
            voorkeuren: [
                { sollicitatieNummer: 1, plaatsId: '3', priority: FIRST_CHOICE }
            ]
        });
        const { toewijzingen, afwijzingen, openPlaatsen } = indeling;

        console.log(toewijzingen, afwijzingen, openPlaatsen);
    });
});

describe('Een sollicitant op de A-lijst', () => {
    it('krijgt voorrang over EVI- en verplichte branche sollicitanten op de B-lijst', () => {
        var { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1, voorkeur: { maximum: 2 } },
                { sollicitatieNummer: 2, voorkeur: { verkoopinrichting: ['eigen-materieel'] } },
                { sollicitatieNummer: 3, voorkeur: { verkoopinrichting: ['eigen-materieel'] } }
            ],
            marktplaatsen: [
                { verkoopinrichting: ['eigen-materieel'] }, { verkoopinrichting: ['eigen-materieel'] }, {}
            ],
            aLijst: [
                { sollicitatieNummer: 1 }
            ]
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([1]);
        expect(findOndernemers(afwijzingen)).toStrictEqual([2, 3]);
        expect(findPlaatsen(toewijzingen, 1)).toStrictEqual(['1', '2']);

        var { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1, voorkeur: { maximum: 2 } },
                { sollicitatieNummer: 2, voorkeur: { branches: ['a'] } },
                { sollicitatieNummer: 3, voorkeur: { verkoopinrichting: ['eigen-materieel'] } }
            ],
            marktplaatsen: [
                { branches: ['a'] }, { verkoopinrichting: ['eigen-materieel'] }, {}
            ],
            branches: [
                { brancheId: 'a', verplicht: true }
            ],
            aLijst: [
                { sollicitatieNummer: 1 }
            ]
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([1]);
        expect(findOndernemers(afwijzingen)).toStrictEqual([2, 3]);
        expect(findPlaatsen(toewijzingen, 1)).toStrictEqual(['1', '2']);
    });

    it('krijgt voorrang over gelijkwaardige sollicitanten op de B-lijst', () => {
        // Gewone sollicitant
        var { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1 },
                { sollicitatieNummer: 2 }
            ],
            marktplaatsen: [{}, {}],
            aLijst: [
                { sollicitatieNummer: 2 }
            ]
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([1, 2]);
        expect(findOndernemers(afwijzingen)).toStrictEqual([]);
        expect(findPlaatsen(toewijzingen, 1)).toStrictEqual(['2']);
        expect(findPlaatsen(toewijzingen, 2)).toStrictEqual(['1']);

        // Sollicitant die wil bakken
        var { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1, voorkeur: { branches: ['bak'] } },
                { sollicitatieNummer: 2, voorkeur: { branches: ['bak'] } }
            ],
            marktplaatsen: [
                { branches: ['bak'] }, {}
            ],
            branches: [
                { brancheId: 'bak', verplicht: true }
            ],
            aLijst: [
                { sollicitatieNummer: 2 }
            ]
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([2]);
        expect(findOndernemers(afwijzingen)).toStrictEqual([1]);
        expect(findPlaatsen(toewijzingen, 2)).toStrictEqual(['1']);

        // EVI sollicitant
        var { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1, voorkeur: { verkoopinrichting: ['eigen-materieel'] } },
                { sollicitatieNummer: 2, voorkeur: { verkoopinrichting: ['eigen-materieel'] } }
            ],
            marktplaatsen: [
                { verkoopinrichting: ['eigen-materieel'] }, {}
            ],
            aLijst: [
                { sollicitatieNummer: 2 }
            ]
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([2]);
        expect(findOndernemers(afwijzingen)).toStrictEqual([1]);
        expect(findPlaatsen(toewijzingen, 2)).toStrictEqual(['1']);
    });

    it('mag maximaal uitbreiden voordat B-lijst ondernemers mogen uitbreiden', () => {
        const { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1, voorkeur: { maximum: 4 } },
                { sollicitatieNummer: 2, voorkeur: { maximum: 2 } }
            ],
            marktplaatsen: [
                {}, {}, {}, {}, {}
            ],
            aLijst: [
                { sollicitatieNummer: 1 }
            ]
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([1, 2]);
        expect(findOndernemers(afwijzingen)).toStrictEqual([]);
        expect(findPlaatsen(toewijzingen, 1)).toStrictEqual(['1', '2', '3', '4']);
        expect(findPlaatsen(toewijzingen, 2)).toStrictEqual(['5']);
    });

    it('krijgt GEEN voorrang over VPLs', () => {
        const { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1, status: 'vpl', plaatsen: ['1'] },
                { sollicitatieNummer: 2 }
            ],
            marktplaatsen: [{}, {}],
            aLijst: [
                { sollicitatieNummer: 2 }
            ]
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([1, 2]);
        expect(findOndernemers(afwijzingen)).toStrictEqual([]);
        expect(findPlaatsen(toewijzingen, 1)).toStrictEqual(['1']);
        expect(findPlaatsen(toewijzingen, 2)).toStrictEqual(['2']);
    });
});

describe('Een ondernemer wordt afgewezen', () => {
    it('als de markt vol is', () => {
        const { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 2 },
                { sollicitatieNummer: 1 }
            ],
            marktplaatsen: [{}]
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([1]);
        expect(findOndernemers(afwijzingen)).toStrictEqual([2]);
        expect(findPlaatsen(toewijzingen, 1)).toStrictEqual(['1']);
    });
});

describe('Een VPL/TVPL die niet ingedeeld wil worden', () => {
    it('kan zich afmelden voor een marktdag', () => {
        const { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1, status: 'vpl', plaatsen: ['1'] },
                { sollicitatieNummer: 2, status: 'tvpl', plaatsen: ['2'] },
                { sollicitatieNummer: 3, status: 'vpl', plaatsen: ['3'] },
                { sollicitatieNummer: 4, status: 'tvpl', plaatsen: ['4'] }
            ],
            marktplaatsen: [
                '1', '2', '3', '4'
            ],
            aanwezigheid: [
                { sollicitatieNummer: 1, attending: false },
                { sollicitatieNummer: 2, attending: false }
            ]
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([3, 4]);
        expect(findOndernemers(afwijzingen)).toStrictEqual([]);
        expect(findPlaatsen(toewijzingen, 3)).toStrictEqual(['3']);
        expect(findPlaatsen(toewijzingen, 4)).toStrictEqual(['4']);
    });

    it('kan zijn aanwezigheid voor een bepaalde periode uitschakelen', () => {
        const { toewijzingen, afwijzingen, openPlaatsen } = calc({
            marktDate: '2019-02-01',
            ondernemers: [
                { sollicitatieNummer: 1, status: 'vpl', plaatsen: ['1'], voorkeur: {
                    absentFrom: new Date('2019-01-29'),
                    absentUntil: new Date('2019-02-02')
                } },
                { sollicitatieNummer: 2, status: 'vpl', plaatsen: ['2'], voorkeur: {
                    absentFrom: new Date('2019-01-29'),
                    absentUntil: new Date('2019-02-01')
                } },
                { sollicitatieNummer: 3, status: 'tvpl', plaatsen: ['3'], voorkeur: {
                    absentFrom: new Date('2019-02-01'),
                    absentUntil: new Date('2019-02-03')
                } },
                { sollicitatieNummer: 4, status: 'vpl', plaatsen: ['4'], voorkeur: {
                    absentFrom: new Date('2019-01-29'),
                    absentUntil: new Date('2019-01-31')
                } },
                { sollicitatieNummer: 5, status: 'tvpl', plaatsen: ['5'], voorkeur: {
                    absentFrom: new Date('2019-02-02'),
                    absentUntil: new Date('2019-02-03')
                } }
            ],
            marktplaatsen: [{}, {}, {}, {}, {}]
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([4, 5]);
        expect(findOndernemers(afwijzingen)).toStrictEqual([]);
        expect(pluck(openPlaatsen, 'plaatsId')).toStrictEqual(['1', '2', '3']);
    });
});

describe('Een TVPLZ die niet ingedeeld wil worden', () => {
    it('hoeft zich niet af te melden als zij zichzelf niet aangemeld hebben', () => {
        const { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1, status: 'tvplz', plaatsen: [] }
            ],
            marktplaatsen: [
                '1'
            ],
            // property moet aanwezig zijn als lege array, omdat `marktScenario` hem
            // anders automatisch vult.
            aanwezigheid: []
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([]);
        expect(findOndernemers(afwijzingen)).toStrictEqual([]);
    });
});

describe('Een VPL/TVPL die ingedeeld wil worden', () => {
    it('krijgt voorkeur boven sollicitanten', () => {
        var { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1, status: 'soll' },
                { sollicitatieNummer: 2, status: 'vpl', plaatsen: ['1'] }
            ],
            marktplaatsen: [{}]
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([2]);
        expect(findOndernemers(afwijzingen)).toStrictEqual([1]);
        expect(findPlaatsen(toewijzingen, 2)).toStrictEqual(['1']);

        var { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1, status: 'soll' },
                { sollicitatieNummer: 2, status: 'tvpl', plaatsen: ['1'] }
            ],
            marktplaatsen: [{}]
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([2]);
        expect(findOndernemers(afwijzingen)).toStrictEqual([1]);
        expect(findPlaatsen(toewijzingen, 2)).toStrictEqual(['1']);
    });

    it('wordt toegewezen aan zijn vaste plaats(en)', () => {
        // Dit scenario laat expres 1 plaats vrij om een regression bug
        // in `calcSizes` te voorkomen (`size` werd daar verkeerd
        // berekend als er meer dan genoeg plaatsen waren).
        var { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1, status: 'vpl', plaatsen: ['1', '2', '3'] },
                { sollicitatieNummer: 2 }
            ],
            marktplaatsen: [
                {}, {}, {}, {}, {}
            ]
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([1, 2]);
        expect(findPlaatsen(toewijzingen, 1)).toStrictEqual(['1', '2', '3']);
        expect(findPlaatsen(toewijzingen, 2)).toStrictEqual(['4']);

        var { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1, status: 'vpl', plaatsen: ['1'] },
                { sollicitatieNummer: 2, status: 'vpl', plaatsen: ['2', '3', '4'] },
                // Van deze ondernemer voldoet slechts 1 plaats aan de branch eis, maar aangezien
                // de andere plaats is toegekend moeten zij daar toch worden ingedeeld.
                { sollicitatieNummer: 3, status: 'vpl', plaatsen: ['5', '6'], voorkeur: { branches: ['x'] } }
            ],
            marktplaatsen: [
                {},
                {}, {}, {},
                { branches: ['x'] }, {}
            ],
            branches: [
                { brancheId: 'x', verplicht: true }
            ]
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([1, 2, 3]);
        expect(findPlaatsen(toewijzingen, 1)).toStrictEqual(['1']);
        expect(findPlaatsen(toewijzingen, 2)).toStrictEqual(['2', '3', '4']);
        expect(findPlaatsen(toewijzingen, 3)).toStrictEqual(['5', '6']);

        // Ondernemers 1 en 2 mogen eerder kiezen, maar krijgen niet de
        // plaatsen van ondernemers 3 en 4.
        var { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1, status: 'vpl', plaatsen: ['3'] },
                { sollicitatieNummer: 2, status: 'tvpl', plaatsen: ['4'] },
                { sollicitatieNummer: 3, status: 'tvpl', plaatsen: ['2'] },
                { sollicitatieNummer: 4, status: 'vpl', plaatsen: ['1'] }
            ],
            marktplaatsen: [{}, {}, {}, {}, {}],
            voorkeuren: [
                { sollicitatieNummer: 1, plaatsId: '1' },
                { sollicitatieNummer: 2, plaatsId: '2' }
            ]
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([1, 2, 3, 4]);
        expect(findOndernemers(afwijzingen)).toStrictEqual([]);
        expect(findPlaatsen(toewijzingen, 1)).toStrictEqual(['3']);
        expect(findPlaatsen(toewijzingen, 2)).toStrictEqual(['4']);
        expect(findPlaatsen(toewijzingen, 3)).toStrictEqual(['2']);
        expect(findPlaatsen(toewijzingen, 4)).toStrictEqual(['1']);
    });

    it('kan zijn aantal vaste plaatsen verkleinen door een maximum in te stellen', () => {
        const { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1, status: 'vpl', plaatsen: ['1', '2'], voorkeur: { maximum: 1 } }
            ],
            marktplaatsen: [{}, {}],
            voorkeuren: [
                { sollicitatieNummer: 1, plaatsId: '2', priority: FIRST_CHOICE },
                { sollicitatieNummer: 1, plaatsId: '1', priority: SECOND_CHOICE }
            ]
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([1]);
        expect(findPlaatsen(toewijzingen, 1)).toStrictEqual(['2']);
    });

    it('wordt afgewezen als zijn vaste plaatsen niet beschikbaar zijn', () => {
        const { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1, status: 'vpl', plaatsen: ['1', '2'] },
                { sollicitatieNummer: 2, status: 'vpl', plaatsen: ['3', '4'], voorkeur: { minimum: 1 } },
                { sollicitatieNummer: 3, status: 'vpl', plaatsen: ['5', '6'] },
            ],
            marktplaatsen: [
                { inactive: true }, {},
                { inactive: true }, {},
                { inactive: true }, {},
                {}, {}
            ]
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([2, 3]);
        expect(findOndernemers(afwijzingen)).toStrictEqual([1]);
        expect(findPlaatsen(toewijzingen, 2)).toStrictEqual(['4']);
        expect(findPlaatsen(toewijzingen, 3)).toStrictEqual(['6', '7']);
    });

    // Uitgezet, omdat nog niet besloten is hoe om te gaan met 'willekeurig indelen' voor VPL.
    it.skip('kan hetzelfde aantal willekeurige plaatsen krijgen als zijn eigen plaatsen niet beschikbaar zijn', () => {
        const { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1, status: 'vpl', plaatsen: ['1', '2'], voorkeur: { anywhere: true } },
                { sollicitatieNummer: 2, status: 'vpl', plaatsen: ['3', '4'] }
            ],
            marktplaatsen: [
                { inactive: true }, { inactive: true },
                { inactive: true }, { inactive: true },
                {}, {},
                {}, {}
            ]
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([1]);
        expect(findOndernemers(afwijzingen)).toStrictEqual([2]);
        expect(findPlaatsen(toewijzingen, 1)).toStrictEqual(['5', '6']);
    });
});

describe('Een TVPLZ die ingedeeld wil worden', () => {
    it('moet zich eerst expliciet aanmelden', () => {
        const { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1, status: 'tvplz', plaatsen: ['1', '2'] }
            ],
            marktplaatsen: [
                '1', '2'
            ],
            aanwezigheid: [
                { sollicitatieNummer: 1, attending: true }
            ]
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([1]);
        expect(findOndernemers(afwijzingen)).toStrictEqual([]);
        expect(findPlaatsen(toewijzingen, 1)).toStrictEqual(['1', '2']);
    });

    it('krijgt voorkeur boven sollicitanten', () => {
        var { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1, status: 'soll' },
                { sollicitatieNummer: 2, status: 'tvplz', plaatsen: ['1'] }
            ],
            marktplaatsen: ['1']
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([2]);
        expect(findOndernemers(afwijzingen)).toStrictEqual([1]);
        expect(findPlaatsen(toewijzingen, 2)).toStrictEqual(['1']);

        var { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1, voorkeur: { branches: ['a'] }, status: 'soll' },
                { sollicitatieNummer: 2, voorkeur: { branches: ['a'] }, status: 'tvplz', plaatsen: ['2'] },
                { sollicitatieNummer: 3, voorkeur: { branches: ['a'] }, status: 'tvplz', plaatsen: ['1'] }
            ],
            marktplaatsen: [
                { branches: ['a'] }, { branches: ['a'] }, { branches: ['a'] }
            ],
            branches: [
                { brancheId: 'a', verplicht: true }
            ],
            voorkeuren: [
                { sollicitatieNummer: 3, plaatsId: '2' }
            ]
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([1, 2, 3]);
        expect(findOndernemers(afwijzingen)).toStrictEqual([]);
        expect(findPlaatsen(toewijzingen, 1)).toStrictEqual(['3']);
        expect(findPlaatsen(toewijzingen, 2)).toStrictEqual(['1']);
        expect(findPlaatsen(toewijzingen, 3)).toStrictEqual(['2']);
    });

    it('heeft geen voorrang over verplichte branche- en EVI ondernemers', () => {
        var { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1, status: 'soll', voorkeur: { branches: ['a'] } },
                { sollicitatieNummer: 2, status: 'tvplz', plaatsen: ['1'] }
            ],
            marktplaatsen: [
                { branches: ['a'] }, { branches: ['a'] }
            ],
            branches: [
                { brancheId: 'a', verplicht: true }
            ]
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([1, 2]);
        expect(findOndernemers(afwijzingen)).toStrictEqual([]);
        expect(findPlaatsen(toewijzingen, 1)).toStrictEqual(['1']);
        expect(findPlaatsen(toewijzingen, 2)).toStrictEqual(['2']);
    });

    it('heeft recht op een vast aantal plaatsen, maar heeft geen vaste plaats(en)', () => {
        const { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1, status: 'tvplz', plaatsen: ['2'] },
                { sollicitatieNummer: 2, status: 'tvplz', plaatsen: ['3', '4'] }
            ],
            marktplaatsen: ['1', '2', '3', '4']
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([1, 2]);
        expect(findOndernemers(afwijzingen)).toStrictEqual([]);
        expect(findPlaatsen(toewijzingen, 1)).toStrictEqual(['1']);
        expect(findPlaatsen(toewijzingen, 2)).toStrictEqual(['2', '3']);
    });

    it('mag zijn vaste aantal plaatsen niet verkleinen', () => {
        const { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1, status: 'tvplz', plaatsen: ['1', '2'], voorkeur: { maximum: 1 } },
            ],
            marktplaatsen: ['1', '2']
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([1]);
        expect(findOndernemers(afwijzingen)).toStrictEqual([]);
        expect(findPlaatsen(toewijzingen, 1)).toStrictEqual(['1', '2']);
    });

    it('mag zijn vaste aantal plaatsen uitbreiden indien mogelijk', () => {
        const { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1, status: 'tvplz', plaatsen: ['1'], voorkeur: { maximum: 2 } },
            ],
            marktplaatsen: ['1', '2']
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([1]);
        expect(findOndernemers(afwijzingen)).toStrictEqual([]);
        expect(findPlaatsen(toewijzingen, 1)).toStrictEqual(['1', '2']);
    });
});

describe('Een ondernemer in een verplichte branche (bijv. bak)', () => {
    it('kan enkel op een brancheplek staan', () => {
        const { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1, voorkeur: { branches: ['a'] } },
                { sollicitatieNummer: 2, voorkeur: { branches: ['b'] }, status: 'tvplz', plaatsen: ['1'] },
                { sollicitatieNummer: 3, voorkeur: { branches: ['b'] } }
            ],
            marktplaatsen: [
                {}, { branches: ['b'] }, { branches: ['b'] }
            ],
            branches: [
                { brancheId: 'a', verplicht: true },
                { brancheId: 'b', verplicht: true }
            ]
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([2, 3]);
        expect(findOndernemers(afwijzingen)).toStrictEqual([1]);
        expect(findPlaatsen(toewijzingen, 2)).toStrictEqual(['2']);
        expect(findPlaatsen(toewijzingen, 3)).toStrictEqual(['3']);
    });

    it('komt op de meest geschikte brancheplaats te staan', () => {
        // Branche overlap is belangrijker dan de prioritering van de ondernemer.
       var { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1, voorkeur: { branches: ['a', 'b'] } },
                { sollicitatieNummer: 2, voorkeur: { branches: ['a'] } },
            ],
            marktplaatsen: [
                { branches: ['a'] }, { branches: ['a', 'b'] }
            ],
            branches: [
                { brancheId: 'a', verplicht: true },
                { brancheId: 'b', verplicht: true }
            ],
            voorkeuren: [
                { sollicitatieNummer: 1, plaatsId: '1' }
            ]
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([1, 2]);
        expect(findOndernemers(afwijzingen)).toStrictEqual([]);
        expect(findPlaatsen(toewijzingen, 1)).toStrictEqual(['2']);
        expect(findPlaatsen(toewijzingen, 2)).toStrictEqual(['1']);

        // Een branche overlap waarbij de plaats meer branches heeft dan de ondernemer
        // betekent ook dat de plaats minder geschikt is voor deze ondernemer.
        var { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1, voorkeur: { branches: ['a'] } },
                { sollicitatieNummer: 2, voorkeur: { branches: ['b'] } },
            ],
            marktplaatsen: [
                { branches: ['a'] }, { branches: ['a', 'b'] }
            ],
            branches: [
                { brancheId: 'a', verplicht: true },
                { brancheId: 'b', verplicht: true }
            ],
            voorkeuren: [
                { sollicitatieNummer: 1, plaatsId: '2' }
            ]
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([1, 2]);
        expect(findOndernemers(afwijzingen)).toStrictEqual([]);
        expect(findPlaatsen(toewijzingen, 1)).toStrictEqual(['1']);

        // De betere branche overlap met plaats 1 is hier niet relevant, omdat er geen
        // ondernemers in branche `x` zijn.
        var { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1, voorkeur: { branches: ['a'] } },
            ],
            marktplaatsen: [
                { branches: ['a'] }, { branches: ['a', 'b'] }
            ],
            branches: [
                { brancheId: 'a', verplicht: true },
                { brancheId: 'b', verplicht: true }
            ],
            voorkeuren: [
                { sollicitatieNummer: 1, plaatsId: '2' }
            ]
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([1]);
        expect(findOndernemers(afwijzingen)).toStrictEqual([]);
        expect(findPlaatsen(toewijzingen, 1)).toStrictEqual(['2']);

        // Met 3 branche plaatsen en 1 branche ondernemer zonder voorkeur, probeer hem/haar op
        // een brancheplek in te delen waar zo min mogelijk voorkeuren voor zijn.
        var { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1 },
                { sollicitatieNummer: 2 },
                { sollicitatieNummer: 3, voorkeur: { branches: ['x'] } },
            ],
            marktplaatsen: [
                {}, {}, { branches: ['x'] }, { branches: ['x'] }, { branches: ['x'] }
            ],
            branches: [
                { brancheId: 'x', verplicht: true }
            ],
            voorkeuren: [
                { sollicitatieNummer: 1, plaatsId: '3', priority: 1 },
                { sollicitatieNummer: 2, plaatsId: '5', priority: 1 }

            ]
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([1, 2, 3]);
        expect(findOndernemers(afwijzingen)).toStrictEqual([]);
        expect(findPlaatsen(toewijzingen, 1)).toStrictEqual(['3']);
        expect(findPlaatsen(toewijzingen, 2)).toStrictEqual(['5']);
        expect(findPlaatsen(toewijzingen, 3)).toStrictEqual(['4']);
    });

    it('kan niet uitbreiden naar een niet-branche plaats', () => {
        const { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1, voorkeur: { branches: ['a'], minimum: 2 } },
            ],
            marktplaatsen: [
                { branches: ['a'] }, {}
            ],
            branches: [
                { brancheId: 'a', verplicht: true }
            ]
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([]);
        expect(findOndernemers(afwijzingen)).toStrictEqual([1]);
    });

    it('wordt afgewezen als er geen brancheplaatsen meer beschikbaar zijn', () => {
       const { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1, voorkeur: { branches: ['a'] } },
                { sollicitatieNummer: 2, voorkeur: { branches: ['a'] } }
            ],
            marktplaatsen: [
                { branches: ['a'] }, {}
            ],
            branches: [
                { brancheId: 'a', verplicht: true }
            ]
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([1]);
        expect(findOndernemers(afwijzingen)).toStrictEqual([2]);
    });

    // TODO: Deze functionaliteit wordt niet gebruikt? Momenteel niet meer
    //       geïmplementeerd.
    it.skip('wordt afgewezen als het maximum aantal branche-ondernemers bereikt is', () => {
        const { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 99, voorkeur: { branches: ['branche-x'] } },
                { sollicitatieNummer: 42, voorkeur: { branches: ['branche-x'] } }
            ],
            marktplaatsen: [{}, {}],
            branches: [{
                brancheId: 'branche-x',
                maximumToewijzingen: 1
            }]
        });

        expect(toewijzingen.length).toBe(1);
        expect(afwijzingen.length).toBe(1);
        expect(findPlaatsen(toewijzingen, 42)).toStrictEqual(['1']);
        expect(isRejected(afwijzingen, 99)).toBe(true);
    });

    it('krijgt voorrang boven VPLs die willen verplaatsen', () => {
        const { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1, status: 'vpl', plaatsen: ['1'] },
                { sollicitatieNummer: 2, voorkeur: { branches: ['a'] } },
            ],
            marktplaatsen: [
                {}, { branches: ['a'] }
            ],
            branches: [
                { brancheId: 'a', verplicht: true }
            ],
            voorkeuren: [
                { sollicitatieNummer: 1, plaatsId: '2' },
                { sollicitatieNummer: 2, plaatsId: '2' }
            ]
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([1, 2]);
        expect(findOndernemers(afwijzingen)).toStrictEqual([]);
        expect(findPlaatsen(toewijzingen, 1)).toStrictEqual(['1']);
        expect(findPlaatsen(toewijzingen, 2)).toStrictEqual(['2']);
    });

    it('krijgt voorrang boven sollicitanten niet in een verplichte branche', () => {
        // Altijd eerst brancheplaatsen proberen vullen met branche ondernemers.
        const { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1, voorkeur: { branches: ['a'], maximum: 2 } },
                { sollicitatieNummer: 2, voorkeur: { branches: ['a'], maximum: 2 } },
                { sollicitatieNummer: 3 }
            ],
            marktplaatsen: [
                { branches: ['a'] }, { branches: ['a'] }, { branches: ['a'] },
                {}, {}
            ],
            branches: [
                { brancheId: 'a', verplicht: true }
            ]
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([1, 2, 3]);
        expect(findOndernemers(afwijzingen)).toStrictEqual([]);
        expect(findPlaatsen(toewijzingen, 1)).toStrictEqual(['1', '2']);
        expect(findPlaatsen(toewijzingen, 2)).toStrictEqual(['3']);
        expect(findPlaatsen(toewijzingen, 3)).toStrictEqual(['4']);
    });
});

describe('Een ondernemer in een beperkte branche (bijv. agf)', () => {
    it('kan het maximum aantal plaatsen als SOLL niet overschrijden', () => {
        // Ondernemers in een branche met een toewijzingsbeperking kregen in sommige
        // situaties teveel plaatsen toegekend. Dit gebeurde voornamelijk als er nog
        // 1 brancheplek beschikbaar was maar de ondernemer aan zet wilde graag 2 plaatsen.
        // Als er vervolgens optimistisch werd ingedeeld kreeg deze ondernemer gelijk
        // 2 plaatsen, waarmee het maximum met 1 plaats werd overschreden.
        const { toewijzingen, afwijzingen } = calc({
            ondernemers : [
                { sollicitatieNummer : 1, voorkeur: { branches: ['x'], maximum: 2 } },
                { sollicitatieNummer : 2, voorkeur: { branches: ['x'], maximum: 2 } }
            ],
            marktplaatsen: [
                '1', '2', '3', '4', '5', '6'
            ],
            branches: [{
                brancheId: 'x',
                maximumPlaatsen: 3
            }]
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([1, 2]);
        expect(findPlaatsen(toewijzingen, 1)).toStrictEqual(['1', '2']);
        expect(findPlaatsen(toewijzingen, 2)).toStrictEqual(['3']);
    });

    it('kan het maximum aantal plaatsen overschrijden indien VPL', () => {
        // VPL in een branche met een toewijzingsbeperking moeten wel altijd hun
        // plaatsen toegewezen krijgen, ook al overschrijden ze daarmee het maximum.
        const { toewijzingen, afwijzingen } = calc({
            ondernemers : [
                { sollicitatieNummer : 1, status: 'vpl', plaatsen: ['1', '2'], voorkeur: { branches: ['x'] } },
                { sollicitatieNummer : 2, status: 'vpl', plaatsen: ['3'], voorkeur: { branches: ['x'] } }
            ],
            marktplaatsen: [
                '1', '2', '3'
            ],
            branches: [{
                brancheId: 'x',
                maximumPlaatsen: 1
            }]
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([1, 2]);
        expect(findPlaatsen(toewijzingen, 1)).toStrictEqual(['1', '2']);
        expect(findPlaatsen(toewijzingen, 2)).toStrictEqual(['3']);
    });

    it('kan conservatief ingedeeld worden terwijl de rest van de markt optimistisch ingedeeld wordt', () => {
        const { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1, voorkeur: { branches: ['x', 'y'], maximum: 2 } },
                { sollicitatieNummer: 2, voorkeur: { branches: ['x'], maximum: 2 } },
                { sollicitatieNummer: 3, voorkeur: { branches: ['x', 'y'] } }
            ],
            marktplaatsen: [
                '1', '2', '3', '4', '5'
            ],
            branches: [
                { brancheId: 'x', maximumPlaatsen: 2 },
                { brancheId: 'y', maximumPlaatsen: 3 },
            ]
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([1, 2]);
        expect(findOndernemers(afwijzingen)).toStrictEqual([3]);
        expect(findPlaatsen(toewijzingen, 1)).toStrictEqual(['1']);
        expect(findPlaatsen(toewijzingen, 2)).toStrictEqual(['2']);
    });
});

describe('Een ondernemer met een EVI', () => {
    it('kan enkel op een EVI plaats staan', () => {
        const { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1, voorkeur: { verkoopinrichting: ['eigen-materieel'] } },
            ],
            marktplaatsen: [
                {}
            ]
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([]);
        expect(findOndernemers(afwijzingen)).toStrictEqual([1]);
    });

    it('komt op de meest geschikte EVI plaats te staan', () => {
        // Branche overlap is hier belangrijker dan de prioritering van de ondernemer.
       const { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1, voorkeur: { branches: ['x'], verkoopinrichting: ['eigen-materieel'] } },
            ],
            marktplaatsen: [
                { verkoopinrichting: ['eigen-materieel'] }, { branches: ['x'], verkoopinrichting: ['eigen-materieel'] }
            ],
            branches: [
                { brancheId: 'x' }
            ],
            voorkeuren: [
                { sollicitatieNummer: 1, plaatsId: '1' }
            ]
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([1]);
        expect(findOndernemers(afwijzingen)).toStrictEqual([]);
        expect(findPlaatsen(toewijzingen, 1)).toStrictEqual(['2']);
    });

    it('kan niet uitbreiden naar een niet-EVI plaats', () => {
        const { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1, voorkeur: { verkoopinrichting: ['eigen-materieel'], minimum: 2 } },
            ],
            marktplaatsen: [
                { verkoopinrichting: ['eigen-materieel'] }, {}
            ]
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([]);
        expect(findOndernemers(afwijzingen)).toStrictEqual([1]);
    });

    it('wordt afgewezen als er geen EVI plaatsen meer beschikbaar zijn', () => {
       const { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1, voorkeur: { verkoopinrichting: ['eigen-materieel'] } },
                { sollicitatieNummer: 2, voorkeur: { verkoopinrichting: ['eigen-materieel'] } }
            ],
            marktplaatsen: [
                { verkoopinrichting: ['eigen-materieel'] }, {}
            ]
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([1]);
        expect(findOndernemers(afwijzingen)).toStrictEqual([2]);
    });

    it('krijgt voorrang boven VPLs die willen verplaatsen', () => {
        const { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1, status: 'vpl', plaatsen: ['1'] },
                { sollicitatieNummer: 2, voorkeur: { verkoopinrichting: ['eigen-materieel'] } },
            ],
            marktplaatsen: [
                {}, { verkoopinrichting: ['eigen-materieel'] }
            ],
            voorkeuren: [
                { sollicitatieNummer: 1, plaatsId: '2' },
                { sollicitatieNummer: 2, plaatsId: '2' }
            ]
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([1, 2]);
        expect(findOndernemers(afwijzingen)).toStrictEqual([]);
        expect(findPlaatsen(toewijzingen, 1)).toStrictEqual(['1']);
        expect(findPlaatsen(toewijzingen, 2)).toStrictEqual(['2']);
    });

    it('krijgt voorrang boven sollicitanten zonder EVI', () => {
        // Altijd eerst EVI plaatsen proberen vullen met EVI ondernemers.
        // Ook indien `strategy === 'conservative'`.
        const { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1, voorkeur: { verkoopinrichting: ['eigen-materieel'], maximum: 2 } },
                { sollicitatieNummer: 2, voorkeur: { verkoopinrichting: ['eigen-materieel'], maximum: 2 } },
                { sollicitatieNummer: 3 }
            ],
            marktplaatsen: [
                { verkoopinrichting: ['eigen-materieel'] },
                { verkoopinrichting: ['eigen-materieel'] },
                { verkoopinrichting: ['eigen-materieel'] },
                {}
            ]
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([1, 2, 3]);
        expect(findOndernemers(afwijzingen)).toStrictEqual([]);
        expect(findPlaatsen(toewijzingen, 1)).toStrictEqual(['1', '2']);
        expect(findPlaatsen(toewijzingen, 2)).toStrictEqual(['3']);
        expect(findPlaatsen(toewijzingen, 3)).toStrictEqual(['4']);
    });
});

describe('Een VPL die wil verplaatsen', () => {
    it('krijgt WEL voorrang boven sollicitanten die niet willen bakken', () => {
        const { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1 },
                { sollicitatieNummer: 2, status: 'vpl', plaatsen: ['1'] }
            ],
            marktplaatsen: [{}, {}],
            voorkeuren: [
                { sollicitatieNummer: 1, plaatsId: '2' },
                { sollicitatieNummer: 2, plaatsId: '2' }
            ]
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([1, 2]);
        expect(findOndernemers(afwijzingen)).toStrictEqual([]);
        expect(findPlaatsen(toewijzingen, 1)).toStrictEqual(['1']);
        expect(findPlaatsen(toewijzingen, 2)).toStrictEqual(['2']);
    });

    it.todo('krijgt WEL voorrang boven bak ondernemers als zij zelf ook bakken');
    it.todo('krijgt WEL voorrang boven EVI ondernemers als zij zelf ook een EVI hebben');

    it.todo('krijgt GEEN voorrang boven EVI ondernemers');

    it('kan altijd verplaatsen naar een losse plaats', () => {
        const { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1, status: 'vpl', plaatsen: ['1'] }
            ],
            marktplaatsen: [{}, {}],
            voorkeuren: [
                { sollicitatieNummer: 1, plaatsId: '2' }
            ]
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([1]);
        expect(findOndernemers(afwijzingen)).toStrictEqual([]);
        expect(findPlaatsen(toewijzingen, 1)).toStrictEqual(['2']);
    });

    it('mag niet naar een plaats van een andere aanwezige VPL', () => {
        const { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1, status: 'vpl', plaatsen: ['1'] },
                { sollicitatieNummer: 2, status: 'vpl', plaatsen: ['2'] }
            ],
            marktplaatsen: [
                {}, {}
            ],
            voorkeuren: [
                { sollicitatieNummer: 1, plaatsId: '2' }
            ]
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([1, 2]);
        expect(findPlaatsen(toewijzingen, 1)).toStrictEqual(['1']);
        expect(findPlaatsen(toewijzingen, 2)).toStrictEqual(['2']);
    });

    it('mag ruilen met een andere VPL', () => {
        const { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { status: 'vpl', plaatsen: ['1'] },
                { status: 'vpl', plaatsen: ['2'] }
            ],
            marktplaatsen: [{}, {}],
            voorkeuren: [
                { sollicitatieNummer: 1, plaatsId: '2' },
                { sollicitatieNummer: 2, plaatsId: '1' }
            ]
        });

        expect(toewijzingen.length).toBe(2);
        expect(findPlaatsen(toewijzingen, 1)).toStrictEqual(['2']);
        expect(findPlaatsen(toewijzingen, 2)).toStrictEqual(['1']);
    });

    it('kan de plaats van een andere VPL krijgen als die ook verplaatst', () => {
        var { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1, status: 'vpl', plaatsen: ['1'] },
                { sollicitatieNummer: 2, status: 'vpl', plaatsen: ['2'] }
            ],
            marktplaatsen: [{}, {}, {}],
            voorkeuren: [
                { sollicitatieNummer: 1, plaatsId: '2', priority: FIRST_CHOICE },
                { sollicitatieNummer: 2, plaatsId: '1', priority: FIRST_CHOICE }
            ]
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([1, 2]);
        expect(findPlaatsen(toewijzingen, 1)).toStrictEqual(['2']);
        expect(findPlaatsen(toewijzingen, 2)).toStrictEqual(['1']);

        var { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1, status: 'vpl', plaatsen: ['1'] },
                { sollicitatieNummer: 2, status: 'vpl', plaatsen: ['2'] },
                { sollicitatieNummer: 3, status: 'vpl', plaatsen: ['3'] }
            ],
            marktplaatsen: ['1', '2', '3', '4', '5'],
            voorkeuren: [
                { sollicitatieNummer: 1, plaatsId: '4', priority: FIRST_CHOICE },
                { sollicitatieNummer: 2, plaatsId: '1', priority: FIRST_CHOICE },
                { sollicitatieNummer: 3, plaatsId: '1', priority: FIRST_CHOICE },
                { sollicitatieNummer: 3, plaatsId: '5', priority: SECOND_CHOICE }
            ]
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([1, 2, 3]);

        expect(findPlaatsen(toewijzingen, 1)).toStrictEqual(['4']);
        expect(findPlaatsen(toewijzingen, 2)).toStrictEqual(['1']);
        expect(findPlaatsen(toewijzingen, 3)).toStrictEqual(['5']);
    });

    it('blijft staan als een VPL met hogere anciënniteit dezelfde voorkeur heeft', () => {
        const { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1, status: 'vpl', plaatsen: ['1'] },
                { sollicitatieNummer: 2, status: 'vpl', plaatsen: ['3'] },
                { sollicitatieNummer: 3, status: 'vpl', plaatsen: ['2'] }
            ],
            marktplaatsen: [{}, {}, {}, {}],
            voorkeuren: [
                { sollicitatieNummer: 1, plaatsId: '3', priority: FIRST_CHOICE },
                { sollicitatieNummer: 2, plaatsId: '1', priority: FIRST_CHOICE },
                { sollicitatieNummer: 3, plaatsId: '1', priority: FIRST_CHOICE },
                { sollicitatieNummer: 3, plaatsId: '3', priority: SECOND_CHOICE }
            ]
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([1, 2, 3]);
        expect(findOndernemers(afwijzingen)).toStrictEqual([]);

        expect(findPlaatsen(toewijzingen, 1)).toStrictEqual(['3']);
        expect(findPlaatsen(toewijzingen, 2)).toStrictEqual(['1']);
        expect(findPlaatsen(toewijzingen, 3)).toStrictEqual(['2']);
    });

    it('kan naar een locatie met minimaal 1 beschikbare voorkeur', () => {
        const { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1, status: 'vpl', plaatsen: ['1', '2'] },
                { sollicitatieNummer: 2, status: 'vpl', plaatsen: ['3'] }
            ],
            marktplaatsen: [{}, {}, {}, {}, {}, {}],
            voorkeuren: [
                { sollicitatieNummer: 1, plaatsId: '3', priority: FIRST_CHOICE },
                { sollicitatieNummer: 1, plaatsId: '4', priority: SECOND_CHOICE }
            ]
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([1, 2]);
        expect(findOndernemers(afwijzingen)).toStrictEqual([]);
        expect(findPlaatsen(toewijzingen, 1)).toStrictEqual(['4', '5']);
        expect(findPlaatsen(toewijzingen, 2)).toStrictEqual(['3']);
    });

    it('met meerdere plaatsen behoudt dit aantal na verplaatsing', () => {
        // VPL met plaatsen 1,2 heeft voorkeur 3. Plaats 3 is vrij --> verplaatsing naar 2,3.
        var { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1, status: 'vpl', plaatsen: ['1', '2'] }
            ],
            marktplaatsen: [
                {}, {}, {}, {}, {}
            ],
            voorkeuren: [
                { sollicitatieNummer: 1, plaatsId: '3', priority: FIRST_CHOICE }
            ]
        });
        expect(findOndernemers(toewijzingen)).toStrictEqual([1]);
        expect(findPlaatsen(toewijzingen, 1)).toStrictEqual(['2', '3']);

        // VPL met plaatsen 1,2 heeft voorkeur 4. Plaats 3 en 4 is vrij --> verplaatsing naar 3,4.
        var { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1, status: 'vpl', plaatsen: ['1', '2'] }
            ],
            marktplaatsen: [
                {}, {}, {}, {}, {}
            ],
            voorkeuren: [
                { sollicitatieNummer: 1, plaatsId: '4', priority: FIRST_CHOICE },
            ]
        });
        expect(findOndernemers(toewijzingen)).toStrictEqual([1]);
        expect(findPlaatsen(toewijzingen, 1)).toStrictEqual(['3', '4']);

        // VPL met plaatsen 1,2 heeft voorkeur 4. Plaats 3 is niet vrij vrij --> verplaatsing naar 4,5.
        var { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1, status: 'vpl', plaatsen: ['1', '2'] }
            ],
            marktplaatsen: [
                {}, {}, { inactive: true }, {}, {}
            ],
            voorkeuren: [
                { sollicitatieNummer: 1, plaatsId: '4', priority: FIRST_CHOICE }
            ]
        });
        expect(findOndernemers(toewijzingen)).toStrictEqual([1]);
        expect(findPlaatsen(toewijzingen, 1)).toStrictEqual(['4', '5']);

        // VPL met plaatsen 1,2 heeft voorkeur 3. Plaats 3 is niet vrij --> blijft staan.
        var { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1, status: 'vpl', plaatsen: ['1', '2'] }
            ],
            marktplaatsen: [
                {}, {}, { inactive: true }, {}, {}
            ],
            voorkeuren: [
                { sollicitatieNummer: 1, plaatsId: '3', priority: FIRST_CHOICE },
            ]
        });
        expect(findOndernemers(toewijzingen)).toStrictEqual([1]);
        expect(findPlaatsen(toewijzingen, 1)).toStrictEqual(['1', '2']);

        // VPL met plaatsen 1,2 heeft voorkeur 3,4. Plaats 3 en 4 zijn vrij --> verplaatsing naar 3,4.
        var { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1, status: 'vpl', plaatsen: ['1', '2'] }
            ],
            marktplaatsen: [
                {}, {}, {}, {}, {}
            ],
            voorkeuren: [
                { sollicitatieNummer: 1, plaatsId: '3', priority: FIRST_CHOICE },
                { sollicitatieNummer: 1, plaatsId: '4', priority: SECOND_CHOICE }
            ]
        });
        expect(findOndernemers(toewijzingen)).toStrictEqual([1]);
        expect(findPlaatsen(toewijzingen, 1)).toStrictEqual(['3', '4']);

        // VPL met plaatsen 1,2 heeft voorkeur 3,4. Plaats 3 is niet vrij --> verplaatsing naar 4,5.
        var { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1, status: 'vpl', plaatsen: ['1', '2'] }
            ],
            marktplaatsen: [
                {}, {}, { inactive: true }, {}, {}
            ],
            voorkeuren: [
                { sollicitatieNummer: 1, plaatsId: '3', priority: FIRST_CHOICE },
                { sollicitatieNummer: 1, plaatsId: '4', priority: SECOND_CHOICE }
            ]
        });
        expect(findOndernemers(toewijzingen)).toStrictEqual([1]);
        expect(findPlaatsen(toewijzingen, 1)).toStrictEqual(['4', '5']);

        // VPL met plaatsen 1,2 heeft voorkeur 3,4. Plaats 4 is niet vrij --> verplaatsing naar 2,3.
        var { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1, status: 'vpl', plaatsen: ['1', '2'] }
            ],
            marktplaatsen: [
                {}, {}, {}, { inactive: true }, {}
            ],
            voorkeuren: [
                { sollicitatieNummer: 1, plaatsId: '3', priority: FIRST_CHOICE },
                { sollicitatieNummer: 1, plaatsId: '4', priority: SECOND_CHOICE }
            ]
        });
        expect(findOndernemers(toewijzingen)).toStrictEqual([1]);
        expect(findPlaatsen(toewijzingen, 1)).toStrictEqual(['2', '3']);

        // VPL met plaatsen 1,2 heeft voorkeur 5 --> verplaatsing naar 4,5.
        var { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1, status: 'vpl', plaatsen: ['1', '2'] }
            ],
            marktplaatsen: [
                {}, {}, {}, {}, {}
            ],
            voorkeuren: [
                { sollicitatieNummer: 1, plaatsId: '5', priority: FIRST_CHOICE },
            ]
        });
        expect(findOndernemers(toewijzingen)).toStrictEqual([1]);
        expect(findPlaatsen(toewijzingen, 1)).toStrictEqual(['4', '5']);
    });

    it('raken hun eigen plaats niet kwijt als hun voorkeur niet beschikbaar is', () => {
        const { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1, status: 'vpl', plaatsen: ['1'] },
                { sollicitatieNummer: 2, status: 'vpl', plaatsen: ['2'] },
                { sollicitatieNummer: 3, status: 'vpl', plaatsen: ['3'] }
            ],
            marktplaatsen: [
                '1', '2', '3'
            ],
            voorkeuren: [
                { sollicitatieNummer: 1, plaatsId: '2', priority: FIRST_CHOICE },
                { sollicitatieNummer: 2, plaatsId: '3', priority: FIRST_CHOICE },
                { sollicitatieNummer: 3, plaatsId: '2', priority: FIRST_CHOICE }
            ]
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([1, 2, 3]);
        expect(findOndernemers(afwijzingen)).toStrictEqual([]);
        expect(findPlaatsen(toewijzingen, 1)).toStrictEqual(['1']);
        expect(findPlaatsen(toewijzingen, 2)).toStrictEqual(['3']);
        expect(findPlaatsen(toewijzingen, 3)).toStrictEqual(['2']);
    });
});

describe('Een sollicitant met een tijdelijke vaste plaats (exp of expf)', () => {
    it('moet zich aanmelden als aanwezig om ingedeeld te worden', () => {
        const { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1, status: 'exp', plaatsen: ['1'] },
                { sollicitatieNummer: 2, status: 'exp', plaatsen: ['2'] },
                { sollicitatieNummer: 3, status: 'expf', plaatsen: ['3'] },
                { sollicitatieNummer: 4, status: 'expf', plaatsen: ['4'] }
            ],
            marktplaatsen: ['1', '2', '3', '4'],
            aanwezigheid: [
                { sollicitatieNummer: 2, attending: true },
                { sollicitatieNummer: 4, attending: true },
            ]
        });

        // Iemand die niet aangemeld is, wordt ook niet afgewezen — deze ondernemer komt
        // simpelweg niet voor in de berekening.
        expect(findOndernemers(toewijzingen)).toStrictEqual([2, 4]);
        expect(findOndernemers(afwijzingen)).toStrictEqual([]);
        expect(findPlaatsen(toewijzingen, 2)).toStrictEqual(['2']);
        expect(findPlaatsen(toewijzingen, 4)).toStrictEqual(['4']);
    });

    it('wordt ingedeeld voor andere sollicitanten', () => {
        const { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1, status: 'soll' },
                { sollicitatieNummer: 2, status: 'exp', plaatsen: ['2'] },
                { sollicitatieNummer: 3, status: 'expf', plaatsen: ['3'] }
            ],
            marktplaatsen: ['1', '2', '3'],
            voorkeuren: [
                { sollicitatieNummer: 1, plaatsId: '2' },
                { sollicitatieNummer: 1, plaatsId: '3' }
            ]
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([1, 2, 3]);
        expect(findOndernemers(afwijzingen)).toStrictEqual([]);
        expect(findPlaatsen(toewijzingen, 1)).toStrictEqual(['1']);
        expect(findPlaatsen(toewijzingen, 2)).toStrictEqual(['2']);
        expect(findPlaatsen(toewijzingen, 3)).toStrictEqual(['3']);
    });

    it('kan niet verplaatsen als zij een vaste plaats hebben', () => {
        const { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1, status: 'exp', plaatsen: ['1'] },
                { sollicitatieNummer: 2, status: 'expf', plaatsen: ['3'] }
            ],
            marktplaatsen: ['1', '2', '3', '4'],
            voorkeuren: [
                { sollicitatieNummer: 1, plaatsId: '2' },
                { sollicitatieNummer: 2, plaatsId: '4' }
            ]
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([1, 2]);
        expect(findOndernemers(afwijzingen)).toStrictEqual([]);
        expect(findPlaatsen(toewijzingen, 1)).toStrictEqual(['1']);
        expect(findPlaatsen(toewijzingen, 2)).toStrictEqual(['3']);
    });

    it('kan geen minimum gewenste plaatsen opgeven in hun voorkeuren', () => {
       const { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1, status: 'exp', plaatsen: ['1'], voorkeur: { minimum: 2 } },
                { sollicitatieNummer: 2, status: 'expf', plaatsen: ['3'], voorkeur: { minimum: 2 } }
            ],
            marktplaatsen: ['1', '2', '3', '4']
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([1, 2]);
        expect(findOndernemers(afwijzingen)).toStrictEqual([]);
        expect(findPlaatsen(toewijzingen, 1)).toStrictEqual(['1']);
        expect(findPlaatsen(toewijzingen, 2)).toStrictEqual(['3']);
    });

    it('kan geen maximum aantal gewenste plaatsen opgeven in hun voorkeuren', () => {
        const { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1, status: 'exp', plaatsen: ['1'], voorkeur: { maximum: 2 } },
                { sollicitatieNummer: 2, status: 'exp', plaatsen: ['3'], voorkeur: { maximum: 2 } },
            ],
            marktplaatsen: ['1', '2', '3', '4']
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([1, 2]);
        expect(findOndernemers(afwijzingen)).toStrictEqual([]);
        expect(findPlaatsen(toewijzingen, 1)).toStrictEqual(['1']);
        expect(findPlaatsen(toewijzingen, 2)).toStrictEqual(['3']);
    });
});

describe('Een sollicitant die ingedeeld wil worden', () => {
    it('is niet verplicht zijn branche in te vullen', () => {
        const { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1 },
                { sollicitatieNummer: 2, voorkeur: { branches: ['x'] } }
            ],
            marktplaatsen: [
                { branches: ['x'] }
            ]
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([1]);
        expect(findOndernemers(afwijzingen)).toStrictEqual([2]);
        expect(findPlaatsen(toewijzingen, 1)).toStrictEqual(['1']);
    });

    it('krijgt voorkeur op plaatsen zonder kraam indien zij een EVI hebben', () => {
        const { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1 },
                { sollicitatieNummer: 2, voorkeur: { verkoopinrichting: ['eigen-materieel'] } }
            ],
            marktplaatsen: [
                { verkoopinrichting: ['eigen-materieel'] }
            ]
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([2]);
        expect(findOndernemers(afwijzingen)).toStrictEqual([1]);
        expect(findPlaatsen(toewijzingen, 2)).toStrictEqual(['1']);
    });

    it('krijgt voorkeur als zij op de A-lijst staan', () => {
        const { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1 },
                { sollicitatieNummer: 2 }
            ],
            marktplaatsen: [{}],
            aLijst: [{ sollicitatieNummer: 2 }]
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([2]);
        expect(findOndernemers(afwijzingen)).toStrictEqual([1]);
        expect(findPlaatsen(toewijzingen, 2)).toStrictEqual(['1']);
    });

    it('krijgt voorkeur over andere sollicitanten op een brancheplaats als zij in deze branche opereren', () => {
        const { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1 },
                { sollicitatieNummer: 2, voorkeur: { branches: ['x'] } }
            ],
            marktplaatsen: [
                { branches: ['x'] }, {}
            ],
            branches: [
                { brancheId: 'x', verplicht: true }
            ]
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([1, 2]);
        expect(findOndernemers(afwijzingen)).toStrictEqual([]);
        expect(findPlaatsen(toewijzingen, 1)).toStrictEqual(['2']);
        expect(findPlaatsen(toewijzingen, 2)).toStrictEqual(['1']);
    });

    it('krijgt voorkeur over VPLs op een brancheplaats als zij in deze branche opereren', () => {
        const { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1, status: 'vpl', plaatsen: ['3'] },
                { sollicitatieNummer: 2, voorkeur: { branches: ['x'] } }
            ],
            marktplaatsen: [
                { branches: ['x'] }, {}, {}
            ],
            branches: [
                { brancheId: 'x', verplicht: true }
            ],
            voorkeuren: [
                { sollicitatieNummer: 1, plaatsId: '1' }
            ]
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([1, 2]);
        expect(findOndernemers(afwijzingen)).toStrictEqual([]);
        expect(findPlaatsen(toewijzingen, 1)).toStrictEqual(['3']);
        expect(findPlaatsen(toewijzingen, 2)).toStrictEqual(['1']);
    });

    it('mag naar een plaats van een afwezige VPL', () => {
        const { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1, plaatsen: ['2'], status: 'vpl' },
                { sollicitatieNummer: 2 }
            ],
            aanwezigheid: [
                { sollicitatieNummer: 1, attending: false },
                { sollicitatieNummer: 2, attending: true }
            ],
            marktplaatsen: [{}, {}],
            voorkeuren: [
                { sollicitatieNummer: 2, plaatsId: '2' }
            ]
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([2]);
        expect(findOndernemers(afwijzingen)).toStrictEqual([]);
        expect(findPlaatsen(toewijzingen, 2)).toStrictEqual(['2']);
    });

    it('komt liefst niet op de voorkeursplek van een ander als zij flexibel ingedeeld willen worden', () => {
        var { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1, voorkeur: { anywhere: true } },
                { sollicitatieNummer: 2 }
            ],
            marktplaatsen: [
                {}, {}
            ],
            voorkeuren: [
                { sollicitatieNummer: 2, plaatsId: '1' }
            ]
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([1, 2]);
        expect(findPlaatsen(toewijzingen, 1)).toStrictEqual(['2']);
        expect(findPlaatsen(toewijzingen, 2)).toStrictEqual(['1']);

        var { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1, voorkeur: { anywhere: true } },
                { sollicitatieNummer: 2 }
            ],
            marktplaatsen: [
                {}, { inactive: true }
            ],
            voorkeuren: [
                { sollicitatieNummer: 2, plaatsId: '1' }
            ]
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([1]);
        expect(findOndernemers(afwijzingen)).toStrictEqual([2]);
        expect(findPlaatsen(toewijzingen, 1)).toStrictEqual(['1']);
    });

    it('kan kiezen niet te worden ingedeeld op willekeurige plaatsen', () => {
        // Bij `anywhere === false`: Uitbreiden naar willekeurige plaatsen is toegestaan
        // indien de ondernemer op ten minsten één voorkeursplaats staat, maar indelen
        // op enkel willekeurige plaatsen is niet toegestaan.
        const { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1, voorkeur: { anywhere: false, maximum: 3 } },
                { sollicitatieNummer: 2, voorkeur: { anywhere: false } }
            ],
            marktplaatsen: [{}, {}, {}, {}],
            voorkeuren: [
                { sollicitatieNummer: 1, plaatsId: '2', priority: FIRST_CHOICE },
                { sollicitatieNummer: 1, plaatsId: '3', priority: SECOND_CHOICE },
                { sollicitatieNummer: 2, plaatsId: '2' }
            ]
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([1]);
        expect(findOndernemers(afwijzingen)).toStrictEqual([2]);
        expect(findPlaatsen(toewijzingen, 1)).toStrictEqual(['1', '2', '3']);
    });
});

describe('Een ondernemer die wil uitbreiden', () => {
    it('blijft binnen dezelfde marktkraamrij', () => {
        const { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1, voorkeur: { maximum: 2 } }
            ],
            marktplaatsen: [{}, {}],
            rows: [['1'], ['2']]
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([1]);
        expect(findOndernemers(afwijzingen)).toStrictEqual([]);
        expect(findPlaatsen(toewijzingen, 1)).toStrictEqual(['1']);
    });

    it('kan een 2de plaats krijgen', () => {
        const { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1, voorkeur: { maximum: 2 } }
            ],
            marktplaatsen: [{}, {}]
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([1]);
        expect(findPlaatsen(toewijzingen, 1)).toStrictEqual(['1', '2']);
    });

    it('krijgt aaneensluitende plaatsen', () => {
       const { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1, voorkeur: { maximum: 2 } }
            ],
            marktplaatsen: [{}, {}, {}],
            voorkeuren: [
                { sollicitatieNummer: 1, plaatsId: '1', priority: SECOND_CHOICE },
                { sollicitatieNummer: 1, plaatsId: '3', priority: FIRST_CHOICE }
            ]
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([1]);
        expect(findOndernemers(afwijzingen)).toStrictEqual([]);
        expect(findPlaatsen(toewijzingen, 1)).toStrictEqual(['2', '3']);
    });

    it('krijgt gelijk twee plaatsen als er genoeg ruimte op de markt is', () => {
        const { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1, status: 'vpl', plaatsen: ['1'], voorkeur: { maximum: 2 } },
                { sollicitatieNummer: 2, voorkeur: { maximum: 2 } },
                { sollicitatieNummer: 3 }
            ],
            marktplaatsen: [{}, {}, {}, {}, {}]
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([1, 2, 3]);
        expect(findOndernemers(afwijzingen)).toStrictEqual([]);
        expect(findPlaatsen(toewijzingen, 1)).toStrictEqual(['1', '2']);
        expect(findPlaatsen(toewijzingen, 2)).toStrictEqual(['3', '4']);
        expect(findPlaatsen(toewijzingen, 3)).toStrictEqual(['5']);
    });

    it('naar meer dan 2 plaatsen moet wachten op iedereen die 2 plaatsen wil', () => {
        const { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1, status: 'vpl', plaatsen: ['2', '3'], voorkeur: { maximum: 3 } },
                { sollicitatieNummer: 2, voorkeur: { maximum: 2 } }
            ],
            marktplaatsen: [{}, {}, {}, {}],
            voorkeuren: [
                { sollicitatieNummer: 1, plaatsId: '1', priority: FIRST_CHOICE },
                { sollicitatieNummer: 2, plaatsId: '3', priority: FIRST_CHOICE },
                { sollicitatieNummer: 2, plaatsId: '4', priority: SECOND_CHOICE }
            ]
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([1, 2]);
        expect(findOndernemers(afwijzingen)).toStrictEqual([]);
        expect(findPlaatsen(toewijzingen, 1)).toStrictEqual(['1', '2']);
        expect(findPlaatsen(toewijzingen, 2)).toStrictEqual(['3', '4']);
    });

    it('kan 3 plaatsen krijgen', () => {
        const { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1, voorkeur: { maximum: 3 } }
            ],
            marktplaatsen: [{}, {}, {}]
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([1]);
        expect(findPlaatsen(toewijzingen, 1)).toStrictEqual(['1', '2', '3']);
    });

    it('kan niet uitbreiden naar een niet-branche plaats als zijn branche verplicht is', () => {
        const { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1, voorkeur: { branches: ['x'], maximum: 2 } }
            ],
            marktplaatsen: [
                { branches: ['x'] }, {}
            ],
            branches: [
                { brancheId: 'x', verplicht: true }
            ]
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([1]);
        expect(findOndernemers(afwijzingen)).toStrictEqual([]);
        expect(findPlaatsen(toewijzingen, 1)).toStrictEqual(['1']);
    });

    it('kan niet uitbreiden naar een niet-EVI plaats indien zij een EVI hebben', () => {
        const { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1, voorkeur: { verkoopinrichting: ['eigen-materieel'], maximum: 2 } }
            ],
            marktplaatsen: [
                { verkoopinrichting: ['eigen-materieel'] }, {}
            ]
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([1]);
        expect(findOndernemers(afwijzingen)).toStrictEqual([]);
        expect(findPlaatsen(toewijzingen, 1)).toStrictEqual(['1']);
    });

    it('kan niet verder vergroten dan is toegestaan', () => {
        const { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1, status: 'vpl', plaatsen: ['3', '4'], voorkeur: { maximum: 4 } },
                { sollicitatieNummer: 2, voorkeur: { maximum: 3 } }
            ],
            marktplaatsen: [{}, {}, {}, {}, {}, {}],
            voorkeuren: [
                { sollicitatieNummer: 1, plaatsId: '3', priority: FIRST_CHOICE },
                { sollicitatieNummer: 1, plaatsId: '4', priority: SECOND_CHOICE },
                { sollicitatieNummer: 1, plaatsId: '5', priority: THIRD_CHOICE },
                { sollicitatieNummer: 1, plaatsId: '6', priority: THIRD_CHOICE },
                { sollicitatieNummer: 2, plaatsId: '1', priority: FIRST_CHOICE },
                { sollicitatieNummer: 2, plaatsId: '2', priority: SECOND_CHOICE },
                { sollicitatieNummer: 2, plaatsId: '3', priority: THIRD_CHOICE }
            ],
            expansionLimit: 3
        });

        expect(toewijzingen.length).toBe(2);
        expect(findPlaatsen(toewijzingen, 1)).toStrictEqual(['3', '4', '5']);
        expect(findPlaatsen(toewijzingen, 2)).toStrictEqual(['1', '2']);
    });

    it('kan dat niet naar een zijde met een obstakel', () => {
        const { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1, voorkeur: { maximum: 2 } }
            ],
            marktplaatsen: [{}, {}],
            obstakels: [
                { kraamA: '1', kraamB: '2', obstakel: ['boom'] }
            ]
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([1]);
        expect(findOndernemers(afwijzingen)).toStrictEqual([]);
        expect(findPlaatsen(toewijzingen, 1)).toStrictEqual(['1']);
    });

    it('kan een minimum aantal gewenste plaatsen opgeven', () => {
        const { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1, voorkeur: { minimum: 2 } }
            ],
            marktplaatsen: [{}, {}]
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([1]);
        expect(findOndernemers(afwijzingen)).toStrictEqual([]);
        expect(findPlaatsen(toewijzingen, 1)).toStrictEqual(['1', '2']);
    });

    it('kan een maximum aantal gewenste plaatsen opgeven', () => {
        const { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1, voorkeur: { maximum: 2 } },
                { sollicitatieNummer: 2, status: 'vpl', plaatsen: ['3', '4'], voorkeur: { maximum: 3 } }
            ],
            marktplaatsen: [
                {}, {}, {}, {}, {}, {}
            ],
            voorkeuren: [
                { sollicitatieNummer: 2, plaatsId: '5' },
                { sollicitatieNummer: 2, plaatsId: '6' }
            ]
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([1, 2]);
        expect(findOndernemers(afwijzingen)).toStrictEqual([]);
        expect(findPlaatsen(toewijzingen, 1)).toStrictEqual(['1', '2']);
        expect(findPlaatsen(toewijzingen, 2)).toStrictEqual(['4', '5', '6']);
    });

    it('wordt afgewezen als niet aan zijn minimum gewenste plaatsen wordt voldaan', () => {
        var { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { status: 'vpl', plaatsen: ['1', '2'], voorkeur: { minimum: 2 } },
                { voorkeur: { minimum: 2 } }
            ],
            marktplaatsen: [
                {}, { inactive: true }, { inactive: true }
            ]
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([]);
        expect(findOndernemers(afwijzingen)).toStrictEqual([1, 2]);
    });

    it('kan dat niet indien het maximum aantal branche-plaatsen wordt overschreden', () => {
        const { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1, voorkeur: { maximum: 3, branches: ['branche-x'] } }
            ],
            marktplaatsen: [{}, {}, {}],
            branches: [{
                brancheId: 'branche-x',
                maximumPlaatsen: 2
            }]
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([1]);
        expect(findPlaatsen(toewijzingen, 1)).toStrictEqual(['1', '2']);
    });

    it('krijgt extra plaats(en) aan hun voorkeurszijde', () => {
        var { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1, status: 'vpl', plaatsen: ['2', '3'], voorkeur: { maximum: 3 } }
            ],
            marktplaatsen: [{}, {}, {}, {}],
            voorkeuren: [
                { sollicitatieNummer: 1, plaatsId: '1', priority: 2 },
                { sollicitatieNummer: 1, plaatsId: '4', priority: 1 }
            ]
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([1]);
        expect(findOndernemers(afwijzingen)).toStrictEqual([]);
        expect(findPlaatsen(toewijzingen, 1)).toStrictEqual(['1', '2', '3']);

        var { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1, voorkeur: { maximum: 2 } },
                { sollicitatieNummer: 2, voorkeur: { maximum: 2 } }
            ],
            marktplaatsen: [
                {}, {}, {}, {}, {}, {}
            ],
            voorkeuren: [
                { sollicitatieNummer: 1, plaatsId: '2', priority: FIRST_CHOICE },
                { sollicitatieNummer: 1, plaatsId: '3', priority: SECOND_CHOICE },
                { sollicitatieNummer: 2, plaatsId: '5', priority: FIRST_CHOICE },
                { sollicitatieNummer: 2, plaatsId: '4', priority: SECOND_CHOICE }
            ]
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([1, 2]);
        expect(findOndernemers(afwijzingen)).toStrictEqual([]);
        expect(findPlaatsen(toewijzingen, 1)).toStrictEqual(['2', '3']);
        expect(findPlaatsen(toewijzingen, 2)).toStrictEqual(['4', '5']);
    });

    it('kan dit in een cirkelvormige marktoptstelling', () => {
        const { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { voorkeur: { maximum: 3 } }
            ],
            marktplaatsen: [
                {}, {}, {}, {}
            ],
            voorkeuren: [
                { sollicitatieNummer: 1, plaatsId: '4', priority: FIRST_CHOICE },
                { sollicitatieNummer: 1, plaatsId: '1', priority: SECOND_CHOICE },
                { sollicitatieNummer: 1, plaatsId: '2', priority: THIRD_CHOICE }
            ],
            rows: [['1', '2', '3', '4', '1']]
        });

        expect(toewijzingen.length).toBe(1);
        expect(afwijzingen.length).toBe(0);
        expect(findPlaatsen(toewijzingen, 1)).toStrictEqual(['1', '2', '4']);
    });
});

describe('Minimaliseer het aantal afwijzingen', () => {
    it('bij concurrerende minimum voorkeuren', () => {
        var { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1, status: 'soll', voorkeur: { minimum: 2 } },
                { sollicitatieNummer: 2, status: 'soll', voorkeur: { minimum: 2 } },
                { sollicitatieNummer: 3, status: 'soll', voorkeur: { minimum: 2 } }
            ],
            marktplaatsen: [
                '1', '2', '3'
            ]
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([1]);
        expect(findOndernemers(afwijzingen)).toStrictEqual([2, 3]);
        expect(findPlaatsen(toewijzingen, 1)).toStrictEqual(['1', '2']);

        var { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1, voorkeur: { minimum: 3 } },
                { sollicitatieNummer: 2, voorkeur: { minimum: 2 } }
            ],
            marktplaatsen: [
                {}, {}, {}
            ],
            expansionLimit: 2
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([2]);
        expect(findOndernemers(afwijzingen)).toStrictEqual([1]);
        expect(findPlaatsen(toewijzingen, 2)).toStrictEqual(['2', '3']);
    });

    it('bij de 2de verplichte branche ondernemer als de 1ste wordt afgewezen', () => {
        const { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1, voorkeur: { branches: ['x'], minimum: 2 } },
                { sollicitatieNummer: 2, voorkeur: { branches: ['x'], maximum: 2 } }
            ],
            marktplaatsen: [
                { branches: ['x'] }, {}
            ],
            branches: [
                { brancheId: 'x', verplicht: true }
            ]
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([2]);
        expect(findOndernemers(afwijzingen)).toStrictEqual([1]);
        expect(findPlaatsen(toewijzingen, 2)).toStrictEqual(['1']);
    });
});

describe('Bugfix voor', () => {
    it('issue #508', () => {
        // VPLs zonder voorkeuren maar met `anywhere: true` werden op de eerste
        // willekeurige vrije plaatsen neergezet, ook al waren hun eigen plaatsen
        // beschikbaar.
        const { toewijzingen, afwijzingen } = calc({
            ondernemers : [
                { sollicitatieNummer : 1, status : 'vpl', plaatsen : ['4', '5', '6'], voorkeur : { anywhere : true } }
            ],
            marktplaatsen: [
                {}, {}, {},
                {}, {}, {}
            ]
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([1]);
        expect(findOndernemers(afwijzingen)).toStrictEqual([]);
        expect(findPlaatsen(toewijzingen, 1)).toStrictEqual(['4', '5', '6']);
    });

    it('issue #532', () => {
        // `Ondernemer.getStartSize`[1] gaf onterecht een waarde van 1 terug, waar een SOLL
        // had aangegeven minimaal 2 plaatsen te willen. In `Indeling.performExpansion`
        // werd dit minimum vervolgens wel gerespecteerd. Op dit punt was echter al bepaald
        // wat de meest geschikte plaats voor deze ondernemer was (o.b.v. voorkeuren). Dit kon
        // betekenen dat uitbreiden niet meer mogelijk was omdat aangelegen plaatsen niet
        // beschikbaar meer waren.
        //
        // [1] 2019-12-30: Methode verplaatst naar `Ondernemer.getMinimumSize`.
        const { toewijzingen, afwijzingen } = calc({
            ondernemers : [
                { sollicitatieNummer : 1, status : 'soll', voorkeur : { minimum: 2, maximum: 2, anywhere : true } }
            ],
            marktplaatsen: [
                {}, { inactive: true }, {}, {}
            ],
            voorkeuren: [
                { sollicitatieNummer: 1, plaatsId: '1', priority: 3 },
                { sollicitatieNummer: 1, plaatsId: '3', priority: 2 },
                { sollicitatieNummer: 1, plaatsId: '4', priority: 1 }
            ]
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([1]);
        expect(findOndernemers(afwijzingen)).toStrictEqual([]);
        expect(findPlaatsen(toewijzingen, 1)).toStrictEqual(['3', '4']);
    });

    it('issue #534', () => {
        // `Indeling._findBestGroup` vond een hogere prioriteit belangrijker dan een
        // zo groot mogelijk aantal plaatsen toekennen; dit leverde situaties op die
        // als oneerlijk werden ervaren.
        const { toewijzingen, afwijzingen } = calc({
            ondernemers : [
                { sollicitatieNummer : 1, status : 'soll', voorkeur : { minimum: 1, maximum: 2, anywhere : true } }
            ],
            marktplaatsen: [
                {}, { inactive: true }, {}, {},
                // Deze rij plaatsen is relevant om te controleren dat `_findBestGroup` niet
                // te gretig is met het vinden van zoveel mogelijk plaatsen. Er mogen dan
                // 3 vrije plaatsen zijn, de ondernemer wil er maar 2.
                { inactive: true }, {}, {}, {}
            ],
            voorkeuren: [
                { sollicitatieNummer: 1, plaatsId: '1', priority: 3 },
                { sollicitatieNummer: 1, plaatsId: '3', priority: 2 },
                { sollicitatieNummer: 1, plaatsId: '4', priority: 1 }
            ]
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([1]);
        expect(findOndernemers(afwijzingen)).toStrictEqual([]);
        expect(findPlaatsen(toewijzingen, 1)).toStrictEqual(['3', '4']);
    });

    it('issue #566', () => {
        // Oorspronkelijke bug
        // -------------------
        // In sommige gevallen staat een ondernemer twee keer in Mercato. In dat systeem staat deze
        // persoon met twee verschillende sollicitatieNummers geregistreerd: x.01 en x.02. Deze
        // toevoeging gaat in MakkelijkeMarkt echter verloren, waardoor de berekening twee identieke
        // ondernemers als input krijgt. De berekening behandeld dit als twee losse ondernemers, maar
        // voegt de toewijzingen van deze 'twee ondernemers' vervolgens wel samen, waardoor een
        // toewijzing kan ontstaan met 2 niet naast elkaar liggende plaatsen.
        const { toewijzingen, afwijzingen } = calc({
            ondernemers : [
                { erkenningsNummer: '123456789', sollicitatieNummer : 1, status : 'soll' },
                { erkenningsNummer: '123456789', sollicitatieNummer : 1, status : 'soll' }
            ],
            marktplaatsen: [
                {}, {}
            ]
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([1]);
        expect(findPlaatsen(toewijzingen, 1)).toStrictEqual(['1']);
    });

    it('issue #619', () => {
        // Bij twee VPLs die willen verplaatsen kan het voorkomen dat degene met een hogere
        // anciënniteit een plaats van de ander inneemt, die vervolgens slechter af is dan
        // zijn oorspronkelijke situatie zonder te verplaatsen.
        const { toewijzingen, afwijzingen } = calc({
            ondernemers : [
                { sollicitatieNummer : 1, status : 'vpl', plaatsen: ['5', '6'] },
                { sollicitatieNummer : 2, status : 'vpl', plaatsen: ['2', '3'] }
            ],
            marktplaatsen: [
                '1', '2', '3', '4',
                '5', '6'
            ],
            voorkeuren: [
                { sollicitatieNummer: 1, plaatsId: '1', priority: FIRST_CHOICE },
                { sollicitatieNummer: 2, plaatsId: '1', priority: FIRST_CHOICE },
                { sollicitatieNummer: 2, plaatsId: '2', priority: SECOND_CHOICE }
            ]
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([1, 2]);
        expect(findPlaatsen(toewijzingen, 1)).toStrictEqual(['5', '6']);
        expect(findPlaatsen(toewijzingen, 2)).toStrictEqual(['1', '2']);
    });

    it('issue #709', () => {
        const { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1, status: 'vpl', plaatsen: ['1', '2'] },
                { sollicitatieNummer: 2, status: 'vpl', plaatsen: ['3', '4'] },
                { sollicitatieNummer: 3, status: 'soll' },
            ],
            marktplaatsen: [
                '1', '2', '3', '4'
            ],
            rows: [
                ['1'], ['2', '3'], ['4']
            ]
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([3]);
        expect(findOndernemers(afwijzingen)).toStrictEqual([1, 2]);
        expect(findPlaatsen(toewijzingen, 3)).toStrictEqual(['1']);
    });

    it('issue #815', () => {
        var { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1, status: 'soll', voorkeur: { minimum: 2 } },
                { sollicitatieNummer: 2, status: 'soll', voorkeur: { minimum: 1, maximum: 2 } },
                { sollicitatieNummer: 3, status: 'soll', voorkeur: { minimum: 1, maximum: 2 } },
                { sollicitatieNummer: 4, status: 'soll', voorkeur: { minimum: 1, maximum: 2 } }
            ],
            marktplaatsen: [
                '1', '2', '3'
            ]
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([2, 3, 4]);
        expect(findOndernemers(afwijzingen)).toStrictEqual([1]);
        expect(findPlaatsen(toewijzingen, 2)).toStrictEqual(['1']);
        expect(findPlaatsen(toewijzingen, 3)).toStrictEqual(['2']);
        expect(findPlaatsen(toewijzingen, 4)).toStrictEqual(['3']);

        var { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1, status: 'soll', voorkeur: { minimum: 2 } },
                { sollicitatieNummer: 2, status: 'soll', voorkeur: { minimum: 1, maximum: 2 } },
                { sollicitatieNummer: 3, status: 'soll', voorkeur: { minimum: 2 } }
            ],
            marktplaatsen: [
                '1', '2', '3'
            ]
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([1, 2]);
        expect(findOndernemers(afwijzingen)).toStrictEqual([3]);
        expect(findPlaatsen(toewijzingen, 1)).toStrictEqual(['2', '3']);
        expect(findPlaatsen(toewijzingen, 2)).toStrictEqual(['1']);

        var { toewijzingen, afwijzingen } = calc({
            ondernemers: [
                { sollicitatieNummer: 1, status: 'soll', voorkeur: { minimum: 2 } },
                { sollicitatieNummer: 2, status: 'soll', voorkeur: { minimum: 1, maximum: 2 } },
                { sollicitatieNummer: 3, status: 'soll', voorkeur: { minimum: 2 } }
            ],
            marktplaatsen: [
                '1', '2', '3'
            ],
            voorkeuren: [
                { sollicitatieNummer: 1, plaatsId: '1', priority: FIRST_CHOICE }
            ]
        });

        expect(findOndernemers(toewijzingen)).toStrictEqual([1, 2]);
        expect(findOndernemers(afwijzingen)).toStrictEqual([3]);
        expect(findPlaatsen(toewijzingen, 1)).toStrictEqual(['1', '2']);
        expect(findPlaatsen(toewijzingen, 2)).toStrictEqual(['3']);
    });
});
