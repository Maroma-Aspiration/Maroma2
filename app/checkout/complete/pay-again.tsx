export function CheckoutPayAgain({ orderNumber }: { orderNumber: string }) {
  return (
    <form method="GET" action="/api/checkout/ccavenue/redirect" acceptCharset="UTF-8">
      <input type="hidden" name="order" value={orderNumber} />
      <button type="submit" className="maroma-btn maroma-btn-primary">
        Pay again with CCAvenue
      </button>
    </form>
  );
}
