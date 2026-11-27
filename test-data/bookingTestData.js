// Edit these values to change the booking search without changing the test code.
// Environment variables can override the defaults when running Playwright.
const numberFromEnv = (name, fallback) => {
    const value = process.env[name];
    if (value === undefined || value.trim() === '') return fallback;

    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        throw new Error(name + ' must be a valid number. Received: ' + value);
    }
    return parsed;
};

const textFromEnv = (name, fallback) => {
    const value = process.env[name];
    return value && value.trim() ? value.trim() : fallback;
};

export const bookingScenarios = [
    {
        scenarioName: 'Porur morning show',
        locationName: textFromEnv('DISTRICT_LOCATION', 'Porur'),
        movieName: textFromEnv('DISTRICT_MOVIE_NAME', 'OM'),
        radiusKm: numberFromEnv('DISTRICT_RADIUS_KM', 15),
        ticketCount: numberFromEnv('DISTRICT_TICKET_COUNT', 4),
        showtimeWindow: {
            start: textFromEnv('DISTRICT_TIME_FROM', '06:00 AM'),
            end: textFromEnv('DISTRICT_TIME_TO', '09:00 AM'),
        },
    },
];
