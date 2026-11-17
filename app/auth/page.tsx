"use client";

import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { Turnstile, TurnstileInstance } from "@marsidev/react-turnstile";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { ChangeEvent } from "react";
import { MessageSquare, Loader2, CheckCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/useAuthStore";
import {
  login,
  register,
  verifyOTP as verifyOTPApi,
  resendOTP as resendOTPApi,
  isOtpDeliveryFailure,
} from "@/app/api/auth";
import { getRedirectPath, redirectAuthenticated } from "@/lib/auth-utils";
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
        // Allow numbers starting with 0 or 8
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
  website: z.string().optional(), // Honeypot field - should remain empty
});

export default function AuthPage() {
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("login");
  const [otpSent, setOtpSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [otpDigits, setOtpDigits] = useState<string[]>(["", "", "", ""]);
  const [honeypotWebsite, setHoneypotWebsite] = useState(""); // Honeypot field
  const [isNewRegistration, setIsNewRegistration] = useState(false); // Track new registration
  const router = useRouter();
  const { isAuthenticated, setToken, setUser } = useAuthStore();

  // Same switch as components/auth-modal.tsx — this page carries its own copy of
  // the Turnstile widget and its own submit gate. Turnstile cannot issue a token
  // on localhost, so without this the login button is permanently disabled. Run
  // with NEXT_PUBLIC_TURNSTILE_SITE_KEY=off to drop the widget and the gate;
  // with the variable unset the literal below applies, exactly as before.
  const configuredTurnstileSiteKey =
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "0x4AAAAAAAE0s1vISzlsndFj";
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
  }, [otpSent]);
  const loginTurnstileRef = useRef<TurnstileInstance>(null);
  const registerTurnstileRef = useRef<TurnstileInstance>(null);
  const otpInputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  // Get the 'from' query parameter
  const [redirectPath, setRedirectPath] = useState<string>("/");
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

  // Read query params on component mount and check authentication
  useEffect(() => {
    // Otherwise, set the redirect path for after login
    setRedirectPath(getRedirectPath("/"));
  }, [router]);

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
      website: "", // honeypot
    },
  });

  // Handle phone input to only allow digits and ensure it starts with 0 or 8
  const handlePhoneInput = (
    e: ChangeEvent<HTMLInputElement>,
    setValue: (value: string) => void,
  ) => {
    // Get current input value
    let value = e.target.value;

    // Only allow digits
    value = value.replace(/\D/g, "");

    // If not empty and doesn't start with 0 or 8, clear the input
    if (value && !/^[08]/.test(value)) {
      value = "";
    }

    // Update the form value
    setValue(value);

    // Prevent default to override the input value
    e.preventDefault();
  };

  // Handle login form submission (Send OTP)
  const onLoginSubmit = async (values: z.infer<typeof phoneSchema>) => {
    // If countdown is still active, show toast and return
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
      // Call login API
      const response = await login(
        values.phoneNumber,
        loginTurnstileToken || undefined,
        "",
      );

      if (response.status !== 200) {
        throw new Error(response.message || "Login gagal");
      }

      // Set phone number in OTP form
      otpForm.setValue("phoneNumber", values.phoneNumber);

      // Mark OTP as sent
      setOtpSent(true);

      // Start countdown timer (30 seconds)
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
      // Call verify OTP API
      const response = await verifyOTPApi(values.phoneNumber, values.otp);

      if (response.status !== 200) {
        throw new Error(response.message || "Verifikasi OTP gagal");
      }

      // Save token to Zustand store
      if (response.data?.token) {
        // Determine redirect destination
        let finalRedirectPath: string;
        let isExternalRedirect = false;
        // If this is a new registration, redirect to LP Member
        if (isNewRegistration) {
          finalRedirectPath = "https://links.topsellbelanja.com/lp-member-tsb";
          isExternalRedirect = true;
        } else {
          // For normal login, redirect to LP Promo
          finalRedirectPath = "https://links.topsellbelanja.com/lp-member-tsb";
          isExternalRedirect = true;
        }

        toast({
          title: "Login Berhasil",
          description: "Anda berhasil masuk ke akun Anda.",
        });

        // Redirect to the appropriate path
        if (isExternalRedirect) {
          // For external redirect, use window.location
          window.location.href = finalRedirectPath;
        } else {
          router.push(finalRedirectPath);
        }

        setToken(response.data.token);
        setUser(response.data.user);
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
      // Call register API
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

      // Mark this as a new registration for redirect purposes
      setIsNewRegistration(true);

      // Switch to login tab and set up OTP verification
      setActiveTab("login");

      // Pre-fill phone number in login form
      loginForm.setValue("phoneNumber", values.phoneNumber);
      otpForm.setValue("phoneNumber", values.phoneNumber);

      // Mark OTP as sent and trigger OTP input mode
      setOtpSent(true);

      // Start countdown timer
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

  // Function to switch to registration tab
  const switchToRegisterTab = () => {
    setActiveTab("register");
  };

  // Reset OTP state when switching tabs
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setOtpSent(false);
    setCountdown(0);
    setOtpDigits(["", "", "", ""]);
    // Reset the new registration flag when switching back to register tab
    if (value === "register") {
      setIsNewRegistration(false);
    }
  };

  // Handle OTP digit input
  const handleOtpDigitChange = (index: number, value: string) => {
    // Only allow numbers
    if (value && !/^\d+$/.test(value)) return;

    // Create a copy of the current digits
    const newOtpDigits = [...otpDigits];

    // Update the digit at the specified index (only keep the last character if multiple are entered)
    newOtpDigits[index] = value.slice(-1);

    // Update state
    setOtpDigits(newOtpDigits);

    // Move to next input if the current one is filled
    if (value && index < 3) {
      otpInputRefs[index + 1].current?.focus();
    }

    // Update the main OTP field in the form
    otpForm.setValue("otp", newOtpDigits.join(""));
  };

  // Handle backspace in OTP input
  const handleOtpKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    // If backspace is pressed and current field is empty, focus previous field
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      otpInputRefs[index - 1].current?.focus();
    }
  };

  // Handle paste for OTP
  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text/plain").trim();

    // Check if pasted content contains only numbers
    if (!/^\d+$/.test(pastedData)) return;

    // Create a new array with the pasted digits
    const newOtpDigits = [...otpDigits];
    const pastedChars = pastedData.split("");

    // Fill in as many digits as possible
    for (let i = 0; i < Math.min(pastedChars.length, 4); i++) {
      newOtpDigits[i] = pastedChars[i];
    }

    // Update state
    setOtpDigits(newOtpDigits);

    // Update the form value
    otpForm.setValue("otp", newOtpDigits.join(""));

    // Focus the next empty input or the last one if all are filled
    const nextEmptyIndex = newOtpDigits.findIndex((digit) => !digit);
    if (nextEmptyIndex !== -1 && nextEmptyIndex < 4) {
      otpInputRefs[nextEmptyIndex].current?.focus();
    } else {
      otpInputRefs[3].current?.focus();
    }
  };

  // Handle resend OTP
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
      // Call resend OTP API
      const response = await resendOTPApi(
        phoneNumber,
        resendTurnstileToken || undefined,
      );

      if (response.status !== 200) {
        throw new Error(response.message || "Gagal mengirim ulang OTP");
      }

      // Reset OTP fields
      setOtpDigits(["", "", "", ""]);
      otpForm.setValue("otp", "");

      // Start countdown timer (30 seconds)
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

  return (
    <div className="container flex items-center justify-center min-h-[calc(100vh-200px)] max-w-7xl mx-auto py-12">
      <div className="w-full max-w-md">
        <Tabs
          value={activeTab}
          onValueChange={handleTabChange}
          className="w-full"
        >
          <TabsList className="grid h-auto w-full grid-cols-2 p-1">
            <TabsTrigger className="text-base font-bold" value="login">
              Login
            </TabsTrigger>
            <TabsTrigger className="text-base font-bold" value="register">
              Daftar
            </TabsTrigger>
          </TabsList>

          {/* Login Tab Content */}
          <TabsContent value="login">
            <Card className="relative border-0 bg-transparent shadow-none sm:border sm:bg-card">
              <CardHeader>
                <CardTitle className="text-xl font-extrabold tracking-tight">
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
                    {/* Honeypot field - hidden from users, bots will fill it */}
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
                                  // If OTP has been sent and phone number changes, reset OTP state
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
                          <>
                            <Loader2 className="h-5 w-5 animate-spin" />
                          </>
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
                                  <>
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                  </>
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
            <Card className="relative border-0 bg-transparent shadow-none sm:border sm:bg-card">
              <CardHeader>
                <CardTitle className="text-xl font-extrabold tracking-tight">
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
                {/* <div className="mb-4 overflow-hidden rounded-xl shadow-lg bg-gradient-to-r from-primary to-rose-700">
                  <div className="relative px-6 py-5">
                    <div className="absolute top-0 right-0 -mt-6 -mr-8">
                      <div className="opacity-20">
                        <img src="/icons/announcement.svg" alt="" width={120} height={120} className="w-[120px] h-[120px] text-white" />
                      </div>
                    </div>
                    
                    <div className="flex items-center">
                      <div className="flex-shrink-0 p-2 bg-card/20 rounded-lg mr-4">
                        <img src="/icons/announcement.svg" alt="Announcement" width={36} height={36} className="w-9 h-9 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-white tracking-tight">
                          Silahkan Mendaftar!
                        </h3>
                        <p className="text-blue-100 mt-2 flex flex-wrap items-center gap-1">
                          Dan dapatkan poin belanja senilai
                          <span className="bg-card text-indigo-700 px-2 py-0.5 rounded-full font-bold inline-block">
                            Rp. 25Rb
                          </span>
                          untuk akun baru
                        </p>
                      </div>
                    </div>
                  </div>
                </div> */}

                <Form {...registerForm}>
                  <form
                    onSubmit={registerForm.handleSubmit(onRegisterSubmit)}
                    className="space-y-4"
                  >
                    {/* Honeypot field - hidden from users, bots will fill it */}
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
                            ⓘ Pastikan email yang dicantumkan adalah email aktif. Invoice pesanan serta informasi promo dan voucher akan dikirim ke alamat email tersebut.
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
