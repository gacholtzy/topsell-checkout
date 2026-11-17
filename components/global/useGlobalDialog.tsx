"use client";

import { ReactNode } from "react";
import { useDialog } from "./DialogContext";
import { Button } from "../../components/ui/button";
import { Info, AlertCircle, CheckCircle, XCircle } from "lucide-react";
import { DialogTitle } from "../../components/ui/dialog";

// Types for different dialog variants
type ConfirmDialogProps = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel?: () => void;
};

type AlertDialogProps = {
  title: string;
  message: string;
  buttonLabel?: string;
  onClose?: () => void;
  iconType?: 'info' | 'success' | 'error' | 'warning' | 'none';
};

type CustomDialogProps = {
  title?: string;
  description?: string;
  content: ReactNode;
  footer?: ReactNode;
};

// Enhanced hook with utility methods
export const useGlobalDialog = () => {
  const { openDialog, closeDialog } = useDialog();

  // Show a confirmation dialog
  const showConfirmDialog = ({
    title,
    message,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    onConfirm,
    onCancel,
  }: ConfirmDialogProps) => {
    openDialog({
      title: title,
      description: "",
      hideTitle: true,
      content: (
        <div className="flex flex-col items-center justify-center py-2 text-center">
          <h2 className="text-lg font-semibold mb-2">{title}</h2>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
      ),
      footer: (
        <div className="flex justify-center gap-4 w-full">
          <Button
            variant="outline"
            onClick={() => {
              closeDialog();
              onCancel?.();
            }}
            className="min-w-32"
          >
            {cancelLabel}
          </Button>
          <Button
            onClick={() => {
              closeDialog();
              onConfirm();
            }}
            className="min-w-32"
          >
            {confirmLabel}
          </Button>
        </div>
      ),
    });
  };

  // Show an alert dialog
  const showAlertDialog = ({
    title,
    message,
    buttonLabel = "OK",
    onClose,
    iconType = 'info',
  }: AlertDialogProps) => {
    // Select the appropriate icon based on iconType
    const IconComponent = (() => {
      switch (iconType) {
        case 'info':
          return <Info className="h-10 w-10 text-foreground" strokeWidth={1.5} />;
        case 'success':
          return <CheckCircle className="h-10 w-10 text-success" strokeWidth={1.5} />;
        case 'error':
          return <XCircle className="h-10 w-10 text-destructive" strokeWidth={1.5} />;
        case 'warning':
          return <AlertCircle className="h-10 w-10 text-warning" strokeWidth={1.5} />;
        case 'none':
          return null;
        default:
          return <Info className="h-10 w-10 text-foreground" strokeWidth={1.5} />;
      }
    })();

    openDialog({
      title: title,
      description: "",
      hideTitle: true,
      content: iconType !== 'none' ? (
        <div className="flex flex-col items-center justify-center py-2 text-center">
          {IconComponent}
          <h2 className="mb-2 mt-4 text-lg font-bold">{title}</h2>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-2 text-center">
          <h2 className="text-lg font-semibold mb-2">{title}</h2>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
      ),
      footer: (
        <div className="flex justify-center w-full">
          <Button
            onClick={() => {
              closeDialog();
              onClose?.();
            }}
            className="min-w-32"
          >
            {buttonLabel}
          </Button>
        </div>
      ),
    });
  };

  // Show a custom dialog
  const showCustomDialog = ({
    title,
    description,
    content,
    footer,
  }: CustomDialogProps) => {
    openDialog({
      title,
      description,
      content,
      footer,
    });
  };

  return {
    openDialog,
    closeDialog,
    showConfirmDialog,
    showAlertDialog,
    showCustomDialog,
  };
}; 