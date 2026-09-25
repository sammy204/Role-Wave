// Keep unfinished features available for local development only. They must
// not be enabled accidentally by a production environment variable.
export const rolePilotEnabled = import.meta.env.DEV;
export const roleWaveProEnabled = import.meta.env.DEV;
