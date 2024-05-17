import {
    BrancheId,
    DeelnemerStatus,
    IBranche,
    IMarktindeling,
    IMarktondernemer,
    PlaatsId
} from '../models/markt';

import {
    intersection
} from '../util';

import Ondernemer from './ondernemer';

const STATUS_PRIORITIES = [
    DeelnemerStatus.SOLLICITANT,
    DeelnemerStatus.TIJDELIJKE_VASTE_PLAATS,
    DeelnemerStatus.VASTE_PLAATS
];

const Ondernemers = {
    compare: (
        a: IMarktondernemer,
        b: IMarktondernemer,
        aLijst: IMarktondernemer[]
    ): number => {
        // Sorteer eerst op aanwezigheid in de A-lijst...
        const sort1 = Number(aLijst.includes(b)) -
                      Number(aLijst.includes(a));
        // ... dan op status (Vastekaarthouders, tijdelijkevasteplaatshouders, sollicitanten)...
        const sort2 = Math.max(STATUS_PRIORITIES.indexOf(b.status), 0) -
                      Math.max(STATUS_PRIORITIES.indexOf(a.status), 0);
        // ... dan op anciënniteitsnummer
        const sort3 = a.sollicitatieNummer - b.sollicitatieNummer;

        return sort1 || sort2 || sort3;
    },

    countEVIs: (
        indeling: IMarktindeling,
        ondernemers: IMarktondernemer[]
    ): number => {
        return ondernemers.reduce((count, ondernemer) => {
            return Ondernemer.hasEVI(ondernemer) ? ++count : count;
        }, 0);
    },

    countPlaatsVoorkeurenFor: (
        indeling: IMarktindeling,
        plaatsId: PlaatsId
    ): number => {
        const result = indeling.voorkeuren.reduce((result, voorkeur) => {
            if( voorkeur.plaatsId === plaatsId ) {
                result.set(voorkeur.erkenningsNummer, voorkeur.priority);
            }
            return result;
        }, new Map());

        return result.size;
    },

    filterByBranche: (
        ondernemers: IMarktondernemer[],
        branche: IBranche
    ): IMarktondernemer[] => {
        return ondernemers.filter(ondernemer =>
            ondernemer.voorkeur &&
            ondernemer.voorkeur.branches &&
            ondernemer.voorkeur.branches.includes(branche.brancheId)
        );
    },

    findVPHFor: (
        indeling: IMarktindeling,
        plaatsId: PlaatsId
    ): IMarktondernemer => {
        return indeling.ondernemers.find(ondernemer => {
            const { plaatsen=[] } = ondernemer;
            return plaatsen.includes(plaatsId);
        });
    },

    getRelevantBranches: (
        indeling: IMarktindeling,
        ondernemers: IMarktondernemer[]
    ): BrancheId[] => {
        const marktBranches = indeling.branches.map(({ brancheId }) => brancheId);

        return ondernemers.reduce((brancheIds, ondernemer) => {
            const ondernemerBranches = Ondernemer.getBrancheIds(ondernemer);
            return brancheIds.concat(intersection(marktBranches, ondernemerBranches));
        }, []);
    },

    sort: (
        ondernemers: IMarktondernemer[],
        aLijst: IMarktondernemer[] = []
    ): IMarktondernemer[] => {
        return [...ondernemers].sort((a, b) => Ondernemers.compare(a, b, aLijst));
    },

    without: (
        ondernemers: IMarktondernemer[],
        ondernemer: IMarktondernemer
    ): IMarktondernemer[] => {
        return ondernemers.filter(_ondernemer =>
            _ondernemer !== ondernemer
        );
    }
};

export default Ondernemers;
