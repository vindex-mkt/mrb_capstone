"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { cn } from "cn"
import { createClient } from "@/lib/supabase/client"

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

type LoginFormProps = React.ComponentProps<"div"> & {
  initialIsAuthenticated: boolean;
  sessionCheckFailed: boolean;
};

export function LoginForm({
  initialIsAuthenticated,
  sessionCheckFailed,
  className,
  ...props
}: LoginFormProps) {
  const router = useRouter()
  const [supabase] = useState(createClient)
  const [isAuthenticated, setIsAuthenticated] = useState(initialIsAuthenticated)
  const [signingOut, setSigningOut] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(
    sessionCheckFailed
      ? "No pudimos comprobar tu sesión. Puedes iniciar sesión nuevamente."
      : null,
  )

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(Boolean(session?.user))
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  const handleSignOut = async () => {
    setSigningOut(true)
    setErrorMessage(null)

    const { error } = await supabase.auth.signOut()

    setSigningOut(false)

    if (error) {
      setErrorMessage("No pudimos cerrar la sesión. Inténtalo nuevamente.")
      return
    }

    setIsAuthenticated(false)
    router.refresh()
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setErrorMessage(null)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    setLoading(false)

    if (error) {
      setErrorMessage(error.message)
      return
    }

    const nextPath = new URLSearchParams(window.location.search).get("next")
    const redirectTo = nextPath?.startsWith("/") && !nextPath.startsWith("//")
      ? nextPath
      : "/profile"

    router.push(redirectTo)
    router.refresh()
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">
            {isAuthenticated ? "Ya has iniciado sesión" : "Bienvenido de vuelta"}
          </CardTitle>
          <CardDescription>
            {isAuthenticated
              ? "Tu cuenta ya está activa en este dispositivo."
              : "Inicia sesión en tu cuenta"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {errorMessage && (
            <div role="alert" className="mb-4 rounded-md border border-red-500/50 bg-red-950/40 p-3 text-sm text-red-200">
              {errorMessage}
            </div>
          )}
          {isAuthenticated ? (
            <Button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="w-full"
            >
              {signingOut ? "Cerrando sesión..." : "Cerrar sesión"}
            </Button>
          ) : (
            <form onSubmit={handleSubmit}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="email">Email</FieldLabel>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </Field>
                <Field>
                  <div className="flex items-center">
                    <FieldLabel htmlFor="password">Contraseña</FieldLabel>
                    <a
                      href="/forgot-password"
                      className="ml-auto text-sm text-brand-700 underline-offset-4 hover:text-brand-800 hover:underline"
                    >
                      ¿Olvidaste tu contraseña?
                    </a>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                  />
                </Field>
                <Field>
                  <Button type="submit" disabled={loading}>
                    {loading ? "Iniciando sesión..." : "Iniciar sesión"}
                  </Button>
                  <FieldDescription className="text-center">
                    ¿No tienes una cuenta? <a href="/signup" className="underline">Regístrate</a>
                  </FieldDescription>
                </Field>
              </FieldGroup>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
