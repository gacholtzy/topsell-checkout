"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { QRCodeResponse, QRCodeData } from "@/interface/order";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, CheckCircle, Clock, RefreshCw, Copy, ArrowLeft } from "lucide-react";
import QRCode from "qrcode";

interface QRDisplayPageProps {}

function QRDisplayContent(): React.ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [qrData, setQrData] = useState<QRCodeData | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [refreshing, setRefreshing] = useState(false);
  
  const invoiceNumber = searchParams.get('inv');

  const fetchQRCode = async () => {
    if (!invoiceNumber) {
      setError("Invoice number is required");
      setLoading(false);
      return;
    }

    try {
      setRefreshing(true);
      const response = await fetch(`/api/proxy/api/v1/orders/qr-code?invoice=${encodeURIComponent(invoiceNumber)}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: QRCodeResponse = await response.json();
      
      if (result.status !== 200) {
        throw new Error(result.message || "Failed to fetch QR code");
      }

      setQrData(result.data);
      setError("");
      
      // Generate QR Code image
      if (result.data.qrString) {
        try {
          const qrDataUrl = await QRCode.toDataURL(result.data.qrString, {
            width: 256,
            margin: 2,
            color: {
              dark: "#000000",
              light: "#ffffff",
            },
            errorCorrectionLevel: "M",
          });
          setQrCodeDataUrl(qrDataUrl);
        } catch (qrError) {
          console.error("Error generating QR code:", qrError);
          toast({
            title: "Warning",
            description: "QR code image could not be generated, but you can still copy the QR string",
            variant: "destructive",
          });
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch QR code";
      setError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchQRCode();
  }, [invoiceNumber]);

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case "pending":
        return <Clock className="h-5 w-5 text-orange-500" />;
      case "paid":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "failed":
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "pending":
        return "text-orange-600 bg-orange-50 border-orange-200";
      case "paid":
        return "text-green-600 bg-green-50 border-green-200";
      case "failed":
        return "text-red-600 bg-red-50 border-red-200";
      default:
        return "text-gray-600 bg-gray-50 border-gray-200";
    }
  };

  const copyQRString = async () => {
    if (qrData?.qrString) {
      try {
        await navigator.clipboard.writeText(qrData.qrString);
        toast({
          title: "Copied!",
          description: "QR string copied to clipboard",
        });
      } catch (err) {
        toast({
          title: "Error",
          description: "Failed to copy QR string",
          variant: "destructive",
        });
      }
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-md mx-auto space-y-4">
          <Skeleton className="h-8 w-3/4" />
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-4 w-3/4" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error && !qrData) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-md mx-auto">
          <Button
            variant="outline"
            onClick={() => router.back()}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          
          <Button
            onClick={fetchQRCode}
            className="w-full mt-4"
            disabled={refreshing}
          >
            {refreshing ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => router.back()}
            size="sm"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          
          <Button
            variant="outline"
            onClick={fetchQRCode}
            size="sm"
            disabled={refreshing}
          >
            {refreshing ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>

        {qrData && (
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="flex items-center justify-center gap-2">
                Payment QR Code
                {getStatusIcon(qrData.status)}
              </CardTitle>
              <CardDescription>
                Invoice: {qrData.invoice}
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-6">
              {/* QR Code Display */}
              <div className="flex flex-col items-center space-y-4">
                {qrCodeDataUrl ? (
                  <div className="p-4 bg-white rounded-lg border-2 border-gray-200">
                    <img
                      src={qrCodeDataUrl}
                      alt="Payment QR Code"
                      className="w-64 h-64"
                    />
                  </div>
                ) : (
                  <div className="w-64 h-64 bg-gray-100 rounded-lg flex items-center justify-center border-2 border-gray-200">
                    <span className="text-gray-500">QR Code could not be generated</span>
                  </div>
                )}
                
                <Button
                  onClick={copyQRString}
                  variant="outline"
                  className="w-full"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy QR String
                </Button>
              </div>

              {/* Payment Details */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Amount:</span>
                  <span className="font-semibold text-lg">
                    {formatCurrency(qrData.amount)}
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Payment Type:</span>
                  <span className="font-medium">{qrData.paymentType}</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Status:</span>
                  <div className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(qrData.status)}`}>
                    {qrData.status.charAt(0).toUpperCase() + qrData.status.slice(1)}
                  </div>
                </div>
              </div>

              {/* Instructions */}
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Scan this QR code with your mobile banking app or e-wallet to complete the payment.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto space-y-4">
        <Skeleton className="h-8 w-3/4" />
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-4 w-3/4" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function QRDisplayPage(): React.ReactElement {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <QRDisplayContent />
    </Suspense>
  );
}
