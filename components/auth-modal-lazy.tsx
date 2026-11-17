"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import type AuthModalType from "./auth-modal"

/**
 * The login modal is heavy (forms, zod, Turnstile, OTP) and is only ever needed
 * by a customer who is not signed in. Importing it directly pulled all of that
 * into the cart and checkout bundles and made it fetch the banner settings on
 * every page load, whether or not it was ever shown.
 *
 * This loads it the first time it is asked to open, and keeps it mounted
 * afterwards so closing and reopening does not lose the form state.
 */
const AuthModal = dynamic(() => import("./auth-modal"), { ssr: false })

type Props = React.ComponentProps<typeof AuthModalType>

export default function LazyAuthModal(props: Props) {
  const [wanted, setWanted] = React.useState(props.open)
  React.useEffect(() => {
    if (props.open) setWanted(true)
  }, [props.open])
  return wanted ? <AuthModal {...props} /> : null
}
