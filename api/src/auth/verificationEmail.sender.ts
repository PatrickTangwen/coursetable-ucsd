export interface VerificationEmail {
  email: string;
  code: string;
  expiresAt: number;
}

export interface VerificationEmailSender {
  sendVerificationEmail: (verification: VerificationEmail) => Promise<void>;
}

export function createDevelopmentVerificationEmailSender(): VerificationEmailSender {
  return {
    sendVerificationEmail: () => Promise.resolve(),
  };
}

interface VerificationEmailDeliveryOptions {
  nodeEnv: 'development' | 'production';
  hostedSender?: VerificationEmailSender;
}

export function createVerificationEmailDelivery({
  nodeEnv,
  hostedSender,
}: VerificationEmailDeliveryOptions) {
  if (nodeEnv === 'development') {
    return {
      sender: createDevelopmentVerificationEmailSender(),
      exposeVerificationCode: true,
    };
  }

  if (!hostedSender) {
    throw new Error(
      'Verification email sender config is required in hosted mode',
    );
  }

  return {
    sender: hostedSender,
    exposeVerificationCode: false,
  };
}
