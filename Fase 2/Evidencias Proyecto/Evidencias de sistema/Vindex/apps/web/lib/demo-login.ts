export type DemoLoginAccount = {
  code: string;
  email: string;
};

export function parseDemoLoginAccounts(value: string): DemoLoginAccount[] {
  let parsed: unknown;

  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("DEMO_LOGIN_ACCOUNTS debe contener JSON válido.");
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("DEMO_LOGIN_ACCOUNTS debe ser una lista no vacía.");
  }

  const codes = new Set<string>();
  const emails = new Set<string>();
  const accounts: DemoLoginAccount[] = [];

  for (const entry of parsed) {
    if (
      typeof entry !== "object" ||
      entry === null ||
      Array.isArray(entry) ||
      !("code" in entry) ||
      !("email" in entry) ||
      typeof entry.code !== "string" ||
      typeof entry.email !== "string"
    ) {
      throw new Error("Cada cuenta demo debe tener un código y un correo.");
    }

    const code = entry.code.trim();
    const email = entry.email.trim();
    if (!/^[a-zA-Z0-9_-]{4,128}$/.test(code) || !email || /\s/.test(email) || !email.includes("@")) {
      throw new Error("Hay un código o correo inválido en DEMO_LOGIN_ACCOUNTS.");
    }
    if (codes.has(code) || emails.has(email.toLowerCase())) {
      throw new Error("Los códigos y correos de las cuentas demo deben ser únicos.");
    }

    codes.add(code);
    emails.add(email.toLowerCase());
    accounts.push({ code, email });
  }

  return accounts;
}

export function findDemoLoginAccount(
  code: string,
  configuration = process.env.DEMO_LOGIN_ACCOUNTS,
): DemoLoginAccount | null {
  if (!configuration) {
    throw new Error("Falta configurar DEMO_LOGIN_ACCOUNTS.");
  }

  return parseDemoLoginAccounts(configuration).find((account) => account.code === code) ?? null;
}
