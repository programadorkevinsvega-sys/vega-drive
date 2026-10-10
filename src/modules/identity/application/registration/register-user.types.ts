export interface TurnstileVerifier {
  verify(token: string, clientIp?: string | null): Promise<boolean>;
}
