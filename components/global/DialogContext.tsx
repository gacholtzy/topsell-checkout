"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../../components/ui/dialog";
import { VisuallyHidden } from "./VisuallyHidden";

// Define the type for our dialog content
type DialogContentType = {
  title?: string;
  description?: string;
  content?: ReactNode;
  footer?: ReactNode;
  hideTitle?: boolean; // Add option to visually hide the title
};

// Define the type for our context
interface DialogContextType {
  isOpen: boolean;
  dialogContent: DialogContentType;
  openDialog: (content: DialogContentType) => void;
  closeDialog: () => void;
}

// Create the context with default values
const DialogContext = createContext<DialogContextType>({
  isOpen: false,
  dialogContent: {},
  openDialog: () => {},
  closeDialog: () => {},
});

// Custom hook to use the dialog context
export const useDialog = () => useContext(DialogContext);

// Provider component
export const DialogProvider = ({ children }: { children: ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [dialogContent, setDialogContent] = useState<DialogContentType>({});

  const openDialog = (content: DialogContentType) => {
    setDialogContent(content);
    setIsOpen(true);
  };

  const closeDialog = () => {
    setIsOpen(false);
  };

  return (
    <DialogContext.Provider
      value={{
        isOpen,
        dialogContent,
        openDialog,
        closeDialog,
      }}
    >
      {children}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          {dialogContent.title && (
            <DialogHeader>
              {dialogContent.hideTitle ? (
                <>
                  <VisuallyHidden>
                    <DialogTitle>{dialogContent.title}</DialogTitle>
                  </VisuallyHidden>
                </>
              ) : (
                <DialogTitle>{dialogContent.title}</DialogTitle>
              )}
              {dialogContent.description && (
                <DialogDescription>{dialogContent.description}</DialogDescription>
              )}
            </DialogHeader>
          )}
          {dialogContent.content}
          {dialogContent.footer && <DialogFooter>{dialogContent.footer}</DialogFooter>}
        </DialogContent>
      </Dialog>
    </DialogContext.Provider>
  );
}; 