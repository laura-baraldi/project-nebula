import type { ShippingDetails } from "@/lib/checkoutApi";

type Props = {
  shipping: ShippingDetails;
  onChange: (field: keyof ShippingDetails, value: string) => void;
};

export default function ShippingAddressForm({ shipping, onChange }: Props) {
  const inputClass =
    "mt-2 w-full rounded-xl border border-violet-200 px-4 py-3 text-gray-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200";

  const labelClass = "block text-sm font-medium text-violet-950";

  return (
    <section className="mt-8 border-t border-violet-100 pt-7">
      <h2 className="text-xl font-semibold text-violet-950">
        Shipping address
      </h2>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="first-name" className={labelClass}>
            First name *
          </label>
          <input
            id="first-name"
            name="first_name"
            autoComplete="given-name"
            required
            value={shipping.first_name}
            onChange={(event) => onChange("first_name", event.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="last-name" className={labelClass}>
            Last name *
          </label>
          <input
            id="last-name"
            name="last_name"
            autoComplete="family-name"
            required
            value={shipping.last_name}
            onChange={(event) => onChange("last_name", event.target.value)}
            className={inputClass}
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="address-line1" className={labelClass}>
            Address *
          </label>
          <input
            id="address-line1"
            name="address_line1"
            autoComplete="address-line1"
            required
            value={shipping.address_line1}
            onChange={(event) => onChange("address_line1", event.target.value)}
            placeholder="Street and house number"
            className={inputClass}
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="address-line2" className={labelClass}>
            Apartment, suite, etc. (optional)
          </label>
          <input
            id="address-line2"
            name="address_line2"
            autoComplete="address-line2"
            value={shipping.address_line2 ?? ""}
            onChange={(event) => onChange("address_line2", event.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="city" className={labelClass}>
            City *
          </label>
          <input
            id="city"
            name="city"
            autoComplete="address-level2"
            required
            value={shipping.city}
            onChange={(event) => onChange("city", event.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="postal-code" className={labelClass}>
            Postal code *
          </label>
          <input
            id="postal-code"
            name="postal_code"
            autoComplete="postal-code"
            required
            value={shipping.postal_code}
            onChange={(event) => onChange("postal_code", event.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="country" className={labelClass}>
            Country *
          </label>
          <input
            id="country"
            name="country"
            autoComplete="country-name"
            required
            value={shipping.country}
            onChange={(event) => onChange("country", event.target.value)}
            placeholder="Country"
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="phone" className={labelClass}>
            Phone number (optional)
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            value={shipping.phone ?? ""}
            onChange={(event) => onChange("phone", event.target.value)}
            className={inputClass}
          />
        </div>
      </div>
    </section>
  );
}
