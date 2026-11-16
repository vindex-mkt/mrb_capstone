"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "../lib/supabase/client";
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"

export function SignupForm({ ...props }: React.ComponentProps<typeof Card>) {
  const router = useRouter()
  const supabase = createClient()

  // Estados de los campos
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [acceptedTerms, setAcceptedTerms] = useState(false)

  // Estados de control UI
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [confirmationPending, setConfirmationPending] = useState(false)

  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("error")) {
      setErrorMessage(
        "El enlace de confirmación no es válido o expiró. Vuelve a registrarte para solicitar otro.",
      )
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErrorMessage(null)

    // Validación de coincidencia de contraseña
    if (password !== confirmPassword) {
      setErrorMessage("Las contraseñas no coinciden.")
      return
    }

    if (password.length < 8) {
      setErrorMessage("La contraseña debe tener al menos 8 caracteres.")
      return
    }

    if (!acceptedTerms) {
      setErrorMessage("Debes leer y aceptar los términos y condiciones.")
      return
    }

    setLoading(true)
    const callbackUrl = new URL("/auth/callback", window.location.origin)
    callbackUrl.searchParams.set("next", "/profile?emailConfirmed=1")
    callbackUrl.searchParams.set(
      "errorRedirectTo",
      "/signup?error=email_confirmation",
    )
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: callbackUrl.toString(),
        data: {
          full_name: fullName,
          terms_accepted: true,
          terms_version: "2026-11-15",
          terms_accepted_at: new Date().toISOString(),
        },
      },
    })

    setLoading(false)

    if (error) {
      setErrorMessage(error.message)
      return
    }

    if (data.session) {
      router.push("/profile")
      router.refresh()
      return
    }

    setConfirmationPending(true)
  }

  return (
    <Card {...props}>
      <CardHeader>
        <CardTitle>Crear Cuenta</CardTitle>
        <CardDescription>
          Ingrese sus datos a continuación para crear su cuenta
        </CardDescription>
      </CardHeader>
      <CardContent>
        {confirmationPending && (
          <div
            role="status"
            className="mb-4 rounded-md border border-brand-300 bg-brand-50 p-3 text-sm text-brand-800"
          >
            Tu cuenta fue creada. Revisa tu correo y abre el enlace de
            confirmación para activar tu cuenta.
          </div>
        )}
        {errorMessage && (
          <div className="mb-4 rounded-md border border-red-500/50 bg-red-950/40 p-3 text-sm text-red-200">
            {errorMessage}
          </div>
        )}

        {!confirmationPending && (
          <form onSubmit={handleSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="name">Nombre y apellido</FieldLabel>
                <Input id="name" type="text" placeholder="Juan Pérez" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </Field>

              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input id="email" type="email" placeholder="m@ejemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                <FieldDescription>
                  Utilizaremos esto para ponernos en contacto con usted. No compartiremos su correo electrónico con nadie más.
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="password">Contraseña</FieldLabel>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                <FieldDescription>
                  Debe tener al menos 8 caracteres de longitud
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="confirm-password">Confirmar Contraseña</FieldLabel>
                <Input id="confirm-password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
                <FieldDescription>Por favor, confirme su contraseña</FieldDescription>
              </Field>

              <Field>
                <div className="flex items-start gap-3">
                  <input
                    id="accept-terms"
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(event) => setAcceptedTerms(event.target.checked)}
                    required
                    aria-describedby="terms-description"
                    className="mt-1 h-4 w-4 rounded border-border accent-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  />
                  <div>
                    <FieldLabel htmlFor="accept-terms">He leído y acepto los términos y condiciones de Vindex.</FieldLabel>
                    <FieldDescription id="terms-description">
                      <a
                        href="/terminos-y-condiciones"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-700 underline hover:text-brand-800"
                      >
                        Leer términos y condiciones
                      </a>
                    </FieldDescription>
                  </div>
                </div>
              </Field>

              <FieldGroup>
                <Field>
                  <Button type="submit" disabled={loading} className="w-full">
                    {loading ? "Creando cuenta..." : "Crear Cuenta"}
                  </Button>
                  <Button variant="outline" type="button" disabled className="w-full opacity-60">
                    Continuar con Google (Próximamente)
                  </Button>
                  <FieldDescription className="px-6 text-center">
                    ¿Ya tienes una cuenta? <a href="/login" className="underline hover:text-white">Iniciar Sesión</a>
                  </FieldDescription>
                </Field>
              </FieldGroup>
            </FieldGroup>
          </form>
        )}
      </CardContent>
    </Card>
  )
}