import React from "react";

export default function Policy() {
  return (
    <div className="w-full flex justify-center px-4 py-10">
      <div className="max-w-3xl text-center">

        {/* Heading */}
        <h1 className="text-3xl font-semibold mb-6">Refund Policy</h1>

        {/* Subsections */}
        <div className="space-y-6 text-gray-800 leading-relaxed">

          <section>
            <h2 className="text-xl font-semibold mb-2">Return & Refund Policy</h2>
            <p>
              At StudioTimess, we take pride in the quality of our products.
              However, please note that we do not offer returns or refunds.
              All sales are final.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">Damages and Issues</h2>
            <p>
              Please inspect your order upon reception and contact us immediately
              if the item is defective, damaged, or if you receive the wrong item,
              so that we can evaluate the issue and resolve it promptly.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">Exchanges</h2>
            <p>
              We currently do not offer exchanges. If you need a different item,
              please place a new order for the desired product.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">Refunds</h2>
            <p>
              Since we do not accept returns, refunds will not be processed unless
              there was an error or defective item on our part.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">Contact Us</h2>
            <p>
              For any questions, feel free to contact us at <br />
              <span className="font-medium">halleycomet.business@gmail.com</span>
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}