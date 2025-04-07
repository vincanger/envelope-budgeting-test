import { z } from 'zod';
import { defineUserSignupFields } from 'wasp/auth/providers/types';

const emailDataSchema = z.object({
  email: z.string(),
});

export const getEmailUserFields = defineUserSignupFields({
  email: (data) => {
    const emailData = emailDataSchema.parse(data);
    return emailData.email;
  },
});
