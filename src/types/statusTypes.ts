const statusTypes = {
    WAITING: 'WAITING',
    AUTHORIZED: 'AUTHORIZED',
    UNAUTHORIZED: 'UNAUTHORIZED',
    ERROR: 'ERROR',
} as const;

export type StatusType = typeof statusTypes[keyof typeof statusTypes];

module.exports = statusTypes;