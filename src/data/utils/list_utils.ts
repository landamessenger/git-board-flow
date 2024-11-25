const getRandomElement = <T>(list: T[]): T | undefined => {
    if (list.length === 0) {
        return undefined;
    }
    if (list.length === 1) {
        return list[0];
    }
    const randomIndex = Math.floor(Math.random() * list.length);
    return list[randomIndex];
};