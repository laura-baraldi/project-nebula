type Props = {
  email: string;
  onEmailChange: (value: string) => void;
};

export default function ContactInformation({ email, onEmailChange }: Props) {
  return (
    <section>
      <h2 className="text-xl font-semibold text-violet-950">
        Contact information
      </h2>

      <label
        htmlFor="customer-email"
        className="mt-6 block text-sm font-medium text-violet-950"
      >
        Email address *
      </label>

      <input
        id="customer-email"
        name="email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(event) => onEmailChange(event.target.value)}
        placeholder="you@example.com"
        className="mt-2 w-full rounded-xl border border-violet-200 px-4 py-3 text-gray-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
      />

      <p className="mt-2 text-xs text-gray-500">
        Your order confirmation will be sent to this address.
      </p>
    </section>
  );
}
