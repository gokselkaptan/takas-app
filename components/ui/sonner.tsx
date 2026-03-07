"use client"
import { useTheme } from "next-themes"
import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()
  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position="top-right"
      richColors
      expand={false}
      duration={4000}
      toastOptions={{
        classNames: {
          toast: "group toast !bg-gray-900 !text-white !border !border-violet-500/30 !shadow-xl !shadow-violet-900/20 !rounded-xl !backdrop-blur-sm",
          title: "!text-white !font-semibold !text-sm",
          description: "!text-gray-400 !text-xs",
          success: "!border-green-500/40 !shadow-green-900/20",
          error: "!border-red-500/40 !shadow-red-900/20",
          warning: "!border-amber-500/40 !shadow-amber-900/20",
          info: "!border-violet-500/40",
          actionButton: "!bg-violet-600 !text-white hover:!bg-violet-700",
          cancelButton: "!bg-gray-700 !text-gray-300",
          closeButton: "!bg-gray-800 !border-gray-700 !text-gray-400",
        },
      }}
      {...props}
    />
  )
}
export { Toaster }
