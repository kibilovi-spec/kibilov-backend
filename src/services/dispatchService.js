'use strict';
/**
 * Provider-agnostic courier dispatch — ერთი ფუნქცია, რომელიც შიგნით
 * ირჩევს კონკრეტულ courier-პროვაიდერს (Glovo/Wolt/Yandex/Manual).
 * ჯერჯერობით ეს STUB-ია — API credentials რომ მიღებულ იქნას, აქ ჩაერთვება
 * რეალური HTTP-გამოძახება შესაბამისი პროვაიდერისკენ.
 */
async function dispatchCourier(shipment) {
  // TODO: აქ ჩაერთვება რეალური Glovo/Wolt/Yandex API გამოძახება,
  // credentials-ის მიღების შემდეგ. ჯერჯერობით — მხოლოდ სტატუსის განახლება,
  // რომ admin-მა/supplier-მა იცოდეს ხელით უნდა მოაწყოს კურიერი.
  console.log(`[Dispatch STUB] Shipment ${shipment.id}: ${shipment.pickupAddress} → ${shipment.deliveryAddress} (${shipment.vehicleType})`);
  return {
    success: false,
    reason: 'NO_PROVIDER_CONFIGURED',
    message: 'კურიერის API ჯერ არ არის დაკავშირებული — გთხოვთ, ხელით მოაწყოთ მიწოდება',
  };
}

module.exports = { dispatchCourier };
