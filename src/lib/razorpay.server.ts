import Razorpay from "razorpay";
import { env } from "node:process";

if (!env["RAZORPAY_KEY_ID"] || !env["RAZORPAY_KEY_SECRET"]) {
  console.warn("Razorpay keys are missing. Payments will not work.");
}

export const razorpay = new Razorpay({
  key_id: env["RAZORPAY_KEY_ID"] || "rzp_test_mock",
  key_secret: env["RAZORPAY_KEY_SECRET"] || "mock_secret",
});
