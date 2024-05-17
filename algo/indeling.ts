import {
    BrancheId,
    IMarkt,
    IMarktindeling,
    IMarktindelingSeed,
    IMarktondernemer,
    IMarktplaats,
    IPlaatsvoorkeur,
    IRSVP,
    IToewijzing,
} from '../models/markt';

import {
    compareProperty,
    intersection,
    intersects,
} from '../util';

import Markt from './markt';
import Ondernemer from './ondernemer';
import Ondernemers from './ondernemers';
import Afwijzing from './afwijzing';
import Toewijzing from './toewijzing';

// Wordt gebruikt in `_findBestePlaatsen` om `IMarktplaats` object om te vormen
// tot `IPlaatsvoorkeur` objecten met een berekend `brancheIntersectCount` getal.
//
// Hierdoor kunnen `priority` en `brancheIntersectCount` gebruikt worden om in
// `_findBestGroup` de meest geschikte set plaatsen te vinden.
interface IPlaatsvoorkeurPlus extends IPlaatsvoorkeur {
    brancheScore: number;
    eviScore: number;
    voorkeurScore: number;
    afstandScore: number;
}

enum Strategy {
    OPTIMISTIC = 1,
    CONSERVATIVE = 0
}

const Indeling = {
    init: (markt: IMarkt & IMarktindelingSeed): IMarktindeling => {
        const marktDate = new Date(markt.marktDate);
        if (!+marktDate) {
            throw Error('Invalid market date');
        }

        const openPlaatsen   = markt.marktplaatsen.filter(plaats => !plaats.inactive);
        const expansionLimit = Number.isFinite(markt.expansionLimit) ?
                               markt.expansionLimit :
                               markt.marktplaatsen.length;

        // Indien een branche verplicht is, kunnen we `maximumPlaatsen` berekenen
        // door het aantal gebrancheerde plaatsen in deze markt te tellen. Dit
        // elimineert mogelijke menselijke fouten tijdens de invoer van de markt.
        const branches = markt.branches.map(branche => {
            if( !branche.verplicht ) {
                return branche;
            }

            const maximumPlaatsen = openPlaatsen.reduce((count, plaats) => {
                return plaats.branches && plaats.branches.includes(branche.brancheId) ?
                       count + 1 :
                       count;
            }, 0);

            return {
                ...branche,
                maximumPlaatsen
            };
        });

        const indeling = <IMarktindeling> {
            ...markt,
            branches,
            openPlaatsen,
            expansionLimit,

            voorkeuren      : [],
            afwijzingen     : [],
            toewijzingen    : []
        };

        // De sortering van ondernemers vindt plaats nadat `indeling.voorkeuren` is gevuld
        // (onderaan `Indeling.init`).
        indeling.ondernemers = markt.ondernemers.reduce((result, ondernemer) => {
            // We willen enkel de aanwezige ondernemers, zonder dubbelingen (miscommunicatie
            // tussen Mercato en Makkelijke Markt), dus dubbelingen moeten eruit
            // gefilterd worden.
            if (
                !Indeling.isAanwezig(ondernemer, markt.aanwezigheid, marktDate) ||
                result.find(({ erkenningsNummer, sollicitatieNummer }) =>
                    erkenningsNummer === ondernemer.erkenningsNummer ||
                    sollicitatieNummer === ondernemer.sollicitatieNummer
                )
            ) {
                return result;
            }

            // Tijdelijke vasteplaatshouders zonder plaatsnummer hebben in de input toch
            // plaatsnummers vanwege beperkingen in Makkelijke Markt of Mercato. Deze
            // plaatsnummers moet weggehaald worden, maar het aantal plaatsen moet behouden
            // blijven. Aangezien dit type ondernemer niet mag uitbreiden, kunnen we de
            // voorkeuren hiervoor overschrijven.
            if (Ondernemer.isTVPLZ(ondernemer)) {
                const erkenningsNummer = ondernemer.erkenningsNummer;
                const minimum = ondernemer.plaatsen ? ondernemer.plaatsen.length : 1;
                const voorkeur = (ondernemer.voorkeur || { erkenningsNummer });

                ondernemer = {
                    ...ondernemer,
                    voorkeur: {
                        ...voorkeur,
                        maximum: Math.max(voorkeur.maximum || 0, minimum),
                        minimum
                    },
                    plaatsen: []
                };
            }

            return result.concat(ondernemer);
        }, []);

        // De ondernemer objecten in de `indeling.aLijst` properties zijn exacte kopieën van
        // de ondernemer objecten in `indeling.ondernemers`. Daar maken we hier references van,
        // zodat we in de rest van de code simpelweg `aLijst.includes(ondernemerObj)` kunnen
        // doen om te controleren of een ondernemer op de aLijst staat.
        indeling.aLijst = indeling.aLijst.reduce((result, ondernemer) => {
            const ondernemerOrig = indeling.ondernemers.find(({ erkenningsNummer }) =>
                erkenningsNummer === ondernemer.erkenningsNummer
            );
            return ondernemerOrig ?
                   result.concat(ondernemerOrig) :
                   result;
        }, []);

        // Verwijder voorkeuren van ondernemers die niet aanwezig zijn, omdat deze voorkeuren
        // worden gebruikt om te
        const index = indeling.ondernemers.reduce((result, ondernemer) => {
            return result.set(ondernemer.erkenningsNummer, true);
        }, new Map());
        indeling.voorkeuren = markt.voorkeuren.filter(({ erkenningsNummer }) =>
            index.has(erkenningsNummer)
        );

        // Deze sortering kan pas plaatsvinden nadat `indeling.voorkeuren` gevuld is, omdat
        // `_compareOndernemers` gebruikt maakt van deze array. De sortering is van groot
        // belang voor de gehele indeling..
        indeling.ondernemers.sort((a, b) =>
            Indeling._compareOndernemers(indeling, a, b)
        );

        return indeling;
    },

    // `contenders` en `queue` worden doorgegeven om o.a. goeie beslissingen te kunnen nemen
    // over de grootte van het aantal plaatsen waar deze ondernemer mee mag starten, en welke
    // plaatsen het meest geschikt zijn.
    //
    // Zie `performCalculation` voor uitleg over de betekenis van deze twee parameters.
    allocateOndernemer: (
        indeling: IMarktindeling,
        contenders: IMarktondernemer[],
        queue: IMarktondernemer[],
        ondernemer: IMarktondernemer,
        openPlaatsen: IMarktplaats[] = indeling.openPlaatsen,
        size?: number
    ): IMarktindeling => {
        try {
            size = size ?
                   Math.min(size, Ondernemer.getTargetSize(ondernemer)) :
                   Indeling._calculateStartSizeFor(indeling, contenders, ondernemer);

            if (!indeling.openPlaatsen.length) {
                throw Afwijzing.MARKET_FULL;
            } else if (!size && Indeling._countAvailablePlaatsenFor(indeling, ondernemer)) {
                throw Afwijzing.BRANCHE_FULL;
            }


            const anywhere      = Ondernemer.acceptsRandomAllocation(ondernemer);
            const bestePlaatsen = Indeling._findBestePlaatsen(
                indeling, contenders, ondernemer, openPlaatsen, size, anywhere
            );

            if (!bestePlaatsen.length) {
                throw Afwijzing.ADJACENT_UNAVAILABLE;
            }

            // Deel deze ondernemer op hun meest gewilde locatie in. De resulterende
            // indeling slaan we in een andere variabele op, zodat we hem nog ongedaan
            // kunnen maken als de toewijzing een probleem oplevert. Zie hieronder.
            const _indeling = bestePlaatsen.reduce((result, plaats) => {
                return Toewijzing.add(result, ondernemer, plaats);
            }, indeling);

            if (
                !Ondernemer.hasVastePlaatsen(ondernemer) &&
                !Indeling.willMove(indeling, ondernemer)
            ) {
                return _indeling;
            }

            // Dit is een VPH die wil verplaatsen. Kijk of de huidige toewijzing geen
            // situatie oplevert waarbij een andere verplaatsende VPH wordt afgewezen:
            // een scenario dat niet mag optreden.
            //
            // Check of deze ondernemer nu op vaste plaatsen van een andere VPH staat.
            // Is dit niet het geval, dan is er niks aan de hand.
            const affectedVPH = bestePlaatsen
            .map(plaats => Ondernemers.findVPHFor(_indeling, plaats.plaatsId))
            .filter(vph => vph && vph.sollicitatieNummer !== ondernemer.sollicitatieNummer);

            if (!affectedVPH.length) {
                return _indeling;
            }

            // Deze ondernemer neemt een of meerdere plaatsen in van andere VPHs. We
            // simuleren nu de verdere indeling van de VPHs om te zien of de relevante
            // VPHs nu worden afgewezen. Als dit het geval is, dan is de huidige toewijzing
            // niet geschikt.
            //
            // Deze simulatie slaan we weer in een andere variabele op. Het kan namelijk zijn
            // dat er in deze simulatie VPHs succesvol worden toegewezen. Zouden we `_indeling`
            // gebruiken en zijn er geen problemen, dan wordt er verder gerekend met deze
            // indeling. Het resultaat is vervolgens dat er VPHs voor hun beurt zijn ingedeeld.
            //
            // Enkel de huidige ondernemer mag in deze run ingedeeld worden. In
            // `Indeling.performAllocation` wordt de juiste volgorde van indeling bepaald.
            //
            // TODO: `Indeling.performAllocation` hoeft in dit geval enkel VPHs die willen
            //       verplaatsen mee te nemen in de berekening. Deze optimalisatie toevoegen?
            const _contenders = Ondernemers.without(contenders, ondernemer);
            const _indeling2 = Indeling.performAllocation(
                _indeling, _contenders, queue.slice(1)
            );
            const rejections = affectedVPH.reduce((result, ondernemer) => {
                const rejection = Afwijzing.find(_indeling2, ondernemer);
                return rejection ? result.concat(rejection) : result;
            }, []);

            if (!rejections.length) {
                return _indeling;
            }

            // De huidige toewijzing levert afgewezen VPHs op. We maken de toewijzing ongedaan
            // door de oorspronkelijke indeling weer te gebruiken (die van voor de toewijzing).
            // Vervolgens maken we de plaatsen uit de huidige toewijzing ontoegankelijk (m.u.v.
            // hun eigen plaatsen als die er tussen zitten), en proberen de ondernemer opnieuw
            // in te delen. Worst case scenario hier is dat deze ondernemer uiteindelijk op
            // zijn eigen plaatsen terecht komt.
            const offending = bestePlaatsen
                              .filter(plaats => !Ondernemer.hasVastePlaats(ondernemer, plaats))
                              .map(plaats => plaats.plaatsId);
            openPlaatsen = openPlaatsen.filter(plaats => !offending.includes(plaats.plaatsId));
            return Indeling.allocateOndernemer(indeling, contenders, queue, ondernemer, openPlaatsen);
        } catch (errorMessage) {
            return Afwijzing.add(indeling, ondernemer, errorMessage);
        }
    },

    // `anywhere` wordt als argument meegegeven i.p.v. uit de ondernemers-
    // voorkeuren gehaald, omdat deze functie ook gebruikt wordt in
    // `_findBestGroup` om een set voorkeuren uit te breiden naar het
    // gewenste aantal plaatsen. Voor deze uitbreiding staat `anywhere` altijd
    // op true omdat de gewenste plaatsen al bemachtigd zijn, maar het er nog niet
    // genoeg zijn om de minimum wens te verzadigen.
    canBeAssignedTo: (
        indeling: IMarktindeling,
        ondernemer: IMarktondernemer,
        openPlaatsen: IMarktplaats[],
        plaats: IMarktplaats,
        anywhere: boolean
    ): boolean => {
        const voorkeuren           = Ondernemer.getPlaatsVoorkeuren(indeling, ondernemer);
        const voorkeurIds          = voorkeuren.map(({ plaatsId }) => plaatsId);
        const ondernemerBranches   = Ondernemer.getBranches(ondernemer, indeling);
        const verplichteBrancheIds = ondernemerBranches
                                    .filter(({ verplicht = false }) => verplicht)
                                    .map(({ brancheId }) => brancheId);

        return (
            // TODO: Deze 2 checks hebben overlap. Refactoren?
            Indeling._isAvailable(indeling, plaats, ondernemer) &&
            !!openPlaatsen.find(({ plaatsId }) => plaats.plaatsId === plaatsId) && (
                // Als de plaats is toegekend zijn verdere controles onnodig.
                Ondernemer.hasVastePlaats(ondernemer, plaats) || !(
                    // Ondernemer is in verplichte branche, maar plaats voldoet daar niet aan.
                    verplichteBrancheIds.length && !intersects(verplichteBrancheIds, plaats.branches) ||
                    // Ondernemer heeft een EVI, maar de plaats is hier niet geschikt voor.
                    Ondernemer.hasEVI(ondernemer) && !Markt.hasEVI(plaats) ||
                    // Ondernemer wil niet willekeurig ingedeeld worden en plaats is geen voorkeur.
                    !anywhere && !voorkeurIds.includes(plaats.plaatsId)
                )
            )
        );
    },

    isAanwezig: (
        ondernemer: IMarktondernemer,
        aanmeldingen: IRSVP[],
        marktDate: Date
    ) => {
        const { absentFrom = null, absentUntil = null } = ondernemer.voorkeur || {};
        if (
            absentFrom && absentUntil &&
            marktDate >= new Date(absentFrom) &&
            marktDate <= new Date(absentUntil)
        ) {
            return false;
        }

        const rsvp = aanmeldingen.find(({ erkenningsNummer }) =>
            erkenningsNummer === ondernemer.erkenningsNummer
        );
        // • VPL en TVPL worden automatisch aangemeld, tenzij ze zich expliciet afgemeld hebben.
        // • TVPLZ moet zich expliciet aanmelden. Aangezien zij geen vaste plaatsnummers hebben
        //   volstaat een check op `hasVastePlaatsen` hier.
        return Ondernemer.isVast(ondernemer) && Ondernemer.hasVastePlaatsen(ondernemer) ?
               !rsvp || !!rsvp.attending || rsvp.attending === null :
               !!rsvp && !!rsvp.attending;
    },

    // Probeert de ondernemers in `queue` in te delen op de markt.
    //
    // Dit is de methode waar de concepten `queue` en `contenders` voor het eerst
    // opduiken. De ondernemers in `queue` zijn degenen die momenteel daadwerkelijk
    // op de markt ingedeeld moeten worden.
    //
    // In `contenders` zitten ook alle `queue` ondernemers, plus degenen die nog niet
    // aan de beurt zijn. Hun data is echter wel van invloed op hoe de ondernemers in
    // `queue` ingedeeld moeten worden. Het is dus van belang dat beide lijsten meegegeven
    // worden in alle methodes die bepalen wie waar terecht komt.
    performCalculation: (
        indeling: IMarktindeling,
        queue: IMarktondernemer[]
    ): IMarktindeling => {
        const immediateQueue = queue.reduce((result, ondernemer) => {
            if (
                !Ondernemer.isVast(ondernemer) &&
                Indeling._calculateAllocationStrategy(indeling, queue, ondernemer) === Strategy.CONSERVATIVE &&
                Ondernemer.getMinimumSize(ondernemer) > 1
            ) {
                return result;
            }

            return result.concat(ondernemer);
        }, []);

        indeling = Indeling.performAllocation(indeling, queue, immediateQueue);

        for (let iteration = 2; iteration <= indeling.expansionLimit; iteration++) {
            const contenders = queue.reduce((result, ondernemer) => {
                const toewijzing = Toewijzing.find(indeling, ondernemer);
                return !toewijzing || Ondernemer.wantsExpansion(toewijzing) ?
                       result.concat(ondernemer) :
                       result;
            } , []);

            indeling = Indeling.performExpansion(indeling, iteration, contenders);

            if (!indeling.openPlaatsen.length || !contenders.length) {
                break;
            }
        }

        return indeling;
    },

    // - VPHs met meer dan 1 plaats krijgen deze toegewezen.
    // - VPHs met 1 plaats en sollicitanten krijgen maximaal 2 plaatsen (afhankelijk van hun
    //   voorkeuren, en de hoeveelheid beschikbare ruimte op de markt).
    //
    // Voor de prioritering van indelen, zie `Indeling._compareOndernemers` die in
    // `Indeling.init` wordt gebruikt om alle aanwezige ondernemers te sorteren.
    performAllocation: (
        indeling: IMarktindeling,
        contenders: IMarktondernemer[],
        queue: IMarktondernemer[]
    ): IMarktindeling => {
        return queue.reduce((_indeling, ondernemer, i) => {
            const remainingQueue = queue.slice(i);
            _indeling = Indeling.allocateOndernemer(_indeling, contenders, remainingQueue, ondernemer);
            contenders = Ondernemers.without(contenders, ondernemer);

            return _indeling;
        }, indeling);
    },

    // Uitbreiden gaat in iteraties: iedereen die een 2de plaats wil krijgt deze
    // aangeboden alvorens iedereen die een 3de plaats wil hiertoe de kans krijgt, enz.
    performExpansion: (
        indeling: IMarktindeling,
        iteration: number = 2,
        queue: IMarktondernemer[]
    ): IMarktindeling => {
        // TODO: Mutatie van `contenders` maakt geen verschil in de test suite.
        let contenders = queue.slice(0);

        for (let ondernemer, i=0; ondernemer = queue[i]; i++) {
            const toewijzing = Toewijzing.find(indeling, ondernemer);

            if (toewijzing) {
                const uitbreidingPlaats = Indeling._findBestExpansion(indeling, contenders, toewijzing);

                // Nog voordat we controleren of deze ondernemer in deze iteratie eigenlijk wel kan
                // uitbreiden (zie `canExpandInIteration` in de `else`) bekijken we of er wel een
                // geschikte plaats is. Is dit niet het geval, en heeft de ondernemer een `minimum`,
                // dan kunnen we ze al afwijzen nog voordat ze überhaupt aan de beurt zijn. Dit levert
                // ruimte op voor andere ondernemers.
                if (!uitbreidingPlaats) {
                    contenders = Ondernemers.without(contenders, ondernemer);

                    const { plaatsen } = toewijzing;
                    const minimum      = Ondernemer.getMinimumSize(ondernemer);

                    if (minimum > plaatsen.length) {
                        indeling = Afwijzing.add(indeling, ondernemer, Afwijzing.MINIMUM_UNAVAILABLE);
                    }
                } else if (Ondernemer.canExpandInIteration(indeling, iteration, toewijzing)) {
                    contenders = Ondernemers.without(contenders, ondernemer);
                    indeling = Toewijzing.add(indeling, ondernemer, uitbreidingPlaats);
                }
            } else if (Ondernemer.getMinimumSize(ondernemer) === iteration) {
                contenders = Ondernemers.without(contenders, ondernemer);
                indeling = Indeling.allocateOndernemer(
                    indeling, contenders, contenders, ondernemer, undefined, iteration
                );
            }
        }

        return indeling;
    },

    // Als een VPH voorkeuren heeft opgegeven, dan geven zij daarmee aan dat ze
    // willen verplaatsen. We beschouwen een VPH eveneens als een verplaatser
    // als niet al hun vaste plaatsen beschikbaar zijn.
    willMove: (
        indeling: IMarktindeling,
        ondernemer: IMarktondernemer
    ): boolean => {
        // Sollicitanten met een tijdelijke vaste plaats mogen niet verplaatsen.
        // Zie ook `Ondernemer.getPlaatsVoorkeuren`.
        if (Ondernemer.isExperimenteel(ondernemer)) {
            return false;
        }

        const vastePlaatsen = Ondernemer.getVastePlaatsen(indeling, ondernemer);
        const beschikbaar = vastePlaatsen.filter(plaats => Indeling._isAvailable(indeling, plaats, ondernemer));
        const voorkeuren = Ondernemer.getPlaatsVoorkeuren(indeling, ondernemer, false);

        return beschikbaar.length < vastePlaatsen.length || !!voorkeuren.length;
    },

    _calculateAllocationStrategy: (
        indeling: IMarktindeling,
        contenders: IMarktondernemer[],
        ondernemer: IMarktondernemer
    ): Strategy => {
        // Check deze ondernemer niet in een gelimiteerde branche zit. Het kan namelijk
        // zijn dat er voor die specifieke branche conservatief ingedeeld moet
        // worden terwijl de rest van de markt optimistisch ingedeeld kan worden.
        const limitedBranche = Ondernemer.getMostLimitedBranche(ondernemer, indeling);
        const filteredContenders = limitedBranche ?
                                   Ondernemers.filterByBranche(contenders, limitedBranche) :
                                   contenders;

        const minRequired = filteredContenders.reduce((sum, ondernemer) => {
            return sum + Ondernemer.getStartSize(ondernemer);
        }, 0);
        const available = Indeling._countAvailablePlaatsenFor(indeling, ondernemer);

        return available > minRequired ?
               Strategy.OPTIMISTIC :
               Strategy.CONSERVATIVE;
    },

    _calculateStartSizeFor: (
        indeling: IMarktindeling,
        contenders: IMarktondernemer[],
        ondernemer: IMarktondernemer
    ): number => {
        if (!indeling.openPlaatsen.length) {
            return 0;
        }

        const available      = Indeling._countAvailablePlaatsenFor(indeling, ondernemer);
        const startSize      = Ondernemer.getStartSize(ondernemer);
        const targetSize     = Ondernemer.getTargetSize(ondernemer);
        const happySize      = startSize === 1 ? Math.min(targetSize, 2) : startSize;

        const strategy    = Indeling._calculateAllocationStrategy(indeling, contenders, ondernemer);
        const size        = strategy === Strategy.OPTIMISTIC ? happySize : startSize;

        return Ondernemer.isVast(ondernemer) ?
               size :
               Math.min(available, size);
    },

    _compareOndernemers: (
        indeling: IMarktindeling,
        a: IMarktondernemer,
        b: IMarktondernemer
    ): number => {
        const sort1 = Indeling._getSortingScore(indeling, a) -
                      Indeling._getSortingScore(indeling, b);
        const sort2 = a.sollicitatieNummer - b.sollicitatieNummer;

        return sort1 || sort2;
    },

    // Tel het totaal aantal nog beschikbare plaatsen op de markt voor deze ondernemer.
    // Als zij in een (of meerdere) gelimiteerde branche(s) zitten, wordt de telling
    // beperkt tot deze 'markt in markt'.
    //
    // Deze methode er geen rekening mee of geschikte plaatsen aansluiten op reeds
    // toegewezen plaatsen. `_findBestePlaatsen` bepaald uiteindelijk of een ondernemer
    // nog een plaats toegewezen kan krijgen.
    _countAvailablePlaatsenFor: (
        indeling: IMarktindeling,
        ondernemer: IMarktondernemer
    ): number => {
        const branches  = Ondernemer.getBranches(ondernemer, indeling);
        const available = indeling.openPlaatsen.length;

        return branches.reduce((finalCount, branche) => {
            const { maximumPlaatsen } = branche;

            if (!finalCount || !maximumPlaatsen) {
                return finalCount;
            }

            const branchePlaatsen = indeling.toewijzingen.reduce((brancheCount, toewijzing) => {
                return Ondernemer.isInBranche(toewijzing.ondernemer, branche) ?
                       brancheCount + toewijzing.plaatsen.length :
                       brancheCount;
            }, 0);

            return Math.min(
                Math.max(0, maximumPlaatsen - branchePlaatsen),
                finalCount
            );
        }, available);
    },

    _findBestGroup: (
        indeling: IMarktindeling,
        ondernemer: IMarktondernemer,
        openPlaatsen: IMarktplaats[],
        groups: IPlaatsvoorkeur[][],
        size: number = 1,
        compare?: (best: IPlaatsvoorkeur[], current: IPlaatsvoorkeur[]) => number
    ): IMarktplaats[] => {
        const minSize = Math.min(size, Ondernemer.getMinimumSize(ondernemer));

        return groups.reduce((result, group) => {
            if (group.length < size) {
                const depth     = size - group.length;
                const plaatsIds = group.map(({ plaatsId }) => plaatsId);
                const extra     = Markt.getAdjacentPlaatsen(indeling, plaatsIds, depth, plaats =>
                    Indeling.canBeAssignedTo(indeling, ondernemer, openPlaatsen, plaats, true)
                );
                group = group.concat(<IPlaatsvoorkeur[]> extra);
                // Zet de zojuist toegevoegde plaatsen op de juiste plek.
                group = Markt.groupByAdjacent(indeling, group)[0];
            }

            if (
                group.length >= minSize &&
                // Zolang we het maximaal aantal gewenste plaatsen nog niet hebben bereikt
                // blijven we doorzoeken.
                Math.min(size, group.length) > result.length
            ) {
                // Reduceer het aantal plaatsen tot `size`.
                // Pak de subset met de hoogste totale prioriteit.
                return group.reduce((best, plaats, index) => {
                    const current = group.slice(index, index+size);
                    return (!best.length || compare(current, best) < 0) ?
                           current :
                           best;
                }, []);
            } else {
                return result;
            }
        }, []);
    },

    _findBestePlaatsen: (
        indeling: IMarktindeling,
        contenders: IMarktondernemer[],
        ondernemer: IMarktondernemer,
        openPlaatsen: IMarktplaats[],
        size: number = 1,
        anywhere: boolean = false
    ): IMarktplaats[] => {
        const voorkeuren           = Ondernemer.getPlaatsVoorkeuren(indeling, ondernemer);
        const ondernemerBrancheIds = Ondernemer.getBrancheIds(ondernemer);
        const ondernemerEVI        = Ondernemer.hasEVI(ondernemer);
        // Deze twee worden gebruikt om te bepalen of we een `brancheScore` en/of `eviScore`
        // moeten uitrekenen voor deze plaats.
        const relevantBranches     = Ondernemers.getRelevantBranches(indeling, contenders);
        const eviCount             = Ondernemers.countEVIs(indeling, contenders);

        // 1. Converteer geschikte plaatsen naar IPlaatsvoorkeur (zodat elke optie
        //    een `priority` heeft).
        // 2. Sorteer op branche overlap en `priority`.
        const openPlaatsenPrio = <IPlaatsvoorkeurPlus[]> openPlaatsen
        .map(plaats => {
            const voorkeur = voorkeuren.find(({ plaatsId }) => plaatsId === plaats.plaatsId);

            // De vaste plaatsen hebben een `priority` van 0, maar moeten wel boven gewone plaatsen
            // komen in de sortering. Een priority -1 verstoort de sortering, dus doen we `+1`
            // voor alle voorkeursplaatsen, maken we de vaste plaatsen `1`, en krijgen gewone
            // plaatsen priority `0`.
            const priority = voorkeur ? voorkeur.priority+1 || 1 : 0;

            // De branche score vertegenwoordigd een ranking in manier van overlap in
            // ondernemers branches vs. plaats branches:
            // 0. Geen overlap, maar plaats heeft wel branches
            // 1. Geen overlap
            // 2. Gedeeltelijke overlap:          ondernemer['x']      vs plaats['x', 'y']
            // 3. Gedeeltelijk de andere kant op: ondernemer['x', 'y'] vs plaats['x']
            // 4. Volledige overlap:              ondernemer['x', 'y'] vs plaats['x', 'y']
            const branches               = intersection(plaats.branches || [], relevantBranches);
            const plaatsBrancheCount     = branches.length;
            const ondernemerBrancheCount = ondernemerBrancheIds.length;
            const intersectCount         = intersection(branches, ondernemerBrancheIds).length;
            const brancheScore           = !intersectCount && plaatsBrancheCount       ? 0 :
                                           !intersectCount                             ? 1 :
                                           intersectCount < plaatsBrancheCount         ? 2 :
                                           ondernemerBrancheCount > plaatsBrancheCount ? 3 :
                                                                                         4;

            // Voor de EVI score geldt, hoe hoger de score, hoe beter de match:
            // 0. Er zijn geen EVI ondernemers meer die ingedeeld moeten worden, of de plaats heeft
            //    een EVI maar de ondernemer niet. De ondernemer met een EVI maar de plaats zonder
            //    kan niet voorkomen: deze plaatsen komen niet door `Indeling.canBeAssignedTo`.
            // 1. Ondernemer + plaats is een match. Beide geen EVI, of beide wel.
            const plaatsEVI  = Markt.hasEVI(plaats);
            const eviCompare = Number(ondernemerEVI) - Number(plaatsEVI);
            const eviScore   = !eviCount || eviCompare ? 0 : 1;

            // De voorkeurscore betekent: hoe meer ondernemers deze plaats als voorkeur hebben
            // opgegeven, hoe hoger de score. Dit getal wordt gebruikt voor ondernemers die flexibel
            // ingedeeld willen worden. We proberen deze ondernemers op een plaats te zetten waar
            // geen of zo min mogelijk ondernemers een voorkeur voor hebben uitgesproken.
            const voorkeurScore = Ondernemers.countPlaatsVoorkeurenFor(indeling, plaats.plaatsId);

            // Als deze score relevant is, betekent dit dat het deze ondernemer niet uitmaakt waar
            // zij ingedeeld worden.
            //
            // Met de afstandscore proberen we deze ondernemer zo ver mogelijk weg te houden
            // van plaatsen waar andere ondernemers een voorkeur voor hebben uitgesproken. Op deze
            // manier is de kans het grootst dat deze ondernemer niet in de weg staat als deze andere
            // ondernemers nog willen uitbreiden.
            const afstanden = Markt.getAdjacent(indeling, plaats.plaatsId).map(plaatsen => {
                for (let plaats, i=0; plaats = plaatsen[i]; i++) {
                    if (Ondernemers.countPlaatsVoorkeurenFor(indeling, plaats.plaatsId)) {
                        return i;
                    }
                }
                return Infinity;
            });
            const afstandScore = Math.min.apply(null, afstanden);

            return {
                ...plaats,
                priority,
                brancheScore,
                eviScore,
                voorkeurScore,
                afstandScore
            };
        })
        .sort((a, b) =>
            b.priority - a.priority ||
            b.brancheScore - a.brancheScore ||
            b.eviScore - a.eviScore ||
            a.voorkeurScore - b.voorkeurScore ||
            b.afstandScore - a.afstandScore
        );
        // 3. Maak groepen van de plaatsen waar deze ondernemer kan staan (Zie `plaatsFilter`)
        const groups = Markt.groupByAdjacent(indeling, openPlaatsenPrio, plaats =>
            Indeling.canBeAssignedTo(indeling, ondernemer, openPlaatsenPrio, plaats, anywhere)
        );
        // 4. Geef de meest geschikte groep terug.
        return Indeling._findBestGroup(
            indeling,
            ondernemer,
            openPlaatsenPrio,
            groups,
            size,
            (a: IPlaatsvoorkeurPlus[], b: IPlaatsvoorkeurPlus[]) =>
                compareProperty(b, a, 'brancheScore') ||
                compareProperty(b, a, 'eviScore') ||
                compareProperty(b, a, 'priority') ||
                compareProperty(a, b, 'voorkeurScore') ||
                compareProperty(b, a, 'afstandScore')
        );
    },

    _findBestExpansion: (
        indeling: IMarktindeling,
        contenders: IMarktondernemer[],
        toewijzing: IToewijzing
    ): IMarktplaats => {
        const { ondernemer, plaatsen } = toewijzing;
        const available = Indeling._countAvailablePlaatsenFor(indeling, ondernemer);

        if (!available) {
            return null;
        }

        return Indeling._findBestePlaatsen(
            indeling, contenders, ondernemer,
            Markt.getAdjacentPlaatsen(indeling, plaatsen, 1),
            1, true
        )[0] || null;
    },

    // Bepaalt samen met `_compareOndernemers` de volgorde van indeling:
    // 0.  VPHs die niet willen verplaatsen.
    // 1.  VPH die wil verplaatsen in verplichte branche.
    // 2.  Sollicitant in verplichte branche.
    // 4.  VPH die wil verplaatsen met een EVI.
    // 8.  Sollicitant met een EVI.
    // 16. Alle andere VPHs die willen/moeten verplaatsen.
    // 32. Sollicitanten.
    _getSortingScore: (
        indeling: IMarktindeling,
        ondernemer: IMarktondernemer
    ): number => {
        const group = Ondernemer.hasVastePlaatsen(ondernemer) &&
                      !Indeling.willMove(indeling, ondernemer)              ? 0 :
                      Ondernemer.hasVerplichteBranche(indeling, ondernemer) ? 2 :
                      Ondernemer.hasEVI(ondernemer)                         ? 8 :
                                                                              32;
        return Ondernemer.isVast(ondernemer) ?
               group >> 1 :
               group;
    },

    _isAvailable: (
        indeling: IMarktindeling,
        targetPlaats: IMarktplaats,
        ondernemer: IMarktondernemer
    ): boolean => {
        return !!~indeling.openPlaatsen.findIndex(({ plaatsId }) => {
            if (plaatsId !== targetPlaats.plaatsId) {
                return false;
            }

            // Deze code behandeld een specifieke situatie. Het kan voorkomen dat 2 VPHs
            // beiden willen verplaatsen, waarbij de VPH met hogere anciënniteit een plek
            // van de andere VPH inneemt. In sommige gevallen is dit onterecht: als de latere
            // VPH meerdere plaatsen heeft kan het zijn dat hij ondanks zijn voorkeuren bepaalde
            // van zijn vaste plaatsen nooit zal verlaten. Die plekken mogen niet beschikbaar
            // zijn komen voor andere VPHs.
            //
            // Zie ook `Ondernemer.willNeverLeave`.
            const plaatsEigenaar = Ondernemers.findVPHFor(indeling, plaatsId);
            return !plaatsEigenaar ||
                   ondernemer === plaatsEigenaar ||
                   !Ondernemer.willNeverLeave(plaatsEigenaar, indeling).includes(plaatsId);
        });
    }
};

export default Indeling;
