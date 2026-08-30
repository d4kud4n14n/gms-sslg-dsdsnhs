interface EmailConfirmationBannerProps {
  email?: string
  onResend: () => void
  onDismiss: () => void
}

export default function EmailConfirmationBanner({ email, onResend, onDismiss }: EmailConfirmationBannerProps) {
  return (
    <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-semibold">Confirm your email address</p>
          <p className="mt-1">
            {email ? `A confirmation link was sent to ${email}.` : 'Please confirm your email address to unlock full access.'}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onResend}
            className="rounded-lg bg-amber-600 px-3 py-2 font-medium text-white transition hover:bg-amber-500"
          >
            Resend confirmation
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-lg border border-amber-300 bg-white px-3 py-2 font-medium text-amber-800 transition hover:bg-amber-100"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  )
}
