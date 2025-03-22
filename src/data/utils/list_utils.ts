export const getRandomElement = <T>(list: T[]): T | undefined => {
    // Return undefined for empty lists
    if (!list?.length) {
        return undefined;
    }

    // Return first element for single item lists
    if (list.length === 1) {
        return list[0];
    }

    // Generate cryptographically secure random index using rejection sampling
    const max = 2 ** 32;
    const array = new Uint32Array(1);
    
    while (true) {
        crypto.getRandomValues(array);
        const randomValue = array[0];
        
        // Reject values that would cause bias
        if (randomValue >= max - (max % list.length)) {
            continue;
        }
        
        return list[randomValue % list.length];
    }
};