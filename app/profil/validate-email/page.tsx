"use client"

import React, { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle, XCircle, Mail, Loader2 } from 'lucide-react'

function ValidateEmailContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { toast } = useToast()
  const [validationStatus, setValidationStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState<string>('')

  useEffect(() => {
    const validateEmail = async () => {
      const token = searchParams.get('token')
      
      if (!token) {
        setValidationStatus('error')
        setErrorMessage('Token validasi tidak ditemukan')
        return
      }

      try {
        const response = await fetch(`/api/users/validate-email?token=${token}`, {
          method: 'GET',
        })

        const data = await response.json()

        if (response.status === 200) {
          setValidationStatus('success')
          toast({
            title: "Validasi Berhasil",
            description: "Email Anda telah berhasil divalidasi",
          })
          
          // Wait 3 seconds then redirect to profile page
          setTimeout(() => {
            router.push('/profil')
          }, 3000)
        } else {
          setValidationStatus('error')
          setErrorMessage(data.message || 'Gagal memvalidasi email')
        }
      } catch (error) {
        console.error('Error validating email:', error)
        setValidationStatus('error')
        setErrorMessage('Terjadi kesalahan saat memvalidasi email')
      }
    }

    validateEmail()
  }, [searchParams, router, toast])

  const handleRetry = () => {
    setValidationStatus('loading')
    setErrorMessage('')
    // Re-trigger validation
    const token = searchParams.get('token')
    if (token) {
      window.location.reload()
    }
  }

  const handleGoToProfile = () => {
    router.push('/profil')
  }

  return (
    <div className="container mx-auto max-w-md px-6 py-8">
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              {validationStatus === 'loading' && (
                <Loader2 className="h-12 w-12 text-foreground animate-spin" />
              )}
              {validationStatus === 'success' && (
                <CheckCircle className="h-12 w-12 text-green-500" />
              )}
              {validationStatus === 'error' && (
                <XCircle className="h-12 w-12 text-primary" />
              )}
            </div>
            <CardTitle className="flex items-center justify-center gap-2">
              <Mail className="h-5 w-5" />
              Validasi Email
            </CardTitle>
            <CardDescription>
              {validationStatus === 'loading' && 'Sedang memvalidasi email Anda...'}
              {validationStatus === 'success' && 'Email berhasil divalidasi'}
              {validationStatus === 'error' && 'Gagal memvalidasi email'}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            {validationStatus === 'loading' && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Mohon tunggu sebentar, kami sedang memverifikasi email Anda...
                </p>
                <div className="flex justify-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-foreground"></div>
                </div>
              </div>
            )}

            {validationStatus === 'success' && (
              <div className="space-y-4">
                <p className="text-sm text-success">
                  Email Anda telah berhasil divalidasi. Anda akan dialihkan ke halaman profil dalam beberapa detik.
                </p>
                <Button onClick={handleGoToProfile} className="w-full">
                  Ke Halaman Profil
                </Button>
              </div>
            )}

            {validationStatus === 'error' && (
              <div className="space-y-4">
                <p className="text-sm text-red-600">
                  {errorMessage}
                </p>
                <div className="space-y-2">
                  <Button onClick={handleRetry} variant="outline" className="w-full">
                    Coba Lagi
                  </Button>
                  <Button onClick={handleGoToProfile} className="w-full">
                    Ke Halaman Profil
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function ValidateEmailPage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto max-w-md px-6 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-2 text-muted-foreground">Memuat halaman validasi...</p>
          </div>
        </div>
      </div>
    }>
      <ValidateEmailContent />
    </Suspense>
  )
}
