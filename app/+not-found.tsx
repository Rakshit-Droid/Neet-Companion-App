import { useEffect } from "react"
import { router, usePathname } from "expo-router"

import { Screen } from "@/components/Screen"
import { Surface } from "@/components/Surface"
import { Text } from "@/components/Text"
import { Button } from "@/components/Button"
import { space } from "@/theme"

/**
 * Routes that existed before the app was restructured as the paid companion.
 * Links to them may be bookmarked or shared, so they redirect rather than
 * dead-ending. The browse screens have no successor: those features live on the
 * website now, so they land on the dashboard.
 */
const MOVED: Record<string, string> = {
  "/choice-filling": "/aiq",
  "/home": "/",
  "/predict": "/aiq",
  "/colleges": "/",
  "/states": "/state-quota",
}

function successorFor(pathname: string): string | null {
  if (MOVED[pathname]) return MOVED[pathname]
  // Old detail routes: /college/<slug> and /state/<slug>.
  if (pathname.startsWith("/college/")) return "/"
  if (pathname.startsWith("/state/")) return "/state-quota"
  return null
}

export default function NotFoundScreen() {
  const pathname = usePathname()
  const successor = successorFor(pathname)

  useEffect(() => {
    if (successor) router.replace(successor as never)
  }, [successor])

  // Redirecting: render nothing rather than flashing an error first.
  if (successor) return null

  return (
    <Screen title="Page not found">
      <Surface style={{ gap: space.sm }}>
        <Text variant="bodyRegular" tone="secondary">
          There is nothing at {pathname}. It may have moved, or the link may be
          mistyped.
        </Text>
      </Surface>
      <Button label="Go to dashboard" onPress={() => router.replace("/")} />
    </Screen>
  )
}
