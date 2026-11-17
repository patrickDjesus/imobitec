export function isBasicEmailFormat(value: string) {
  return /^[^\s@]+@[^\s@]+$/.test(value.trim());
}

type AuthErrorLike = {
  status?: number;
  code?: string;
  message?: string;
};

export function signupErrorMessage(error: AuthErrorLike | null | undefined) {
  const signature = `${error?.code ?? ""} ${error?.message ?? ""}`.toLocaleLowerCase("en-US");

  if (
    error?.status === 429
    || signature.includes("rate limit")
    || signature.includes("too many requests")
    || signature.includes("over_email_send_rate_limit")
  ) {
    return "Muitas tentativas de cadastro em pouco tempo. Aguarde alguns minutos e tente novamente.";
  }

  if (signature.includes("weak_password") || signature.includes("password should be")) {
    return "Senha não atende aos requisitos de segurança.";
  }

  if (signature.includes("invalid") && signature.includes("email")) {
    return "Formato de e-mail não aceito. Use nome@domínio.";
  }

  return "Não foi possível criar a conta agora. Revise os dados e tente novamente.";
}
