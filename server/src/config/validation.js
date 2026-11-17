import { z } from 'zod';
import { makeSchemas } from '../../../shared/schemas.js';

// The same schemas validate input in the web app and here on the server.
export const schemas = makeSchemas(z);
export { z };
