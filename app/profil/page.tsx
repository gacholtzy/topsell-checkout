"use client"

import React, { useEffect, useState } from 'react'
import { useAuthStore } from '@/lib/useAuthStore'
import { getUserProfile, UserProfile } from '@/lib/user-utils'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { User, Mail, Phone, User as UserIcon, CheckCircle, XCircle, Star, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { getPointBalance } from '@/lib/points-utils'

const emailSchema = z.object({
  email: z.string().email('Email tidak valid').min(1, 'Email harus diisi'),
})

type EmailFormData = z.infer<typeof emailSchema>

export default function ProfilePage() {
  const { token, user: authUser } = useAuthStore()
  const { toast } = useToast()
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isSendingValidation, setIsSendingValidation] = useState(false)
  const [originalEmail, setOriginalEmail] = useState<string>('')
  const [countdown, setCountdown] = useState(0)
  const [pointBalance, setPointBalance] = useState<number | null>(null)

  const form = useForm<EmailFormData>({
    resolver: zodResolver(emailSchema),
    defaultValues: {
      email: '',
    },
  })

  // Fetch user profile on component mount
  useEffect(() => {
    const fetchProfile = async () => {
      if (!token) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Token tidak ditemukan, silakan login kembali",
        })
        return
      }

      try {
        const response = await getUserProfile(token)
        setUserProfile(response.data)
        setOriginalEmail(response.data.email)
        form.setValue('email', response.data.email)
        setIsLoading(false)
      } catch (error) {
        console.error('Error fetching profile:', error)
        toast({
          variant: "destructive",
          title: "Error",
          description: error instanceof Error ? error.message : "Gagal mengambil data profil",
        })
        setIsLoading(false)
      }
    }

    fetchProfile()
  }, [token, toast, form])

  // Fetch loyalty point balance for the summary card
  useEffect(() => {
    if (!token) return
    getPointBalance(token)
      .then((b) => setPointBalance(b.activePoints))
      .catch((err) => console.error('Error fetching point balance:', err))
  }, [token])

  // Countdown effect
  useEffect(() => {
    let timer: NodeJS.Timeout;

    if (countdown > 0) {
      timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [countdown]);

  const onSubmit = async (data: EmailFormData) => {
    if (!token) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Token tidak ditemukan, silakan login kembali",
      })
      return
    }

    setIsUpdating(true)
    try {
      const response = await fetch('/api/users/email', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ email: data.email }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || 'Gagal memperbarui email')
      }

      // Update local state
      if (userProfile) {
        setUserProfile({ ...userProfile, email: data.email })
      }

      toast({
        title: "Berhasil",
        description: "Email berhasil diperbarui",
      })
    } catch (error) {
      console.error('Error updating email:', error)
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Gagal memperbarui email",
      })
    } finally {
      setIsUpdating(false)
    }
  }

  const handleSendEmailValidation = async () => {
    if (!token) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Token tidak ditemukan, silakan login kembali",
      })
      return
    }

    setIsSendingValidation(true)
    try {
      const response = await fetch('/api/users/send-email-validation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ email: form.watch('email') })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || 'Gagal mengirim validasi email')
      }

      toast({
        title: "Berhasil",
        description: "Email validasi telah dikirim ke email Anda",
      })

      // Start 60 second countdown
      setCountdown(60)
    } catch (error) {
      console.error('Error sending email validation:', error)
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Gagal mengirim validasi email",
      })
    } finally {
      setIsSendingValidation(false)
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-2 text-muted-foreground">Memuat data profil...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!userProfile) {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6">
        <div className="text-center">
          <p className="text-muted-foreground">Tidak dapat memuat data profil</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6">
      <div className="space-y-6">

        {/* Points summary card */}
        <Link href="/points" className="block">
          <Card className="transition-colors hover:bg-secondary">
            <CardContent className="flex items-center justify-between py-4">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-warning-soft p-2 text-warning">
                  <Star className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Saldo Poin</p>
                  <p className="text-xl font-bold text-warning">
                    {(pointBalance ?? 0).toLocaleString('id-ID')} poin
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-gray-400" />
            </CardContent>
          </Card>
        </Link>

        {/* Profile Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserIcon className="h-5 w-5" />
              Informasi Profil
            </CardTitle>
            <CardDescription>
              Data pribadi Anda yang tersimpan dalam sistem
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Full Name - Read Only */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Nama Lengkap
              </Label>
              <Input
                value={userProfile.fullName}
                readOnly
                className="bg-secondary/60"
              />
            </div>

            {/* Phone Number - Read Only */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Nomor Telepon
              </Label>
              <Input
                value={userProfile.phoneNumber}
                readOnly
                className="bg-secondary/60"
              />
            </div>

            {/* Email - Editable */}
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        Email
                        {userProfile && (
                          <Badge
                            // variant={userProfile.isEmailValid ? "" : "destructive"}
                            className={`ml-2 ${userProfile.isEmailValid ? "bg-success text-white" : "bg-destructive text-white"}`}
                          >
                            {userProfile.isEmailValid ? (
                              <>
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Sudah Tervalidasi
                              </>
                            ) : (
                              <>
                                <XCircle className="h-3 w-3 mr-1" />
                                Belum Tervalidasi
                              </>
                            )}
                          </Badge>
                        )}
                      </FormLabel>
                      <FormControl>
                        <div className="flex gap-2">
                          <Input
                            {...field}
                            type="email"
                            placeholder="Masukkan email Anda"
                            readOnly={userProfile?.isEmailValid}
                            className={`${userProfile?.isEmailValid ? "bg-secondary/60" : ""}`}
                          />
                          {
                            !userProfile?.isEmailValid && (
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                onClick={handleSendEmailValidation}
                                className="whitespace-nowrap h-[36px]"
                              >
                                {isSendingValidation ? (
                                  <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900 mr-2"></div>
                                    Mengirim...
                                  </>
                                ) : countdown > 0 ? (
                                  `Tunggu ${countdown}s`
                                ) : (
                                  'Validasi Email'
                                )}
                              </Button>
                            )
                          }
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {
                  !userProfile?.isEmailValid && (
                    <Button
                      type="submit"
                      disabled={isUpdating}
                      className="w-full"
                    >
                      {isUpdating ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Memperbarui...
                        </>
                      ) : (
                        'Perbarui Email'
                      )}
                    </Button>
                  )
                }
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
