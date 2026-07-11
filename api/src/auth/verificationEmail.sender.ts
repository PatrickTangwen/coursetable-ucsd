export interface VerificationEmail {
  deliveryId: string;
  email: string;
  code: string;
  createdAt: number;
  expiresAt: number;
}

export interface VerificationEmailMessage {
  deliveryId: string;
  recipient: string;
  subject: string;
  text: string;
  html: string;
}

export interface VerificationEmailSender {
  sendVerificationEmail: (message: VerificationEmailMessage) => Promise<void>;
}

export function createVerificationEmailMessage({
  deliveryId,
  email,
  code,
  createdAt,
  expiresAt,
}: VerificationEmail): VerificationEmailMessage {
  const lifetimeMinutes = Math.ceil((expiresAt - createdAt) / 60_000);
  if (lifetimeMinutes <= 0)
    throw new Error('Verification email expiry must be after creation');

  const minuteLabel = lifetimeMinutes === 1 ? 'minute' : 'minutes';
  const expiryCopy = `This code expires in ${lifetimeMinutes} ${minuteLabel}.`;
  const ignoreCopy =
    'If you did not request this code, you can ignore this email.';

  return {
    deliveryId,
    recipient: email,
    subject: 'Your SunGrid verification code',
    text: `Your SunGrid verification code is ${code}. ${expiryCopy} ${ignoreCopy}`,
    html: `<p>Your SunGrid verification code is:</p><p><strong>${code}</strong></p><p>${expiryCopy} ${ignoreCopy}</p>`,
  };
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
