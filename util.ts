// Array functions
// ===============

// Sort functions
// --------------
export const numberSort = (a: number, b: number): number => (a > b ? 1 : a === b ? 0 : -1);
export const stringSort = (a: string, b: string): number => (a > b ? 1 : a === b ? 0 : -1);
// Reduce functions
// ----------------
// Example usage: [[1], [2]].reduce(methodName, [])
export const sum = (a: number, b: number): number => a + b;
export const max = (a: number, b: number): number => Math.max(a, b);
export const flatten = <T>(a: T[] = [], b: T[] = []): T[] => [...(a || []), ...(b || [])];
export const unique = <T>(a: T[], b: T): T[] => a.includes(b) ? a : [...a, b];

export const compareProperty = (
    a: any[],
    b: any[],
    property: string
) => {
    return a.map(({ [property]: p }) => p).reduce(sum, 0) -
           b.map(({ [property]: p }) => p).reduce(sum, 0);
};

// General
// -------
export const arrayToObject = <T, K extends keyof T>(array: T[], keyField: K): { [index: string]: T } => {
    return array.reduce((obj: { [index: string]: T }, item: T) => {
        obj[String(item[keyField])] = item;

        return obj;
    }, {});
};

export const pluck = <T>(array: T[], key: string): any[] => {
    return array.reduce((result: any[], el: { [index: string]: any }): any => {
        return key in el ? result.concat(el[key]) : result;
    }, []);
};

export const count = <T>(arrayMaybe: T | T[]): number => {
    return arrayMaybe ? (Array.isArray(arrayMaybe) ? arrayMaybe.length : 1) : 0;
};

export const exclude = <T>(a: T[] = [], b: any[] = []): T[] => {
    return a.filter(value => !b.includes(value));
};

export const difference = (a: any[] = [], b: any[] = []) => {
    return a.filter(value => !b.includes(value));
};

export const intersection = (a: any[] = [], b: any[] = []) => {
    return a.filter(value => b.includes(value));
};

export const intersects = (a: any[] = [], b: any[] = []): boolean => {
    return !!a.find(value => b.includes(value));
};