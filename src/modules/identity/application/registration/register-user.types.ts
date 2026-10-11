export type TurnstileAction = "register" | "login";

export interface TurnstileVerifier {
  verify(
    token: string,
    expectedAction: TurnstileAction,
    clientIp?: string | null,
  ): Promise<boolean>;
}
