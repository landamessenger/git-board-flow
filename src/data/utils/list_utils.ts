import Chance from 'chance';

const chance = new Chance();

export const getRandomElement = <T>(list: T[]): T | undefined => {
    // Return undefined for empty lists
    if (!list?.length) {
        return undefined;
    }

    // Return first element for single item lists
    if (list.length === 1) {
        return list[0];
    }

    // Use chance to get a random index
    const randomIndex = chance.integer({ min: 0, max: list.length - 1 });
    return list[randomIndex];
};