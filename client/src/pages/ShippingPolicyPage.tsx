import React from "react";
import { Link } from "react-router-dom";

export default function ShippingPolicy() {
  return (
    <div className="w-full flex justify-center px-4 py-10">
      <div className="max-w-3xl text-center">

        {/* Heading */}
        <h1 className="text-3xl font-semibold mb-6">Shipping Policy</h1>

        {/* Content Sections */}
        <div className="space-y-6 text-gray-800 leading-relaxed">

          <section>
            <p>
              At StudioTimess, we aim to get your loungewear to you as quickly and 
              safely as possible. Please review our shipping policy for more details.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">Processing Time</h2>
            <p>
              All orders are processed within 1–3 business days. Orders are not
              processed or shipped on weekends or holidays.
              You will receive a shipping confirmation email once your order has shipped.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">Shipping Rates & Delivery Times</h2>
            <p>
              Shipping costs are calculated at checkout based on your location.
              Delivery times vary depending on your address, but typical shipping
              time is 3–5 business days.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">Incorrect Address</h2>
            <p>
              Please double-check your shipping address before placing your order.
              We are not responsible for orders shipped to an incorrect address
              provided by the customer.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">Shipping Address Updates</h2>
            <p>
              If you need to update your shipping address, please contact us at <br />
              <span className="font-medium">halleycomet.business@gmail.com</span> <br />
              within 24 hours of placing your order.  
              We cannot change the shipping address once your order has been processed or shipped.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}