import {
    BrancheId,
    IBranche,
    IMarkt,
    IMarktindeling,
    IMarktondernemer,
    IMarktplaats,
    IPlaatsvoorkeur,
    IToewijzing,
    PlaatsId
} from '../models/markt';

import Markt from './markt';

const Ondernemer = {
    acceptsRandomAllocation: (
        ondernemer: IMarktondernemer
    ): boolean => {
        const voorkeur = ondernemer.voorkeur;
        return !voorkeur || !('anywhere' in voorkeur) ?
               !Ondernemer.hasVastePlaatsen(ondernemer) :
               !!voorkeur.anywhere;
    },

    canExpandInIteration: (
        indeling: IMarktindeling,
        iteration: number,
        toewijzing: IToewijzing
    ): boolean => {
        const { ondernemer, plaatsen } = toewijzing;
        const currentSize = plaatsen.length;
        const targetSize  = Ondernemer.getTargetSize(ondernemer);
        const maxSize     = Math.min(targetSize, iteration);

        return currentSize < maxSize;
    },

    getBrancheIds: (ondernemer: IMarktondernemer): BrancheId[] => {
        const { branches: brancheIds = [] } = ondernemer.voorkeur || {};
        return brancheIds;
    },

    getBranches: (
        ondernemer: IMarktondernemer,
        markt: IMarkt
    ): IBranche[] => {
        const brancheIds = Ondernemer.getBrancheIds(ondernemer);
        return brancheIds.reduce((branches, brancheId) => {
            const branche = markt.branches.find(b => b.brancheId === brancheId);
            return branche ?
                   branches.concat(branche) :
                   branches;
        }, []);
    },

    getPlaatsVoorkeuren: (
        markt: IMarkt,
        ondernemer: IMarktondernemer,
        includeVastePlaatsen: boolean = true
    ): IPlaatsvoorkeur[] => {
        const vastePlaatsen = Ondernemer.getVastePlaatsen(markt, ondernemer);

        // Een sollicitant met een tijdelijke vaste plaats mag geen voorkeuren opgeven,
        // dus deze moeten genegeerd worden.
        if (Ondernemer.isExperimenteel(ondernemer) && vastePlaatsen.length) {
            return vastePlaatsen;
        }

        // Merge de vaste plaatsen van deze ondernemer met hun verplaatsingsvoorkeuren.
        // Sorteer aflopend op prioriteit en haal de dubbeling eruit. Als `includeVastePlaatsen`
        // `false` is moeten die ook uit het resultaat gefilterd worden: het kan namelijk
        // zijn dat een ondernemer zijn eigen plaatsen ook nog als voorkeur heeft opgegeven.
        const voorkeuren = markt.voorkeuren.filter(({ erkenningsNummer }) =>
            erkenningsNummer === ondernemer.erkenningsNummer
        );
        return (includeVastePlaatsen ? vastePlaatsen : [])
        .concat(voorkeuren)
        .sort((a, b) => (b.priority || 0) - (a.priority || 0))
        .reduce((unique, voorkeur) => {
            if (
                !unique.find(({ plaatsId }) => plaatsId === voorkeur.plaatsId) && (
                    includeVastePlaatsen ||
                    !vastePlaatsen.find(({ plaatsId }) => plaatsId === voorkeur.plaatsId)
                )
            ) {
                unique.push(voorkeur);
            }
            return unique;
        }, []);
    },

    getMostLimitedBranche: (
        ondernemer: IMarktondernemer,
        indeling: IMarktindeling
    ): IBranche | void => {
        const branches = Ondernemer.getBranches(ondernemer, indeling);
        return branches.reduce((mostLimited, branche) => {
            return !branche.maximumPlaatsen                              ? mostLimited :
                   !mostLimited || !mostLimited.maximumPlaatsen          ? branche :
                   branche.maximumPlaatsen < mostLimited.maximumPlaatsen ? branche :
                                                                           mostLimited;
        }, undefined);
    },

    getMinimumSize: (ondernemer: IMarktondernemer): number => {
        const { plaatsen = [] }          = ondernemer;
        let { minimum = 0, maximum = 0 } = ondernemer.voorkeur || {};

        // Ondernemers met status experimenteel mogen hun minimum aantal plaatsen
        // niet zelf instellen.
        if (Ondernemer.isExperimenteel(ondernemer)) {
            return plaatsen.length;
        }
        // In `Indeling.init` wordt de input data zodanig gemanipuleerd dat een TVPLZ
        // ondernemer altijd een lege `plaatsen` array heeft, maar een `voorkeur.minimum`
        // ingesteld op het aantal plaatsen dat in de originele input zat.
        if (Ondernemer.isTVPLZ(ondernemer)) {
            return minimum;
        }

        minimum  = minimum || Math.max(plaatsen.length, 1);
        maximum  = maximum || minimum;
        return Math.min(minimum, maximum);
    },
    getStartSize: (ondernemer: IMarktondernemer): number => {
        return Ondernemer.isVast(ondernemer) || Ondernemer.isExperimenteel(ondernemer) ?
               Ondernemer.getMinimumSize(ondernemer) :
               1;
    },
    getTargetSize: (ondernemer: IMarktondernemer): number => {
        // Ondernemers met status experimenteel mogen geen maximum aantal gewenste
        // plaatsen instellen.
        if (Ondernemer.isExperimenteel(ondernemer)) {
            const { plaatsen = [] } = ondernemer;
            return plaatsen.length;
        }

        const minimum = Ondernemer.getMinimumSize(ondernemer);
        const { maximum = 0 } = ondernemer.voorkeur || {};
        return maximum || Math.max(minimum, 1);
    },

    getVastePlaatsen: (
        markt: IMarkt,
        ondernemer: IMarktondernemer
    ): IPlaatsvoorkeur[] => {
        const { plaatsen = [] } = ondernemer;
        return plaatsen.map(plaatsId => ({
            plaatsId,
            erkenningsNummer: ondernemer.erkenningsNummer,
            marktId: markt.marktId,
            priority: 0
        }));
    },

    hasBranche: (
        ondernemer: IMarktondernemer,
        brancheId?: BrancheId
    ): boolean => {
        const brancheIds = Ondernemer.getBrancheIds(ondernemer);
        return brancheId ?
               brancheIds.includes(brancheId) :
               !!brancheIds.length;
    },

    hasEVI: (ondernemer: IMarktondernemer): boolean => {
        const { verkoopinrichting = [] } = ondernemer.voorkeur || {};
        return !!verkoopinrichting.length;
    },

    hasVastePlaats: (
        ondernemer: IMarktondernemer,
        plaats: IMarktplaats
    ): boolean => {
        if (!ondernemer.plaatsen) {
            return false;
        }
        return !!ondernemer.plaatsen.includes(plaats.plaatsId);
    },

    hasVastePlaatsen: (ondernemer: IMarktondernemer): boolean => {
        return ondernemer.plaatsen &&
               ondernemer.plaatsen.length > 0;
    },

    hasVerplichteBranche: (
        markt: IMarkt,
        ondernemer: IMarktondernemer
    ): boolean => {
        const branches = Ondernemer.getBranches(ondernemer, markt);
        return !!branches.find(branche => !!branche.verplicht);
    },

    isExperimenteel: (ondernemer: IMarktondernemer): boolean => {
        return ondernemer.status === 'exp' ||
               ondernemer.status === 'expf';
    },

    isInBranche: (
        ondernemer: IMarktondernemer,
        branche: IBranche
    ): boolean => {
        const brancheIds = Ondernemer.getBrancheIds(ondernemer);
        return brancheIds.includes(branche.brancheId);
    },

    isTVPLZ: (ondernemer: IMarktondernemer): boolean => {
        return ondernemer.status === 'tvplz';
    },

    isVast: (ondernemer: IMarktondernemer): boolean => {
        return ondernemer.status === 'vpl' ||
               ondernemer.status === 'tvpl' ||
               ondernemer.status === 'tvplz' ||
               ondernemer.status === 'vkk';
    },

    wantsExpansion: (toewijzing: IToewijzing): boolean => {
        const { ondernemer, plaatsen } = toewijzing;
        const targetSize               = Ondernemer.getTargetSize(ondernemer);
        const currentSize              = plaatsen.length;
        return currentSize < targetSize;
    },

    // Geeft een array met plaats IDs waar deze VPH sowieso op zal staan. Dit
    // komt enkel voor in scenario's waar alle plaatsen (vaste plaatsen + voorkeuren)
    // zich in dezelfde marktrij bevinden en de overspanning van deze plaatsen
    // kleiner is dan 2x het aantal minimum plaatsen. In dat geval zal er altijd
    // een overlap van plaatsen zijn waar deze ondernemer *altijd* op zal staan.
    //
    // Deze plaatsen mogen niet door een andere VPH ingenomen worden, ook al wil
    // eerstgenoemde VPH verplaatsen.
    //
    // TODO: Weinig elegante oplossing. Kan dit verenigd worden met de nieuwe code
    //       in `Indeling.allocateOndernemer` die voorkomt dat een VPH niet op zijn
    //       eigen plek terecht kan als zijn voorkeuren niet beschikbaar zijn?
    willNeverLeave: (
        ondernemer: IMarktondernemer,
        indeling: IMarktindeling
    ): PlaatsId[] => {
        const minSize     = Ondernemer.getMinimumSize(ondernemer);
        const voorkeuren  = Ondernemer.getPlaatsVoorkeuren(indeling, ondernemer);
        const voorkeurIds = voorkeuren.map(({ plaatsId }) => plaatsId);

        try {
            const row     = Markt.findRowForPlaatsen(indeling, voorkeurIds);
            const trimmed = Markt.trimRow(row, voorkeurIds);
            const overlap = 2 * minSize - trimmed.length;

            if (overlap <= 0) {
                return [];
            }

            return trimmed.splice((trimmed.length - overlap) / 2, overlap);
        } catch (e) {
            return [];
        }
    }
};

export default Ondernemer;
