"use client";

import { useState, useEffect, useRef } from "react";
import { Turnstile, TurnstileInstance } from "@marsidev/react-turnstile";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { ChangeEvent } from "react";
import { Loader2, CheckCircle, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuthStore } from "@/lib/useAuthStore";
import {
  login,
  register,
  verifyOTP as verifyOTPApi,
  resendOTP as resendOTPApi,
  isOtpDeliveryFailure,
} from "@/app/api/auth";
import { getAppSettings } from "@/lib/app-settings";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

// Phone number validation schema for Indonesia (+62)
const phoneSchema = z.object({
  phoneNumber: z
    .string()
    .min(1, "Nomor HP wajib diisi")
    .regex(/^[0-9]+$/, "Nomor HP hanya boleh berisi angka")
    .refine(
      (val) => {
        return /^(0|8)/.test(val) && val.length >= 9 && val.length <= 12;
      },
      {
        message:
          "Nomor HP harus diawali dengan 0 atau 8 dan terdiri dari 9-12 digit",
      },
    ),
});

// OTP validation schema
const otpSchema = z.object({
  phoneNumber: phoneSchema.shape.phoneNumber,
  otp: z.string().length(4, "OTP harus 4 digit"),
});

// Registration schema
const registerSchema = z.object({
  fullName: z.string().min(1, "Nama lengkap wajib diisi"),
  email: z
    .string()
    .min(1, "Email wajib diisi")
    .email("Format email tidak valid"),
  phoneNumber: phoneSchema.shape.phoneNumber,
  website: z.string().optional(),
});

interface AuthModalProps {
  open: boolean;
  onAuthenticated: () => void;
  onClose?: () => void;
}

export default function AuthModal({
  open,
  onAuthenticated,
  onClose,
}: AuthModalProps) {
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("login");
  const [otpSent, setOtpSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [otpDigits, setOtpDigits] = useState<string[]>(["", "", "", ""]);
  const [honeypotWebsite, setHoneypotWebsite] = useState("");
  const [isNewRegistration, setIsNewRegistration] = useState(false);
  const { setToken, setUser } = useAuthStore();

  // Turnstile cannot issue a token on localhost — the widget's domain list does
  // not include it — and the submit button stays disabled until it does, which
  // makes the app unusable for local testing. Run with
  // NEXT_PUBLIC_TURNSTILE_SITE_KEY=off to drop the widget and its gate.
  // Production is unaffected: with the variable unset the literal below applies,
  // exactly as before.
  const configuredTurnstileSiteKey =
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "0x4AAAAAAAE0s1vISzlsndFj";
  // "off" removes the widget and its gate. An empty value cannot serve as the
  // off signal — the bundler inlines an empty env var as undefined, which the
  // ?? above turns straight back into the production key — hence a sentinel.
  const turnstileSiteKey =
    configuredTurnstileSiteKey === "off" ? "" : configuredTurnstileSiteKey;
  const [loginTurnstileToken, setLoginTurnstileToken] = useState("");
  const [registerTurnstileToken, setRegisterTurnstileToken] = useState("");
  // The OTP step has its own widget: the login/register token is already spent
  // by then (a Turnstile token is single use), and the API refuses a resend
  // without a fresh one.
  const [resendTurnstileToken, setResendTurnstileToken] = useState("");
  const resendTurnstileRef = useRef<TurnstileInstance>(null);
  // The resend widget unmounts together with the OTP step. A token still in
  // state from an earlier mount is spent or expired, so drop it and let the
  // freshly mounted widget issue a new one.
  useEffect(() => {
    setResendTurnstileToken("");
  }, [otpSent, open]);
  const loginTurnstileRef = useRef<TurnstileInstance>(null);
  const registerTurnstileRef = useRef<TurnstileInstance>(null);
  const otpInputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  const [banner, setBanner] = useState<string[]>([]);
  useEffect(() => {
    const fetchSettings = async () => {
      const settings = await getAppSettings();
      if (settings) {
        setBanner(settings.banner_imager);
      }
    };
    fetchSettings();
  }, []);

  // Login form for sending OTP
  const loginForm = useForm<z.infer<typeof phoneSchema>>({
    resolver: zodResolver(phoneSchema),
    defaultValues: {
      phoneNumber: "",
    },
  });

  // OTP verification form
  const otpForm = useForm<z.infer<typeof otpSchema>>({
    resolver: zodResolver(otpSchema),
    defaultValues: {
      phoneNumber: "",
      otp: "",
    },
  });

  // Registration form
  const registerForm = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phoneNumber: "",
      website: "",
    },
  });

  // Handle phone input
  const handlePhoneInput = (
    e: ChangeEvent<HTMLInputElement>,
    setValue: (value: string) => void,
  ) => {
    let value = e.target.value;
    value = value.replace(/\D/g, "");
    if (value && !/^[08]/.test(value)) {
      value = "";
    }
    setValue(value);
    e.preventDefault();
  };

  // Handle login form submission (Send OTP)
  const onLoginSubmit = async (values: z.infer<typeof phoneSchema>) => {
    if (countdown > 0) {
      toast({
        variant: "destructive",
        title: "Mohon tunggu",
        description: `Silahkan tunggu ${countdown} detik sebelum mengirim ulang OTP.`,
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await login(
        values.phoneNumber,
        loginTurnstileToken || undefined,
        "",
      );

      if (response.status !== 200) {
        throw new Error(response.message || "Login gagal");
      }

      otpForm.setValue("phoneNumber", values.phoneNumber);
      setOtpSent(true);
      setCountdown(30);

      toast({
        title: "OTP Terkirim",
        description: "Kode OTP telah dikirim ke WhatsApp Anda.",
      });
    } catch (error) {
      loginTurnstileRef.current?.reset();
      setLoginTurnstileToken("");
      toast({
        variant: "destructive",
        title: "Login Gagal",
        description:
          error instanceof Error
            ? error.message
            : "Terjadi kesalahan saat mengirim OTP. Silakan coba lagi.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Countdown timer effect
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

  // Handle OTP verification submission
  const onVerifyOtpSubmit = async (values: z.infer<typeof otpSchema>) => {
    setIsLoading(true);
    try {
      const response = await verifyOTPApi(values.phoneNumber, values.otp);

      if (response.status !== 200) {
        throw new Error(response.message || "Verifikasi OTP gagal");
      }

      if (response.data?.token) {
        setToken(response.data.token);
        setUser(response.data.user);

        toast({
          title: "Login Berhasil",
          description: "Anda berhasil masuk ke akun Anda.",
        });

        // Reload page to ensure all state is fresh
        window.location.reload();
      } else {
        throw new Error("Token tidak ditemukan");
      }
    } catch (error) {
      console.error("OTP verification error:", error);
      toast({
        variant: "destructive",
        title: "Verifikasi Gagal",
        description:
          error instanceof Error
            ? error.message
            : "Kode OTP tidak valid atau telah kedaluwarsa. Silakan coba lagi.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle registration form submission
  const onRegisterSubmit = async (values: z.infer<typeof registerSchema>) => {
    setIsLoading(true);
    try {
      const response = await register({
        fullName: values.fullName,
        email: values.email,
        phoneNumber: values.phoneNumber,
        captchaToken: registerTurnstileToken || undefined,
        website: "",
      });

      // The account exists, only the OTP could not be sent. Keep the user on the
      // register form: submitting again re-sends the code to the same number.
      if (isOtpDeliveryFailure(response)) {
        registerTurnstileRef.current?.reset();
        setRegisterTurnstileToken("");
        toast({
          variant: "destructive",
          title: "Kode OTP Gagal Terkirim",
          description:
            "Data Anda sudah tersimpan, tetapi kode OTP belum bisa dikirim ke WhatsApp. Tekan Daftar sekali lagi untuk mengirim ulang kodenya.",
        });
        return;
      }

      if (response.status !== 200) {
        throw new Error(response.message || "Registrasi gagal");
      }

      toast({
        title: "Registrasi Berhasil",
        description:
          "Akun Anda berhasil dibuat. Silakan verifikasi dengan OTP yang dikirim ke WhatsApp Anda.",
      });

      setIsNewRegistration(true);
      setActiveTab("login");
      loginForm.setValue("phoneNumber", values.phoneNumber);
      otpForm.setValue("phoneNumber", values.phoneNumber);
      setOtpSent(true);
      setCountdown(30);
    } catch (error) {
      console.error("Registration error:", error);
      registerTurnstileRef.current?.reset();
      setRegisterTurnstileToken("");
      toast({
        variant: "destructive",
        title: "Registrasi Gagal",
        description:
          error instanceof Error
            ? error.message
            : "Terjadi kesalahan saat registrasi. Silakan coba lagi.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const switchToRegisterTab = () => {
    setActiveTab("register");
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setOtpSent(false);
    setCountdown(0);
    setOtpDigits(["", "", "", ""]);
    if (value === "register") {
      setIsNewRegistration(false);
    }
  };

  // Handle OTP digit input
  const handleOtpDigitChange = (index: number, value: string) => {
    if (value && !/^\d+$/.test(value)) return;
    const newOtpDigits = [...otpDigits];
    newOtpDigits[index] = value.slice(-1);
    setOtpDigits(newOtpDigits);
    if (value && index < 3) {
      otpInputRefs[index + 1].current?.focus();
    }
    otpForm.setValue("otp", newOtpDigits.join(""));
  };

  const handleOtpKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      otpInputRefs[index - 1].current?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text/plain").trim();
    if (!/^\d+$/.test(pastedData)) return;
    const newOtpDigits = [...otpDigits];
    const pastedChars = pastedData.split("");
    for (let i = 0; i < Math.min(pastedChars.length, 4); i++) {
      newOtpDigits[i] = pastedChars[i];
    }
    setOtpDigits(newOtpDigits);
    otpForm.setValue("otp", newOtpDigits.join(""));
    const nextEmptyIndex = newOtpDigits.findIndex((digit) => !digit);
    if (nextEmptyIndex !== -1 && nextEmptyIndex < 4) {
      otpInputRefs[nextEmptyIndex].current?.focus();
    } else {
      otpInputRefs[3].current?.focus();
    }
  };

  const handleResendOTP = async () => {
    if (countdown > 0) {
      toast({
        variant: "destructive",
        title: "Mohon tunggu",
        description: `Silahkan tunggu ${countdown} detik sebelum mengirim ulang OTP.`,
      });
      return;
    }

    const phoneNumber = loginForm.getValues().phoneNumber;

    if (!phoneNumber) {
      toast({
        variant: "destructive",
        title: "Nomor HP Kosong",
        description: "Silakan masukkan nomor HP Anda terlebih dahulu.",
      });
      return;
    }

    if (turnstileSiteKey && !resendTurnstileToken) {
      toast({
        variant: "destructive",
        title: "Verifikasi belum selesai",
        description: "Mohon tunggu verifikasi keamanan selesai, lalu coba lagi.",
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await resendOTPApi(
        phoneNumber,
        resendTurnstileToken || undefined,
      );

      if (response.status !== 200) {
        throw new Error(response.message || "Gagal mengirim ulang OTP");
      }

      setOtpDigits(["", "", "", ""]);
      otpForm.setValue("otp", "");
      setCountdown(30);

      toast({
        title: "OTP Terkirim",
        description: "Kode OTP baru telah dikirim ke WhatsApp Anda.",
      });
    } catch (error) {
      console.error("Resend OTP error:", error);
      toast({
        variant: "destructive",
        title: "Gagal Mengirim Ulang OTP",
        description:
          error instanceof Error
            ? error.message
            : "Terjadi kesalahan saat mengirim ulang OTP. Silakan coba lagi.",
      });
    } finally {
      resendTurnstileRef.current?.reset();
      setResendTurnstileToken("");
      setIsLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-md bg-card rounded-xl p-4 max-h-[90vh] overflow-y-auto">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-2 right-2 z-[110] bg-secondary rounded-full p-1.5 shadow-sm hover:bg-gray-200 transition-colors"
            aria-label="Tutup"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        )}
        <Tabs
          value={activeTab}
          onValueChange={handleTabChange}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger className="text-base font-bold" value="login">
              Login
            </TabsTrigger>
            <TabsTrigger className="text-base font-bold" value="register">
              Daftar
            </TabsTrigger>
          </TabsList>

          {/* Login Tab Content */}
          <TabsContent value="login">
            <Card className="relative">
              <CardHeader>
                <CardTitle className="text-2xl font-bold">
                  Login Akun Topsell
                </CardTitle>
                <CardDescription>
                  Masukkan nomor handphone Anda untuk login.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Carousel className="rounded-md overflow-hidden relative">
                  <CarouselContent>
                    {banner.map((item, index) => (
                      <CarouselItem key={`${item}-${index}`}>
                        <img
                          src={item}
                          alt="Banner"
                          className="w-full h-full object-cover rounded-md"
                        />
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  {banner.length > 1 && (
                    <>
                      <CarouselPrevious className="absolute left-0 top-1/2 -translate-y-1/2 z-10" />
                      <CarouselNext className="absolute right-0 top-1/2 -translate-y-1/2 z-10" />
                    </>
                  )}
                </Carousel>
                {banner.length > 0 && <div className="mb-4"></div>}
                <Form {...loginForm}>
                  <form
                    onSubmit={loginForm.handleSubmit(onLoginSubmit)}
                    className="space-y-4"
                  >
                    {/* Honeypot field */}
                    <div
                      style={{
                        position: "absolute",
                        left: "-9999px",
                        opacity: 0,
                        pointerEvents: "none",
                      }}
                      aria-hidden="true"
                    >
                      <input
                        type="text"
                        name="website"
                        tabIndex={-1}
                        autoComplete="off"
                        value={honeypotWebsite}
                        onChange={(e) => setHoneypotWebsite(e.target.value)}
                      />
                    </div>

                    <FormField
                      control={loginForm.control}
                      name="phoneNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-base font-medium">
                            Nomor Whatsapp
                          </FormLabel>
                          <div className="flex">
                            <div className="flex items-center justify-center bg-slate-100 text-slate-900 px-3 h-9 rounded-l-md font-medium border border-r-0 border-input min-w-[60px]">
                              +62
                            </div>
                            <FormControl>
                              <Input
                                className="rounded-l-none focus-visible:ring-0 focus-visible:ring-transparent"
                                placeholder="Nomor HP"
                                type="tel"
                                inputMode="numeric"
                                onChange={(e) => {
                                  handlePhoneInput(e, field.onChange);
                                  if (
                                    otpSent &&
                                    e.target.value !==
                                      loginForm.getValues().phoneNumber
                                  ) {
                                    setOtpSent(false);
                                    setCountdown(0);
                                    otpForm.setValue("otp", "");
                                  }
                                }}
                                value={field.value}
                                onBlur={field.onBlur}
                                name={field.name}
                              />
                            </FormControl>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {!otpSent && turnstileSiteKey && (
                      <Turnstile
                        ref={loginTurnstileRef}
                        siteKey={turnstileSiteKey}
                        onSuccess={setLoginTurnstileToken}
                        onExpire={() => setLoginTurnstileToken("")}
                        onError={() => setLoginTurnstileToken("")}
                        options={{ theme: "light", language: "id" }}
                        className="my-1"
                      />
                    )}

                    {!otpSent && (
                      <Button
                        type="submit"
                        className="w-full bg-[#12804a] hover:bg-[#0f6e3f] text-white flex items-center justify-center gap-2 font-bold text-base h-12"
                        size="lg"
                        disabled={isLoading || (!!turnstileSiteKey && !loginTurnstileToken)}
                      >
                        {isLoading ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <>
                            <img
                              src="/icons/whatsapp.svg"
                              alt="WhatsApp"
                              width={20}
                              height={20}
                              className="w-5 h-5"
                            />
                            <span>Kirim OTP ke WhatsApp</span>
                          </>
                        )}
                      </Button>
                    )}

                    {otpSent && (
                      <>
                        <Alert className="bg-secondary border-border mt-4">
                          <AlertDescription className="text-foreground flex items-center gap-2">
                            <CheckCircle className="h-5 w-5 text-success flex-shrink-0" />
                            <span>
                              OTP telah dikirim via WhatsApp. Silahkan masukkan
                              OTP di bawah ini.
                            </span>
                          </AlertDescription>
                        </Alert>

                        <Form {...otpForm}>
                          <div className="space-y-4">
                            <FormField
                              control={otpForm.control}
                              name="otp"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-base font-medium">
                                    Kode OTP
                                  </FormLabel>
                                  <FormControl>
                                    <div>
                                      <div className="hidden">
                                        <Input
                                          {...field}
                                          type="text"
                                          maxLength={4}
                                        />
                                      </div>
                                      <div className="flex justify-between gap-2">
                                        {otpDigits.map((digit, index) => (
                                          <div key={index} className="w-full">
                                            <Input
                                              ref={otpInputRefs[index]}
                                              value={digit}
                                              onChange={(e) =>
                                                handleOtpDigitChange(
                                                  index,
                                                  e.target.value,
                                                )
                                              }
                                              onKeyDown={(e) =>
                                                handleOtpKeyDown(index, e)
                                              }
                                              onPaste={
                                                index === 0
                                                  ? handleOtpPaste
                                                  : undefined
                                              }
                                              className="h-14 text-center text-xl font-bold w-full rounded-xl transition-all"
                                              type="text"
                                              inputMode="numeric"
                                              maxLength={1}
                                              autoComplete="one-time-code"
                                              aria-label={`Digit ${index + 1}`}
                                            />
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <Button
                              type="button"
                              onClick={otpForm.handleSubmit(onVerifyOtpSubmit)}
                              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-lg h-12"
                              disabled={
                                isLoading ||
                                otpDigits.some((digit) => digit === "")
                              }
                              size="lg"
                            >
                              {isLoading ? (
                                <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                              ) : (
                                "Login"
                              )}
                            </Button>

                            <div className="mt-2 text-center">
                              <h4 className="text-sm font-medium text-muted-foreground">
                                Kirim ulang kode OTP?
                              </h4>
                              {countdown > 0 && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Tunggu {countdown} detik untuk kirim ulang
                                </p>
                              )}
                              {turnstileSiteKey && (
                                <div className="flex justify-center mt-2">
                                  <Turnstile
                                    ref={resendTurnstileRef}
                                    siteKey={turnstileSiteKey}
                                    onSuccess={setResendTurnstileToken}
                                    onExpire={() => setResendTurnstileToken("")}
                                    onError={() => setResendTurnstileToken("")}
                                  />
                                </div>
                              )}
                              <Button
                                type="button"
                                className="w-full bg-[#12804a] hover:bg-[#0f6e3f] text-white flex items-center justify-center gap-2 font-bold text-base h-12 mt-2"
                                size="lg"
                                disabled={
                                  isLoading ||
                                  countdown > 0 ||
                                  (!!turnstileSiteKey && !resendTurnstileToken)
                                }
                                onClick={handleResendOTP}
                              >
                                {isLoading ? (
                                  <Loader2 className="h-5 w-5 animate-spin" />
                                ) : (
                                  <>
                                    <img
                                      src="/icons/whatsapp.svg"
                                      alt="WhatsApp"
                                      width={20}
                                      height={20}
                                      className="w-5 h-5"
                                    />
                                    <span>Kirim OTP ke WhatsApp</span>
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        </Form>
                      </>
                    )}

                    <p className="mt-5 text-center text-sm text-muted-foreground">
                      Belum punya akun?{" "}
                      <button type="button" onClick={switchToRegisterTab} className="font-semibold text-foreground underline underline-offset-4">
                        Daftar sekarang
                      </button>
                    </p>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Register Tab Content */}
          <TabsContent value="register">
            <Card className="relative">
              <CardHeader>
                <CardTitle className="text-2xl font-bold">
                  Buat Akun Topsell
                </CardTitle>
                <CardDescription>
                  Buat akun baru untuk mulai berbelanja.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Carousel className="rounded-md overflow-hidden relative">
                  <CarouselContent>
                    {banner.map((item, index) => (
                      <CarouselItem key={`${item}-${index}`}>
                        <img
                          src={item}
                          alt="Banner"
                          className="w-full h-full object-cover rounded-md"
                        />
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  {banner.length > 1 && (
                    <>
                      <CarouselPrevious className="absolute left-0 top-1/2 -translate-y-1/2 z-10" />
                      <CarouselNext className="absolute right-0 top-1/2 -translate-y-1/2 z-10" />
                    </>
                  )}
                </Carousel>
                {banner.length > 0 && <div className="mb-4"></div>}

                <Form {...registerForm}>
                  <form
                    onSubmit={registerForm.handleSubmit(onRegisterSubmit)}
                    className="space-y-4"
                  >
                    {/* Honeypot field */}
                    <div
                      style={{
                        position: "absolute",
                        left: "-9999px",
                        opacity: 0,
                        pointerEvents: "none",
                      }}
                      aria-hidden="true"
                    >
                      <input
                        type="text"
                        name="website"
                        tabIndex={-1}
                        autoComplete="off"
                        value={honeypotWebsite}
                        onChange={(e) => setHoneypotWebsite(e.target.value)}
                      />
                    </div>

                    <FormField
                      control={registerForm.control}
                      name="fullName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-base font-medium">
                            Nama Lengkap
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Masukkan nama lengkap"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={registerForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-base font-medium">
                            Email
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder="user@example.com"
                              type="email"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription className="text-sm">
                            ⓘ Pastikan email yang dicantumkan adalah email
                            aktif. Invoice pesanan serta informasi promo dan
                            voucher akan dikirim ke alamat email tersebut.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={registerForm.control}
                      name="phoneNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-base font-medium">
                            Nomor Whatsapp
                          </FormLabel>
                          <div className="flex">
                            <div className="flex items-center justify-center bg-slate-100 text-slate-900 px-3 h-9 rounded-l-md font-medium border border-r-0 border-input min-w-[60px]">
                              +62
                            </div>
                            <FormControl>
                              <Input
                                className="rounded-l-none focus-visible:ring-0 focus-visible:ring-transparent"
                                placeholder="Nomor HP"
                                type="tel"
                                inputMode="numeric"
                                onChange={(e) => {
                                  handlePhoneInput(e, field.onChange);
                                }}
                                value={field.value}
                                onBlur={field.onBlur}
                                name={field.name}
                              />
                            </FormControl>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {turnstileSiteKey && (
                      <Turnstile
                        ref={registerTurnstileRef}
                        siteKey={turnstileSiteKey}
                        onSuccess={setRegisterTurnstileToken}
                        onExpire={() => setRegisterTurnstileToken("")}
                        onError={() => setRegisterTurnstileToken("")}
                        options={{ theme: "light", language: "id" }}
                        className="my-1"
                      />
                    )}

                    <Button
                      type="submit"
                      className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-lg h-12"
                      disabled={isLoading || (!!turnstileSiteKey && !registerTurnstileToken)}
                      size="lg"
                    >
                      {isLoading ? (
                        <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                      ) : (
                        "Buat Akun Baru"
                      )}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
