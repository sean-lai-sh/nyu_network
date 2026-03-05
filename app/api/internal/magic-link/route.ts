import { NextRequest, NextResponse } from "next/server";

const required = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
};

const RESEND_API_URL = "https://api.resend.com/emails";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const secret = process.env.MAGIC_LINK_MAILER_SECRET ?? process.env.BETTER_AUTH_SECRET;

  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { email, url } = (await request.json()) as { email?: string; url?: string };
  if (!email || !url) {
    return NextResponse.json({ error: "Email and URL are required" }, { status: 400 });
  }

  const resendApiKey = required("RESEND_API_KEY");
  const fromEmail = required("RESEND_FROM_EMAIL");
  const fromName = process.env.RESEND_FROM_NAME?.trim();
  const from = fromName ? `${fromName} <${fromEmail}>` : fromEmail;

  const subject = "Your NYU Network Magic Link";
  const text = `Use this link to sign in: ${url}`;
  const html = `<p>Use this link to sign in:</p><p><a href="${url}">${url}</a></p>`;

  const resendResponse = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject,
      text,
      html
    })
  });

  const resendBody = (await resendResponse.json().catch(() => null)) as { id?: string; message?: string } | null;
  if (!resendResponse.ok) {
    return NextResponse.json(
      { error: "Failed to send magic link email via Resend.", details: resendBody?.message ?? null },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, provider: "resend", id: resendBody?.id ?? null });
}
