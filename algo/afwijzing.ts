import {
    IAfwijzing,
    IAfwijzingReason,
    IMarktindeling,
    IMarktondernemer,
} from '../models/markt';

import Toewijzing from './toewijzing';

export const BRANCHE_FULL: IAfwijzingReason = {
    code: 1,
    message: 'Alle marktplaatsen voor deze branche zijn reeds ingedeeld.'
};
export const ADJACENT_UNAVAILABLE: IAfwijzingReason = {
    code: 2,
    message: 'Geen geschikte locatie gevonden met huidige voorkeuren.'
};
export const MINIMUM_UNAVAILABLE: IAfwijzingReason = {
    code: 3,
    message: 'Minimum aantal plaatsen niet beschikbaar.'
};
export const MARKET_FULL: IAfwijzingReason = {
    code: 4,
    message: 'Alle marktplaatsen zijn reeds ingedeeld.'
};

const Afwijzing = {
    BRANCHE_FULL,
    ADJACENT_UNAVAILABLE,
    MINIMUM_UNAVAILABLE,
    MARKET_FULL,

    add: (
        indeling: IMarktindeling,
        ondernemer: IMarktondernemer,
        reason: IAfwijzingReason
    ): IMarktindeling => {
        indeling = Toewijzing.remove(indeling, ondernemer);

        if( !Afwijzing.find(indeling, ondernemer) ) {
            indeling.afwijzingen = indeling.afwijzingen.concat({
                marktId          : indeling.marktId,
                marktDate        : indeling.marktDate,
                erkenningsNummer : ondernemer.erkenningsNummer,
                reason,
                ondernemer
            });
        }

        return indeling;
    },

    find: (
        indeling: IMarktindeling,
        ondernemer: IMarktondernemer
    ): IAfwijzing => {
        return indeling.afwijzingen.find(afwijzing =>
            afwijzing.erkenningsNummer === ondernemer.erkenningsNummer
        );
    }
};

export default Afwijzing;
