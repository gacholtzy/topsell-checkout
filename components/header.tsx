"use client"

import React from 'react'
import { Button } from './ui/button'
import Link from 'next/link'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { User, Package, Star, LogOut, LogIn, ShoppingCart, Ticket } from 'lucide-react'
import { useAuthStore } from '@/lib/useAuthStore'
import { useToast } from '@/hooks/use-toast'
import { useRouter, usePathname } from 'next/navigation'
import { Separator } from './ui/separator'

const AppHeader = () => {
    const { logout, user, token, isAuthenticated } = useAuthStore()
    const { toast } = useToast()
    const router = useRouter()
    const pathname = usePathname()

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
            title: 'Logout Berhasil',
            description: 'Anda telah berhasil keluar dari akun',
        })
        // router.push('/auth?from=%2Fcart')
        router.push("https://topsellbelanja.com")
    }

    return (
        <div className="container mx-auto max-w-7xl px-6">
            <header className="flex justify-between items-center py-4 space-y-4">
                <Link href="https://topsellbelanja.com/">
                    <img src="/images/logo.webp" alt="Logo"
                        className='h-10'
                    />
                </Link>
                <nav>
                    <ul className="flex space-x-4">
                        {/* Not hydrated yet: keep the space, show nothing (see above). */}
                        {!hydrated && <li className="h-10 w-10" aria-hidden="true" />}

                        {/* Signed out: the only thing to offer is a way in. Cart, orders,
                            profile, vouchers and logout all belong to an account. */}
                        {hydrated && !loggedIn && (
                            <li>
                                <Button asChild className="bg-red-500 hover:bg-red-600 font-bold rounded-full px-5">
                                    <Link href={loginHref}>
                                        <LogIn className="h-4 w-4 mr-2" />
                                        Login
                                    </Link>
                                </Button>
                            </li>
                        )}

                        {hydrated && loggedIn && (
                        <li>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <div className='bg-red-500 hover:bg-red-600 font-bold text-lg p-2 rounded-full cursor-pointer flex items-center justify-center'>
                                        <User className="h-6 w-6 text-white" />
                                    </div>
                                </PopoverTrigger>
                                <PopoverContent className="w-64 p-2" align="end">
                                    <div className="space-y-1">
                                        <h4 className='text-sm font-bold px-4 py-2'>Hai, {user?.fullName}</h4>
                                        <Separator />
                                        <Button
                                            variant="ghost"
                                            className="w-full justify-start text-left"
                                            asChild
                                        >
                                            <Link href="/cart">
                                                <ShoppingCart className="h-4 w-4 mr-2" />
                                                Keranjang
                                            </Link>
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            className="w-full justify-start text-left"
                                            asChild
                                        >
                                            <Link href="/order">
                                                <Package className="h-4 w-4 mr-2" />
                                                Pesanan
                                            </Link>
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            className="w-full justify-start text-left"
                                            asChild
                                        >
                                            <Link href="/profil">
                                                <User className="h-4 w-4 mr-2" />
                                                Profil
                                            </Link>
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            className="w-full justify-start text-left"
                                            asChild
                                        >
                                            <Link href="/voucher-saya">
                                                <Ticket className="h-4 w-4 mr-2" />
                                                Voucher Saya
                                            </Link>
                                        </Button>
                                        {/* <Button
                                            variant="ghost"
                                            className="w-full justify-start text-left"
                                            asChild
                                        >
                                            <Link href="/points">
                                                <Star className="h-4 w-4 mr-2" />
                                                Poin
                                            </Link>
                                        </Button> */}
                                        <Button
                                            variant="ghost"
                                            className="w-full justify-start text-left text-red-600 hover:text-red-700 hover:bg-red-50"
                                            onClick={handleLogout}
                                        >
                                            <LogOut className="h-4 w-4 mr-2" />
                                            Logout
                                        </Button>
                                    </div>
                                </PopoverContent>
                            </Popover>
                        </li>
                        )}
                    </ul>
                </nav>
            </header>
        </div>
    )
}

export default AppHeader