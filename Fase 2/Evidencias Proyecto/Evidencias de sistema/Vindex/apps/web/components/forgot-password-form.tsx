"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function ForgotPasswordForm() {
  const [supabase] = useState(createClient);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    const normalizedEmail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setErrorMessage("Ingresa un correo electrónico válido.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        normalizedEmail,
        {
          redirectTo: new URL("/auth/callback", window.location.origin).toString(),
        },
      );

      if (error) {
        setErrorMessage(
          "No pudimos procesar la solicitud. Inténtalo nuevamente más tarde.",
        );
        return;
      }

      setSubmitted(true);
    } catch {
      setErrorMessage(
        "No pudimos procesar la solicitud. Inténtalo nuevamente más tarde.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recuperar contraseña</CardTitle>
        <CardDescription>
          Ingresa el correo asociado a tu cuenta y te enviaremos un enlace para
          crear una nueva contraseña.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {errorMessage && (
          <div
            role="alert"
            className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
          >
            {errorMessage}
          </div>
        )}

        {submitted ? (
          <div className="flex flex-col gap-4">
            <p
              role="status"
              className="rounded-md border border-brand-300 bg-brand-50 p-3 text-sm text-brand-800"
            >
              Si existe una cuenta asociada a ese correo, recibirás un enlace
              para restablecer tu contraseña.
            </p>
            <Button
              nativeButton={false}
              render={<a href="/login" />}
              className="w-full"
            >
              Volver al inicio de sesión
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="email">Correo electrónico</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="m@ejemplo.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </Field>
              <Field>
                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? "Enviando enlace..." : "Enviar enlace"}
                </Button>
                <FieldDescription className="text-center">
                  <a
                    href="/login"
                    className="text-brand-700 hover:text-brand-800 hover:underline"
                  >
                    Volver al inicio de sesión
                  </a>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
