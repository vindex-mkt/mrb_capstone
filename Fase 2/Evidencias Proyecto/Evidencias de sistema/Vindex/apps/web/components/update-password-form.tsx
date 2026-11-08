"use client";

import { useState } from "react";
import { updatePassword } from "@/app/update-password/actions";
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

type UpdatePasswordFormProps = {
  hasValidRecoverySession: boolean;
  hasInvalidLink: boolean;
};

export function UpdatePasswordForm({
  hasValidRecoverySession,
  hasInvalidLink,
}: UpdatePasswordFormProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [updated, setUpdated] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    if (password.length < 8) {
      setErrorMessage("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    try {
      const result = await updatePassword(password);
      if (!result.success) {
        setErrorMessage(result.message);
        return;
      }

      setUpdated(true);
    } catch {
      setErrorMessage(
        "No pudimos actualizar la contraseña. Inténtalo nuevamente.",
      );
    } finally {
      setLoading(false);
    }
  };

  const canUpdate = hasValidRecoverySession && !updated;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {updated ? "Contraseña actualizada" : "Crear nueva contraseña"}
        </CardTitle>
        <CardDescription>
          {updated
            ? "Tu contraseña se actualizó correctamente."
            : "Elige una contraseña segura para tu cuenta."}
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

        {updated ? (
          <Button
            nativeButton={false}
            render={<a href="/login" />}
            className="w-full"
          >
            Volver al inicio de sesión
          </Button>
        ) : !canUpdate ? (
          <div className="flex flex-col gap-4">
            <p
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
            >
              {hasInvalidLink
                ? "El enlace de recuperación no es válido, ya fue utilizado o ha expirado."
                : "Necesitas abrir un enlace de recuperación válido para cambiar tu contraseña."}
            </p>
            <Button
              nativeButton={false}
              render={<a href="/forgot-password" />}
              className="w-full"
            >
              Solicitar otro enlace
            </Button>
            <FieldDescription className="text-center">
              <a
                href="/login"
                className="text-brand-700 hover:text-brand-800 hover:underline"
              >
                Volver al inicio de sesión
              </a>
            </FieldDescription>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="password">Nueva contraseña</FieldLabel>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
                <FieldDescription>
                  Debe tener al menos 8 caracteres.
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="confirm-password">
                  Confirmar contraseña
                </FieldLabel>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                />
              </Field>
              <Field>
                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? "Guardando..." : "Guardar nueva contraseña"}
                </Button>
              </Field>
            </FieldGroup>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
