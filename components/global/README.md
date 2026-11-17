# Global Dialog System

This directory contains a global dialog system that allows you to open dialogs from anywhere in your application.

## Components

- `DialogContext.tsx`: Contains the context and provider for the dialog system
- `GlobalDialog.tsx`: Exports the provider and hooks for easy imports
- `useGlobalDialog.tsx`: Enhanced hook with utility methods for common dialog patterns
- `DialogExample.tsx`: Example component showing how to use the dialog system

## Setup

The dialog system is already set up in the root layout file (`app/layout.tsx`). The `GlobalDialogProvider` wraps the entire application, making the dialog system available everywhere.

## Usage

### Basic Usage

```tsx
import { useDialog } from "@/components/global/GlobalDialog";

function MyComponent() {
  const { openDialog, closeDialog } = useDialog();

  const handleOpenDialog = () => {
    openDialog({
      title: "My Dialog",
      description: "This is a description",
      content: <div>Custom content goes here</div>,
      footer: (
        <button onClick={() => closeDialog()}>Close</button>
      ),
    });
  };

  return <button onClick={handleOpenDialog}>Open Dialog</button>;
}
```

### Enhanced Usage with Utility Methods

```tsx
import { useGlobalDialog } from "@/components/global/GlobalDialog";

function MyComponent() {
  const { showAlertDialog, showConfirmDialog, showCustomDialog } = useGlobalDialog();

  // Show an alert dialog with an icon
  const handleShowAlert = () => {
    showAlertDialog({
      title: "Alert",
      message: "This is an alert message",
      buttonLabel: "OK",
      iconType: "info", // Options: "info", "success", "error", "warning", "none"
      onClose: () => console.log("Alert closed"),
    });
  };

  // Show a confirmation dialog
  const handleShowConfirm = () => {
    showConfirmDialog({
      title: "Confirm",
      message: "Are you sure you want to proceed?",
      confirmLabel: "Yes",
      cancelLabel: "No",
      onConfirm: () => console.log("Confirmed"),
      onCancel: () => console.log("Cancelled"),
    });
  };

  return (
    <div>
      <button onClick={handleShowAlert}>Show Alert</button>
      <button onClick={handleShowConfirm}>Show Confirm</button>
    </div>
  );
}
```

### Alert Dialog with Icons

The `showAlertDialog` function supports different icon types with a centered layout:

- Icon appears at the top
- Title and message are centered below the icon
- Button is centered at the bottom

```tsx
// Info icon (default)
showAlertDialog({
  title: "Information",
  message: "This is an information message",
  iconType: "info", // Blue info icon
  buttonLabel: "Got it"
});

// Success icon
showAlertDialog({
  title: "Success!",
  message: "Operation completed successfully!",
  iconType: "success", // Green checkmark icon
  buttonLabel: "Great"
});

// Error icon
showAlertDialog({
  title: "Error Occurred",
  message: "Something went wrong",
  iconType: "error", // Red X icon
  buttonLabel: "Try Again"
});

// Warning icon
showAlertDialog({
  title: "Warning",
  message: "This action might have consequences",
  iconType: "warning", // Amber warning icon
  buttonLabel: "I Understand"
});

// No icon
showAlertDialog({
  title: "No Icon Alert",
  message: "This alert has no icon",
  iconType: "none", // No icon displayed
  buttonLabel: "OK"
});
```

## Example Page

Check out the example page at `/dialog-example` to see the dialog system in action.

## Accessibility

The dialog system is fully accessible for screen reader users:

- All dialogs include proper ARIA attributes through Radix UI's Dialog primitive
- Custom layouts maintain accessibility by using visually hidden titles when needed
- Focus management is handled automatically by the Dialog component
- All interactive elements are keyboard accessible 