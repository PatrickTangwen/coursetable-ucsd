export function shouldExposeVerificationCode(nodeEnv: string) {
  return nodeEnv !== 'production';
}
