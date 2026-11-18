"use client"

import React from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import {
    RiUserLine,
    RiShoppingCartLine,
    RiBox3Line,
    RiCoupon3Line,
    RiLogoutBoxRLine,
    RiLoginBoxLine,
} from '@remixicon/react'
import { ButtonLink } from '@/components/base/buttons/button'
import {
    Dropdown,
    DropdownTrigger,
    DropdownPopover,
    DropdownGroup,
    DropdownItem,
    DropdownDivider,
} from '@/components/base/dropdown/dropdown'
import { useAuthStore } from '@/lib/useAuthStore'
import { useToast } from '@/hooks/use-toast'

const MENU = [
    { href: '/cart', label: 'Keranjang', icon: RiShoppingCartLine },
    { href: '/order', label: 'Pesanan', icon: RiBox3Line },
    { href: '/profil', label: 'Profil', icon: RiUserLine },
    { href: '/voucher-saya', label: 'Voucher saya', icon: RiCoupon3Line },
]

const AppHeader = () => {
    const { logout, user, token, isAuthenticated } = useAuthStore()
    const { toast } = useToast()
    const router = useRouter()
    const pathname = usePathname()
    const [menuOpen, setMenuOpen] = React.useState(false)

    // The login state lives in localStorage and is read AFTER the first render, so
    // until it has loaded every visitor looks logged out. Drawing the login button
    // in that gap would flash it at customers who are in fact signed in, so the
    // account area stays empty until the stored state is known.
    const [hydrated, setHydrated] = React.useState(false)
    React.useEffect(() => {
        if (useAuthStore.persist?.hasHydrated()) setHydrated(true)
        const unsub = useAuthStore.persist?.onFinishHydration(() => setHydrated(true))
        return () => unsub?.()
    }, [])

    // A token and the flag together: a stored flag with no token is a leftover that
    // would show account links whose pages then bounce the customer to login.
    const loggedIn = isAuthenticated && !!token

    // Back to this page after signing in, the way the rest of the site does it.
    const loginHref = `/auth?from=${encodeURIComponent(pathname || '/')}`

    const handleLogout = () => {
        logout()
        toast({
            title: 'Logout berhasil',
            description: 'Anda telah keluar dari akun',
        })
        router.push("https://topsellbelanja.com")
    }

    const go = (href: string) => {
        setMenuOpen(false)
        router.push(href)
    }

    return (
        <div className="border-b border-border-button-default bg-background-full">
            <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
                <header className="flex h-14 items-center justify-between sm:h-16">
                    <Link href="https://topsellbelanja.com/" aria-label="Topsell Belanja">
                        <img src="/images/logo.webp" alt="Topsell Belanja" className='h-8 w-auto sm:h-10' />
                    </Link>

                    {/* Not hydrated yet: keep the space, show nothing (see above). */}
                    {!hydrated && <span className="size-9" aria-hidden="true" />}

                    {/* Signed out: the only thing to offer is a way in. */}
                    {hydrated && !loggedIn && (
                        <ButtonLink href={loginHref} leadingIcon={RiLoginBoxLine} className="max-md:h-11">
                            Login
                        </ButtonLink>
                    )}

                    {hydrated && loggedIn && (
                        <Dropdown isOpen={menuOpen} onOpenChange={setMenuOpen}>
                            <DropdownTrigger
                                aria-label="Menu akun"
                                className="flex size-11 items-center justify-center rounded-full border border-border-button-default bg-background-primary-default text-foreground-icon-primary transition-colors hover:bg-background-primary-hover md:size-9"
                            >
                                <RiUserLine className="size-5" aria-hidden />
                            </DropdownTrigger>
                            <DropdownPopover aria-label="Akun" placement="bottom end">
                                <p className="truncate px-2 pt-1 text-body-semibold text-text-primary">Hai, {user?.fullName}</p>
                                <DropdownDivider />
                                <DropdownGroup>
                                    {MENU.map(({ href, label, icon: Icon }) => (
                                        <DropdownItem key={href} onSelect={() => go(href)}>
                                            <Icon className="size-5 shrink-0 text-foreground-icon-secondary" aria-hidden />
                                            {label}
                                        </DropdownItem>
                                    ))}
                                </DropdownGroup>
                                <DropdownDivider />
                                <DropdownGroup>
                                    <DropdownItem onSelect={handleLogout} className="text-text-destructive">
                                        <RiLogoutBoxRLine className="size-5 shrink-0" aria-hidden />
                                        Logout
                                    </DropdownItem>
                                </DropdownGroup>
                            </DropdownPopover>
                        </Dropdown>
                    )}
                </header>
            </div>
        </div>
    )
}

export default AppHeader
