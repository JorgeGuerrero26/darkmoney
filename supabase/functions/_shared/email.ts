type TransactionalEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

type TransactionalEmailResult = {
  sent: boolean;
  provider: "resend" | null;
  messageId?: string | null;
  error?: string | null;
};

function getResendApiKey() {
  return Deno.env.get("RESEND_API_KEY")?.trim() ?? "";
}

function getResendFromEmail() {
  return Deno.env.get("RESEND_FROM_EMAIL")?.trim() || "DarkMoney <onboarding@resend.dev>";
}

function getResendReplyTo() {
  return Deno.env.get("RESEND_REPLY_TO")?.trim() ?? "";
}

export async function sendTransactionalEmail(
  input: TransactionalEmailInput,
): Promise<TransactionalEmailResult> {
  const apiKey = getResendApiKey();

  if (!apiKey) {
    return {
      sent: false,
      provider: null,
      error: "RESEND_API_KEY no esta configurado en Supabase Functions.",
    };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: getResendFromEmail(),
      to: [input.to],
      reply_to: getResendReplyTo() || undefined,
      subject: input.subject,
      html: input.html,
      text: input.text,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();

    return {
      sent: false,
      provider: "resend",
      error: `Resend respondio ${response.status}: ${errorText}`,
    };
  }

  const data = (await response.json()) as { id?: string | null };

  return {
    sent: true,
    provider: "resend",
    messageId: data.id ?? null,
  };
}
