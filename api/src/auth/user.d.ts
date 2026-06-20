import 'express';
import 'express-session';
import 'passport';

export {};
declare global {
  namespace Express {
    interface User {
      netId: string;
      evals: boolean;
      email?: string;
      firstName?: string;
      lastName?: string;
    }
  }
}

declare module 'express-session' {
  interface SessionData {
    appUser?: {
      user_id: number;
      verified_email: string;
    };
  }
}
